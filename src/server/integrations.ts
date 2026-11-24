import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { assertCan, type Principal } from "@/server/rbac/policy";

/**
 * Lead webhook and Slack alerts. URLs and the signing secret are entered in Admin → Integrations
 * and stored encrypted (key from APP_SECRET). Until something is saved there, the
 * LEADS_WEBHOOK_URL / LEADS_WEBHOOK_SECRET / SLACK_LEADS_WEBHOOK_URL environment variables are used.
 */
const webhookConfig = z.object({ includeMessage: z.boolean().default(true), urlEnc: z.string().default(""), secretEnc: z.string().default("") });
const slackConfig = z.object({ mentionOnHighPriority: z.string().max(40).default(""), urlEnc: z.string().default("") });

export type HookKey = "webhook.leads" | "slack.leads";
const NAMES: Record<HookKey, string> = { "webhook.leads": "Lead webhook", "slack.leads": "Slack lead alerts" };

async function row(key: HookKey) {
  return db.integration.findUnique({ where: { key } });
}
const dec = (s: string) => (s ? decryptSecret(s) : null);

/** Where lead.created is POSTed, or null when the webhook is off / has no URL. */
export async function leadWebhook(): Promise<{ url: string; secret: string; includeMessage: boolean } | null> {
  const r = await row("webhook.leads");
  const c = webhookConfig.parse(r?.config ?? {});
  if (!r?.isEnabled) return null;
  if (c.urlEnc) {
    const url = dec(c.urlEnc);
    return url ? { url, secret: dec(c.secretEnc) ?? "", includeMessage: c.includeMessage } : null;
  }
  return env.LEADS_WEBHOOK_URL ? { url: env.LEADS_WEBHOOK_URL, secret: env.LEADS_WEBHOOK_SECRET ?? "", includeMessage: c.includeMessage } : null;
}

/** Slack incoming-webhook URL, or null when Slack alerts are off / have no URL. */
export async function slackLeads(): Promise<{ url: string; mention: string } | null> {
  const r = await row("slack.leads");
  const c = slackConfig.parse(r?.config ?? {});
  if (!r?.isEnabled) return null;
  const url = c.urlEnc ? dec(c.urlEnc) : env.SLACK_LEADS_WEBHOOK_URL ?? null;
  return url ? { url, mention: c.mentionOnHighPriority } : null;
}

