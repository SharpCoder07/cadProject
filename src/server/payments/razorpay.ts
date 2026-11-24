import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { assertCan, type Principal } from "@/server/rbac/policy";

/**
 * Razorpay credentials, managed in Settings → Payments. Stored in the Integration row
 * "payments.razorpay"; the key secret and webhook secret are encrypted (AES-256-GCM, APP_SECRET).
 */

const KEY = "payments.razorpay";
const API = "https://api.razorpay.com/v1";

const stored = z.object({
  keyId: z.string().default(""),
  keySecretEnc: z.string().default(""),
  webhookSecretEnc: z.string().default(""),
});

export const razorpayInput = z.object({
  keyId: z.union([z.string().trim().regex(/^rzp_(test|live)_[A-Za-z0-9]{8,40}$/, "Key IDs look like rzp_live_… or rzp_test_…"), z.literal("")]),
  /** Blank keeps the stored value. */
  keySecret: z.string().trim().max(200).optional().default(""),
  webhookSecret: z.string().trim().max(200).optional().default(""),
  enabled: z.boolean(),
});

async function load() {
  const row = await db.integration.findUnique({ where: { key: KEY } });
  return { enabled: row?.isEnabled ?? false, config: stored.parse(row?.config ?? {}) };
}

export const modeOf = (keyId: string): "live" | "test" | null => (keyId.startsWith("rzp_live_") ? "live" : keyId.startsWith("rzp_test_") ? "test" : null);

/** Safe view for the admin form. */
export async function getRazorpaySettings() {
  const { enabled, config } = await load();
  return {
    enabled,
    keyId: config.keyId,
    mode: modeOf(config.keyId),
    hasKeySecret: Boolean(config.keySecretEnc),
    keySecretReadable: !config.keySecretEnc || decryptSecret(config.keySecretEnc) !== null,
    hasWebhookSecret: Boolean(config.webhookSecretEnc),
  };
}

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  mode: "live" | "test" | null;
}

/** Usable credentials, or null when payments are switched off or incomplete. */
export async function getRazorpayCredentials(): Promise<RazorpayCredentials | null> {
  const { enabled, config } = await load();
  if (!enabled || !config.keyId || !config.keySecretEnc) return null;
  const keySecret = decryptSecret(config.keySecretEnc);
  if (!keySecret) return null;
  return { keyId: config.keyId, keySecret, webhookSecret: config.webhookSecretEnc ? decryptSecret(config.webhookSecretEnc) : null, mode: modeOf(config.keyId) };
}

/** Webhook secret only (webhooks are verified even if checkout is switched off). */
export async function getWebhookSecret(): Promise<string | null> {
  const { config } = await load();
  return config.webhookSecretEnc ? decryptSecret(config.webhookSecretEnc) : null;
}

export async function saveRazorpaySettings(user: Principal, raw: unknown) {
  assertCan(user, "billing.manage");
  const input = razorpayInput.parse(raw);
  const { config } = await load();
  if (input.enabled && (!input.keyId || (!input.keySecret && !config.keySecretEnc))) {
    throw new AppError("Enter the Key ID and Key secret before switching payments on.", "BAD_REQUEST", { keyId: input.keyId ? [] : ["Required"], keySecret: ["Required"] });
  }
  const next = {
    keyId: input.keyId,
    keySecretEnc: input.keySecret ? encryptSecret(input.keySecret) : config.keySecretEnc,
    webhookSecretEnc: input.webhookSecret ? encryptSecret(input.webhookSecret) : config.webhookSecretEnc,
  };
  await db.integration.upsert({
    where: { key: KEY },
    create: { key: KEY, isEnabled: input.enabled, config: next as Prisma.InputJsonValue },
    update: { isEnabled: input.enabled, config: next as Prisma.InputJsonValue },
  });
  await audit({
    actorId: user.id,
    action: "payments.razorpay_update",
    entityType: "integration",
    entityId: KEY,
    summary: `Razorpay ${input.enabled ? "on" : "off"} (${modeOf(input.keyId) ?? "no key"})${input.keySecret ? ", key secret changed" : ""}${input.webhookSecret ? ", webhook secret changed" : ""}`,
  });
}

function authHeader(keyId: string, keySecret: string) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

async function call<T>(creds: { keyId: string; keySecret: string }, method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: authHeader(creds.keyId, creds.keySecret), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new AppError("Couldn't reach Razorpay. Check the server's internet connection and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } } & T;
  if (res.status === 401) throw new AppError("Razorpay rejected the Key ID or Key secret.");
  if (!res.ok) throw new AppError(`Razorpay: ${json.error?.description ?? `request failed (${res.status})`}`);
  return json;
}

/** Checks the keys with a harmless read. Uses the stored secret when the field is blank. */
export async function testRazorpay(user: Principal, raw: unknown): Promise<string> {
  assertCan(user, "billing.manage");
  const input = razorpayInput.parse(raw);
  const { config } = await load();
  const keySecret = input.keySecret || (config.keySecretEnc ? decryptSecret(config.keySecretEnc) : null);
  if (!input.keyId || !keySecret) throw new AppError("Enter the Key ID and Key secret first.");
  await call({ keyId: input.keyId, keySecret }, "GET", "/orders?count=1");
  return modeOf(input.keyId) === "live" ? "Connected to Razorpay (live mode)." : "Connected to Razorpay (test mode — no real money moves).";
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export const createOrder = (creds: RazorpayCredentials, input: { amountPaise: number; receipt: string; notes: Record<string, string> }) =>
  call<RazorpayOrder>(creds, "POST", "/orders", { amount: input.amountPaise, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes });

export interface RazorpayPayment {
  id: string;
  order_id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
}

export const fetchPayment = (creds: RazorpayCredentials, paymentId: string) => call<RazorpayPayment>(creds, "GET", `/payments/${encodeURIComponent(paymentId)}`);

/** For accounts without automatic capture: settles an authorized payment so it isn't auto-refunded. */
export const capturePayment = (creds: RazorpayCredentials, paymentId: string, amountPaise: number) =>
  call<RazorpayPayment>(creds, "POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: "INR" });
