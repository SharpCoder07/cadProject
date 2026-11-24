import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { getSettings } from "@/server/settings";
import { TEMPLATES, TEMPLATE_KEYS, escapeHtml, fillTokens, htmlToText, wrapEmail, type TemplateKey } from "./templates";

/**
 * Email delivery settings managed in Settings → Email settings.
 * When an SMTP host is saved here it takes over from the EMAIL_DRIVER/SMTP_* environment
 * variables. The SMTP password is stored encrypted (AES-256-GCM, key from APP_SECRET).
 */

const SMTP_KEY = "email.smtp";
const TEMPLATES_KEY = "email.templates";

export const ENCRYPTIONS = ["ssl", "starttls", "none"] as const;
export type Encryption = (typeof ENCRYPTIONS)[number];

const stored = z.object({
  host: z.string().default(""),
  port: z.number().int().default(587),
  username: z.string().default(""),
  passwordEnc: z.string().default(""),
  encryption: z.enum(ENCRYPTIONS).default("starttls"),
  fromName: z.string().default(""),
  fromAddress: z.string().default(""),
  replyTo: z.string().default(""),
});
type Stored = z.infer<typeof stored>;

export const smtpInput = z.object({
  host: z.string().trim().max(200).regex(/^[A-Za-z0-9.-]*$/, "Use a host name like mail.example.com"),
  port: z.coerce.number().int().min(1, "Port 1–65535").max(65535, "Port 1–65535"),
  username: z.string().trim().max(200),
  /** Blank keeps the stored password. */
  password: z.string().max(500).optional().default(""),
  clearPassword: z.boolean().optional().default(false),
  encryption: z.enum(ENCRYPTIONS),
  fromName: z.string().trim().min(1, "Enter a sender name").max(100),
  fromAddress: z.union([z.string().trim().toLowerCase().email("Enter a valid email address"), z.literal("")]),
  replyTo: z.union([z.string().trim().toLowerCase().email("Enter a valid email address"), z.literal("")]),
  enabled: z.boolean(),
});
export type SmtpInput = z.infer<typeof smtpInput>;

async function loadSmtpRow() {
  const row = await db.integration.findUnique({ where: { key: SMTP_KEY } });
  return { enabled: row?.isEnabled ?? false, config: stored.parse(row?.config ?? {}), exists: Boolean(row) };
}

/** Safe view for the admin form: never includes the password. */
export async function getSmtpSettings() {
  const { enabled, config, exists } = await loadSmtpRow();
  return {
    exists,
    enabled,
    host: config.host,
    port: config.port,
    username: config.username,
    encryption: config.encryption,
    fromName: config.fromName,
    fromAddress: config.fromAddress,
    replyTo: config.replyTo,
    hasPassword: Boolean(config.passwordEnc),
    passwordReadable: !config.passwordEnc || decryptSecret(config.passwordEnc) !== null,
  };
}

export interface TransportConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTLS: boolean;
  ignoreTLS: boolean;
  auth?: { user: string; pass: string };
  from: string;
  replyTo?: string;
}

/**
 * "localhost" can resolve to the IPv6 address ::1 first, while local mail catchers such as Mailpit
 * (`npm run mail`) listen on IPv4 127.0.0.1 only — connect over IPv4 so both work.
 */
export const smtpHost = (host: string | undefined) => (host?.trim().toLowerCase() === "localhost" ? "127.0.0.1" : host);