export const signWebhook = (secret: string, body: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

const hostOf = (url: string | null | undefined) => {
  try {
    return url ? new URL(url).host : null;
  } catch {
    return null;
  }
};

/** Safe view for the admin cards: never includes URLs (they contain tokens) or the secret. */
export async function getHookViews() {
  const [w, s] = await Promise.all([row("webhook.leads"), row("slack.leads")]);
  const wc = webhookConfig.parse(w?.config ?? {});
  const sc = slackConfig.parse(s?.config ?? {});
  const wUrl = wc.urlEnc ? dec(wc.urlEnc) : null;
  const sUrl = sc.urlEnc ? dec(sc.urlEnc) : null;
  return {
    webhook: {
      isEnabled: w?.isEnabled ?? false,
      includeMessage: wc.includeMessage,
      source: wc.urlEnc ? ("admin" as const) : env.LEADS_WEBHOOK_URL ? ("env" as const) : ("none" as const),
      host: hostOf(wUrl ?? (wc.urlEnc ? null : env.LEADS_WEBHOOK_URL)),
      unreadable: Boolean(wc.urlEnc && !wUrl),
      hasSecret: Boolean(wc.urlEnc ? wc.secretEnc : env.LEADS_WEBHOOK_SECRET),
    },
    slack: {
      isEnabled: s?.isEnabled ?? false,
      mention: sc.mentionOnHighPriority,
      source: sc.urlEnc ? ("admin" as const) : env.SLACK_LEADS_WEBHOOK_URL ? ("env" as const) : ("none" as const),
      host: hostOf(sUrl ?? (sc.urlEnc ? null : env.SLACK_LEADS_WEBHOOK_URL)),
      unreadable: Boolean(sc.urlEnc && !sUrl),
    },
  };
}
export type HookViews = Awaited<ReturnType<typeof getHookViews>>;

const httpUrl = z.string().trim().max(1000).url("Enter the full URL, starting with https://").refine((u) => /^https?:\/\//.test(u), "Use an http(s) URL");

export const webhookInput = z.object({
  isEnabled: z.boolean(),
  includeMessage: z.boolean(),
  /** Blank keeps the stored URL. */
  url: z.union([httpUrl, z.literal("")]).default(""),
  /** Blank keeps the stored secret. */
  secret: z.string().trim().max(200).default(""),
  clearSecret: z.boolean().default(false),
});
export const slackInput = z.object({
  isEnabled: z.boolean(),
  mention: z.string().trim().max(40).regex(/^(|<!channel>|<!here>|<@[A-Z0-9]+>|<!subteam\^[A-Z0-9]+>)$/, "Use <!channel>, <!here> or <@U123ABC>").default(""),
  url: z.union([httpUrl.refine((u) => u.startsWith("https://hooks.slack.com/"), "Slack webhook URLs start with https://hooks.slack.com/"), z.literal("")]).default(""),
});

async function save(user: Principal, key: HookKey, isEnabled: boolean, config: Record<string, unknown>, summary: string) {
  const json = config as Prisma.InputJsonValue;
  await db.$transaction(async (tx) => {
    await tx.integration.upsert({ where: { key }, create: { key, isEnabled, config: json }, update: { isEnabled, config: json } });
    await audit({ actorId: user.id, action: "integration.update", entityType: "integration", entityId: key, summary }, tx);
  });
  revalidateTag("integrations");
}

export async function saveWebhook(user: Principal, input: z.infer<typeof webhookInput>) {
  assertCan(user, "integrations.manage");
  const prev = webhookConfig.parse((await row("webhook.leads"))?.config ?? {});
  const urlEnc = input.url ? encryptSecret(input.url) : prev.urlEnc;
  // The first save from here takes over from .env; carry over its URL/secret if none were entered.
  const fromEnv = !prev.urlEnc && !input.url && env.LEADS_WEBHOOK_URL ? encryptSecret(env.LEADS_WEBHOOK_URL) : "";
  const secretEnc = input.clearSecret ? "" : input.secret ? encryptSecret(input.secret) : prev.secretEnc || (fromEnv && env.LEADS_WEBHOOK_SECRET ? encryptSecret(env.LEADS_WEBHOOK_SECRET) : "");
  if (input.isEnabled && !urlEnc && !fromEnv) throw new AppError("Enter the webhook URL first.", "BAD_REQUEST", { url: ["Enter the URL your CRM or automation tool gave you"] });
  await save(user, "webhook.leads", input.isEnabled, { includeMessage: input.includeMessage, urlEnc: urlEnc || fromEnv, secretEnc }, `${input.isEnabled ? "Enabled" : "Disabled"} ${NAMES["webhook.leads"]}`);
}

export async function saveSlack(user: Principal, input: z.infer<typeof slackInput>) {
  assertCan(user, "integrations.manage");
  const prev = slackConfig.parse((await row("slack.leads"))?.config ?? {});
  const urlEnc = input.url ? encryptSecret(input.url) : prev.urlEnc || (env.SLACK_LEADS_WEBHOOK_URL ? encryptSecret(env.SLACK_LEADS_WEBHOOK_URL) : "");
  if (input.isEnabled && !urlEnc) throw new AppError("Enter the Slack webhook URL first.", "BAD_REQUEST", { url: ["Paste the Incoming Webhook URL from Slack"] });
  await save(user, "slack.leads", input.isEnabled, { mentionOnHighPriority: input.mention, urlEnc }, `${input.isEnabled ? "Enabled" : "Disabled"} ${NAMES["slack.leads"]}`);
}

async function post(url: string, body: string, headers: Record<string, string>, what: string) {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "Cadgram-Webhooks/1", ...headers }, body, signal: AbortSignal.timeout(8000) });
  } catch (e) {
    const reason = (e as { cause?: { code?: string } }).cause?.code ?? (e instanceof Error && e.name === "TimeoutError" ? "no answer within 8 seconds" : (e as Error).message);
    throw new AppError(`Couldn't reach ${hostOf(url) ?? "the URL"} (${reason}).`);
  }
  if (!res.ok) throw new AppError(`${what} answered with HTTP ${res.status}${res.status === 404 ? " — the URL may be wrong or deleted" : res.status === 403 || res.status === 401 ? " — it refused the request" : ""}.`);
}

/** Sends a sample lead to the URL in the form (or the saved one). */
export async function testWebhook(user: Principal, input: z.infer<typeof webhookInput>) {
  assertCan(user, "integrations.manage");
  const saved = webhookConfig.parse((await row("webhook.leads"))?.config ?? {});
  const url = input.url || dec(saved.urlEnc) || env.LEADS_WEBHOOK_URL;
  if (!url) throw new AppError("Enter the webhook URL first.", "BAD_REQUEST", { url: ["Enter a URL to test"] });
  const secret = input.clearSecret ? "" : input.secret || dec(saved.secretEnc) || (saved.urlEnc ? "" : env.LEADS_WEBHOOK_SECRET ?? "");
  const body = JSON.stringify({
    event: "test",
    lead: {
      id: "test", referenceNo: "LD-TEST", name: "Test Lead", email: "test.lead@example.com", phone: "+91 98765 43210", company: "Example Pvt Ltd", companySize: "11-50", city: "Delhi",
      requirement: "This is a test sent from Cadgram Admin → Integrations.", message: input.includeMessage ? "Sample message" : undefined, source: "test", sourceUrl: null,
      utm: { source: null, medium: null, campaign: null }, software: [{ name: "Sample Software", slug: "sample-software" }], createdAt: new Date().toISOString(),
    },
  });
  await post(url, body, secret ? { "X-Cadgram-Signature": signWebhook(secret, body) } : {}, "The webhook");
}

export async function testSlack(user: Principal, input: z.infer<typeof slackInput>) {
  assertCan(user, "integrations.manage");
  const saved = slackConfig.parse((await row("slack.leads"))?.config ?? {});
  const url = input.url || dec(saved.urlEnc) || env.SLACK_LEADS_WEBHOOK_URL;
  if (!url) throw new AppError("Enter the Slack webhook URL first.", "BAD_REQUEST", { url: ["Enter a URL to test"] });
  await post(url, JSON.stringify({ text: `${input.mention ? `${input.mention} ` : ""}:white_check_mark: Test from Cadgram — new enquiries will be posted here.` }), {}, "Slack");
}
