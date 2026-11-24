import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { getBackupConfig } from "@/server/system/backup-config";

export type CheckStatus = "ok" | "attention" | "manual";
export interface SecurityCheck { key: string; title: string; status: CheckStatus; detail: string }

/**
 * Security controls, checked against the running system where that's possible. "manual" means it depends on
 * your hosting or processes and can't be verified from inside the app.
 */
export async function securityChecks(user: Principal): Promise<SecurityCheck[]> {
  assertCan(user, "compliance.view");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [no2fa, blocked, trigger, backups] = await Promise.all([
    db.user.count({ where: { status: "ACTIVE", totpEnabledAt: null, role: { key: { not: "BUYER" } } } }),
    db.auditLog.count({ where: { action: "auth.ip_blocked", createdAt: { gte: since } } }),
    db.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM pg_trigger WHERE tgname = 'AuditLog_protect'`.then((r) => Number(r[0]?.n ?? 0)).catch(() => 0),
    getBackupConfig().catch(() => null),
  ]);
  const https = env.APP_URL.startsWith("https://");
  const prod = process.env.NODE_ENV === "production";
  return [
    {
      key: "2fa",
      title: "Two-step sign-in for staff, vendors and resellers",
      status: no2fa ? "attention" : "ok",
      detail: no2fa
        ? `Required at every sign-in (authenticator app). ${no2fa} active non-buyer account${no2fa === 1 ? " hasn't" : "s haven't"} finished setting it up yet; they're asked to at their next sign-in.`
        : "Required at every sign-in (authenticator app); every active staff and partner account has it set up.",
    },
    { key: "passwords", title: "Password storage", status: "ok", detail: "Hashed with Argon2id (OWASP parameters); passwords are never stored or logged in plain text, and must meet the password rules." },
    { key: "lockout", title: "Sign-in protection", status: "ok", detail: `Accounts lock after repeated wrong passwords and networks are blocked after further tries. ${blocked} network block${blocked === 1 ? "" : "s"} in the last 30 days.` },
    { key: "ratelimit", title: "Rate limiting", status: "ok", detail: "Forms, sign-in and APIs are rate limited per visitor." },
    { key: "sessions", title: "Session cookies", status: prod ? "ok" : "manual", detail: `HttpOnly, SameSite=Lax${prod ? ", Secure" : "; the Secure flag switches on in production"}, server-side sessions that can be signed out from Admin › Users.` },
    { key: "transit", title: "Encryption in transit (HTTPS)", status: https ? "ok" : "attention", detail: https ? `The site address is ${env.APP_URL}.` : `The site address (APP_URL) is ${env.APP_URL}. Use https:// in production.` },
    { key: "rest", title: "Encryption at rest", status: "manual", detail: "Two-step secrets and stored storage keys are encrypted (AES-256-GCM). Database and file-storage disk encryption depend on your hosting: confirm it's on with your provider." },
    { key: "input", title: "Input validation, SQL injection and XSS", status: "ok", detail: "Every form and API is validated on the server; database queries are parameterised; rich text is sanitised before it's shown." },
    { key: "uploads", title: "File uploads", status: "ok", detail: `File type is detected from the content (not the name), only allowed types are kept, and files are limited to ${env.MAX_UPLOAD_MB} MB.` },
    {
      key: "backups",
      title: "Backups",
      status: backups?.schedule.enabled ? "ok" : "attention",
      detail: backups?.schedule.enabled
        ? `Scheduled ${backups.schedule.frequency} backups (${backups.schedule.scope}), stored ${backups.destination.kind === "azure" ? "in Azure Blob storage" : "on the server"}. Document how long backups keep deleted personal data in your retention policy.`
        : "Scheduled backups are off. Turn them on in System › Backup & restore.",
    },
    {
      key: "audit",
      title: "Audit log protection",
      status: trigger ? "ok" : "attention",
      detail: trigger ? "The database refuses edits and deletions of audit records, for every admin including the Super Admin." : "Protection isn't active yet: run the latest database migration (npm run db:migrate).",
    },
  ];
}

const CATEGORY: Record<string, string[]> = {
  signin: ["auth."],
  access: ["roles.", "users.", "user."],
  privacy: ["privacy.", "consent.", "cookies.", "compliance."],
  settings: ["settings."],
};
export const COMPLIANCE_CATEGORIES = [
  { key: "", label: "All security & privacy" },
  { key: "signin", label: "Sign-ins" },
  { key: "access", label: "Users, roles & permissions" },
  { key: "privacy", label: "Privacy & compliance" },
  { key: "settings", label: "Settings changes" },
] as const;

/** Security- and privacy-relevant audit events (sign-ins, permission changes, privacy actions, settings). */
export async function listComplianceAudit(user: Principal, opts: { category?: string; result?: string; from?: string; to?: string; page?: number }) {
  assertCan(user, "compliance.view");
  const page = Math.max(1, opts.page ?? 1);
  const prefixes = opts.category && CATEGORY[opts.category] ? CATEGORY[opts.category]! : Object.values(CATEGORY).flat();
  const and: Prisma.AuditLogWhereInput[] = [{ OR: prefixes.map((p) => ({ action: { startsWith: p } })) }];
  if (opts.result && ["success", "failure", "denied"].includes(opts.result)) and.push({ result: opts.result });
  const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00+05:30`) : null);
  const from = day(opts.from);
  const to = day(opts.to);
  if (from) and.push({ createdAt: { gte: from } });
  if (to) and.push({ createdAt: { lt: new Date(to.getTime() + 86_400_000) } });
  const where: Prisma.AuditLogWhereInput = { AND: and };
  const [total, items] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { name: true, email: true } } } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 50)) };
}

/** Last 30 days at a glance. */
export async function securitySummary(user: Principal) {
  assertCan(user, "compliance.view");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [failed, roleChanges, privacyViews, settingsChanges] = await Promise.all([
    db.auditLog.count({ where: { result: { in: ["failure", "denied"] }, action: { startsWith: "auth." }, createdAt: { gte: since } } }),
    db.auditLog.count({ where: { OR: [{ action: { startsWith: "roles." } }, { action: { contains: "role" } }], createdAt: { gte: since } } }),
    db.auditLog.count({ where: { action: "privacy.record_view", createdAt: { gte: since } } }),
    db.auditLog.count({ where: { action: "settings.update", createdAt: { gte: since } } }),
  ]);
  return { failed, roleChanges, privacyViews, settingsChanges };
}