function toTransport(c: Stored, password: string | null): TransportConfig {
  const fromAddress = c.fromAddress || (c.username.includes("@") ? c.username : "");
  const name = c.fromName.replace(/"/g, "");
  return {
    host: smtpHost(c.host) ?? c.host,
    port: c.port,
    secure: c.encryption === "ssl",
    requireTLS: c.encryption === "starttls",
    ignoreTLS: c.encryption === "none",
    auth: c.username ? { user: c.username, pass: password ?? "" } : undefined,
    from: fromAddress ? `"${name || fromAddress}" <${fromAddress}>` : name,
    replyTo: c.replyTo || undefined,
  };
}

/** What sendEmail() should do: use saved SMTP, send nothing (switched off), or fall back to environment settings. */
export async function resolveDelivery(): Promise<{ mode: "db"; transport: TransportConfig } | { mode: "off" } | { mode: "env" }> {
  const { enabled, config } = await loadSmtpRow();
  if (!config.host) return { mode: "env" };
  if (!enabled) return { mode: "off" };
  const password = config.passwordEnc ? decryptSecret(config.passwordEnc) : null;
  if (config.passwordEnc && password === null) throw new Error("The stored SMTP password can't be decrypted (APP_SECRET changed?). Enter it again in Email settings.");
  return { mode: "db", transport: toTransport(config, password) };
}

async function buildFromInput(input: SmtpInput): Promise<{ next: Stored; password: string | null }> {
  const { config } = await loadSmtpRow();
  const password = input.clearPassword ? null : input.password ? input.password : config.passwordEnc ? decryptSecret(config.passwordEnc) : null;
  const next: Stored = {
    host: input.host,
    port: input.port,
    username: input.username,
    passwordEnc: input.clearPassword ? "" : input.password ? encryptSecret(input.password) : config.passwordEnc,
    encryption: input.encryption,
    fromName: input.fromName,
    fromAddress: input.fromAddress,
    replyTo: input.replyTo,
  };
  return { next, password };
}

export async function saveSmtpSettings(user: Principal, raw: unknown) {
  assertCan(user, "integrations.manage");
  const input = smtpInput.parse(raw);
  if (input.enabled && !input.host) throw new AppError("Enter the SMTP host before turning sending on.", "BAD_REQUEST", { host: ["Required"] });
  const { next } = await buildFromInput(input);
  await db.integration.upsert({ where: { key: SMTP_KEY }, create: { key: SMTP_KEY, isEnabled: input.enabled, config: next as Prisma.InputJsonValue }, update: { isEnabled: input.enabled, config: next as Prisma.InputJsonValue } });
  // The audit entry never contains the password, only whether it changed.
  const { passwordEnc: _omit, ...safe } = next;
  void _omit;
  await audit({ actorId: user.id, action: "email.smtp_update", entityType: "integration", entityId: SMTP_KEY, summary: `SMTP ${input.enabled ? "on" : "off"}: ${input.host || "—"}:${input.port}${input.password ? " (password changed)" : ""}`, diff: safe });
}

/** Friendly explanations for the usual SMTP failures. */
export function explainSmtpError(e: unknown, host: string, port: number): string {
  const err = e as { code?: string; responseCode?: number; message?: string };
  const msg = err?.message ?? String(e);
  if (err.code === "EAUTH" || err.responseCode === 535) return "The server rejected the username or password. Check them (for Gmail or Google Workspace, use an app password).";
  if (err.code === "EDNS" || /ENOTFOUND|EAI_AGAIN/.test(msg)) return `Couldn't find the host “${host}”. Check the spelling.`;
  if (/ECONNREFUSED/.test(msg)) {
    if (/^(localhost|127\.0\.0\.1|::1)$/i.test(host)) return `Nothing is accepting email on ${host}:${port} on this computer. If you're testing with Mailpit, start it with "npm run mail" and keep that window open.`;
    return `${host} refused the connection on port ${port}. Check the port.`;
  }
  if (err.code === "ETIMEDOUT" || /timed? ?out/i.test(msg)) return `No reply from ${host}:${port}. The port may be blocked by a firewall, or wrong for this encryption.`;
  if (/wrong version number|ssl3_get_record|WRONG_VERSION/i.test(msg)) return "Encryption mismatch. Use SSL/TLS with port 465, or STARTTLS with port 587.";
  if (/self[- ]signed|certificate/i.test(msg)) return "The server's security certificate isn't trusted. Check the host name matches the certificate.";
  return msg.slice(0, 300);
}

async function transportFor(t: TransportConfig) {
  const nodemailer = await import("nodemailer");
  return nodemailer.createTransport({
    host: t.host,
    port: t.port,
    secure: t.secure,
    requireTLS: t.requireTLS,
    ignoreTLS: t.ignoreTLS,
    auth: t.auth,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

/** Checks the settings in the form (blank password = the stored one) without saving them. */
export async function testSmtpConnection(user: Principal, raw: unknown) {
  assertCan(user, "integrations.manage");
  const input = smtpInput.parse(raw);
  if (!input.host) throw new AppError("Enter the SMTP host first.", "BAD_REQUEST", { host: ["Required"] });
  const { next, password } = await buildFromInput(input);
  if (next.passwordEnc && password === null) throw new AppError("The stored password can't be read. Enter it again.");
  try {
    await (await transportFor(toTransport(next, password))).verify();
  } catch (e) {
    throw new AppError(explainSmtpError(e, input.host, input.port));
  }
}

/** Sends a real message through the saved delivery path (SMTP here, or the environment fallback). */
export async function sendTestEmail(user: Principal, to: string) {
  assertCan(user, "integrations.manage");
  const { sendEmail } = await import("./index");
  const site = (await getSettings()).site.name;
  const html = wrapEmail(`<p>This is a test email from <strong>${escapeHtml(site)}</strong>.</p><p>If you can read this, email delivery works end to end.</p>`, site);
  const r = await sendEmail({ to, subject: `Test email from ${site}`, html, text: htmlToText(html) });
  if (!r.delivered) throw new AppError(r.reason ?? "Nothing was sent.");
  await audit({ actorId: user.id, action: "email.test", entityType: "integration", entityId: SMTP_KEY, summary: `Sent a test email to ${to}` });
  return r;
}

// ─── Templates ───────────────────────────────────────────────────────────────

const templateOverride = z.object({ subject: z.string().max(300), html: z.string().max(20_000), active: z.boolean() }).partial();
const overrides = z.record(z.string(), templateOverride).catch({});

async function loadOverrides() {
  const row = await db.integration.findUnique({ where: { key: TEMPLATES_KEY } });
  return overrides.parse(row?.config ?? {});
}

export async function getTemplates() {
  const o = await loadOverrides();
  return TEMPLATE_KEYS.map((key) => {
    const def = TEMPLATES[key];
    const ov = o[key] ?? {};
    return {
      key,
      name: def.name,
      recipients: def.recipients,
      tokens: def.tokens,
      required: Boolean(def.required),
      subject: ov.subject ?? def.subject,
      html: ov.html ?? def.html,
      active: def.required ? true : ov.active ?? true,
      customised: Boolean(ov.subject !== undefined || ov.html !== undefined),
    };
  });
}

export const templateInput = z.object({
  key: z.enum(TEMPLATE_KEYS),
  subject: z.string().trim().min(1, "Enter a subject").max(300),
  html: z.string().trim().min(1, "Enter the email body").max(20_000),
  active: z.boolean(),
});

export async function saveTemplate(user: Principal, raw: unknown) {
  assertCan(user, "integrations.manage");
  const t = templateInput.parse(raw);
  const o = await loadOverrides();
  o[t.key] = { subject: t.subject, html: t.html, active: TEMPLATES[t.key].required ? true : t.active };
  await db.integration.upsert({ where: { key: TEMPLATES_KEY }, create: { key: TEMPLATES_KEY, isEnabled: true, config: o as Prisma.InputJsonValue }, update: { config: o as Prisma.InputJsonValue } });
  await audit({ actorId: user.id, action: "email.template_update", entityType: "integration", entityId: TEMPLATES_KEY, summary: `Updated “${TEMPLATES[t.key].name}” template${t.active ? "" : " (turned off)"}` });
}

export async function resetTemplate(user: Principal, key: TemplateKey) {
  assertCan(user, "integrations.manage");
  const o = await loadOverrides();
  delete o[key];
  await db.integration.upsert({ where: { key: TEMPLATES_KEY }, create: { key: TEMPLATES_KEY, isEnabled: true, config: o as Prisma.InputJsonValue }, update: { config: o as Prisma.InputJsonValue } });
  await audit({ actorId: user.id, action: "email.template_reset", entityType: "integration", entityId: TEMPLATES_KEY, summary: `Reset “${TEMPLATES[key].name}” to the default` });
}

/** Builds subject/html/text for a template; `active` is false when an optional template is switched off. */
export async function renderEmail(key: TemplateKey, vars: Record<string, string>) {
  const [o, settings] = await Promise.all([loadOverrides(), getSettings()]);
  const def = TEMPLATES[key];
  const ov = o[key] ?? {};
  const all = { site_name: settings.site.name, ...vars };
  const subject = fillTokens(ov.subject ?? def.subject, all, "text").replace(/\s+/g, " ").trim();
  const html = wrapEmail(fillTokens(ov.html ?? def.html, all, "html"), settings.site.name);
  return { subject, html, text: htmlToText(html), active: def.required ? true : ov.active ?? true };
}

/** Renders and sends a template. Returns whether it was delivered (false when off or switched off). */
export async function sendTemplate(key: TemplateKey, to: string | string[], vars: Record<string, string>, opts: { replyTo?: string } = {}) {
  const r = await renderEmail(key, vars);
  if (!r.active) return { delivered: false, reason: "Template is switched off" };
  const { sendEmail } = await import("./index");
  return sendEmail({ to, subject: r.subject, html: r.html, text: r.text, replyTo: opts.replyTo });
}
