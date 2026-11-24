import "server-only";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";

export interface RateLimitRule {
  /** Logical bucket, e.g. "login:ip". */
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RULES = {
  loginIp: { name: "login:ip", limit: 20, windowSeconds: 15 * 60 },
  loginEmail: { name: "login:email", limit: 8, windowSeconds: 15 * 60 },
  lead: { name: "lead:ip", limit: 6, windowSeconds: 60 * 60 },
  review: { name: "review:ip", limit: 4, windowSeconds: 60 * 60 },
  question: { name: "question:ip", limit: 6, windowSeconds: 60 * 60 },
  search: { name: "search:ip", limit: 120, windowSeconds: 60 },
  passwordReset: { name: "reset:ip", limit: 5, windowSeconds: 60 * 60 },
  passwordChange: { name: "pwchange:user", limit: 5, windowSeconds: 15 * 60 },
  /** Two-step verification: 6 code checks per person every 15 minutes (reset after a correct code). */
  twoFactor: { name: "2fa:user", limit: 6, windowSeconds: 15 * 60 },
  /** Buyer sign-ups and confirmation-link resends. */
  signup: { name: "signup:ip", limit: 5, windowSeconds: 60 * 60 },
  verifyResend: { name: "verify-resend:user", limit: 3, windowSeconds: 60 * 60 },
  /** Importing files from a pasted link (the server downloads them). */
  urlImport: { name: "url-import:user", limit: 30, windowSeconds: 10 * 60 },
  /** Browser error reports (Error logs): 30 per network every 10 minutes. */
  errorReport: { name: "error-report:ip", limit: 30, windowSeconds: 10 * 60 },
  /** Cookie banner choices: 30 per network every 10 minutes. */
  cookieConsent: { name: "cookie-consent:ip", limit: 30, windowSeconds: 10 * 60 },
  /** Consent switches in Account › Settings. */
  consentChange: { name: "consent:user", limit: 30, windowSeconds: 10 * 60 },
  /** Data requests and complaints from the Privacy center: 5 per network an hour. */
  privacyCase: { name: "privacy-case:ip", limit: 5, windowSeconds: 60 * 60 },
  /** "Download my data": 5 per person an hour. */
  dataExport: { name: "data-export:user", limit: 5, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Fixed-window counter stored in Postgres, so it holds across serverless
 * instances without extra infrastructure. One atomic upsert per call.
 */
export async function hit(rule: RateLimitRule, identifier: string): Promise<RateLimitResult> {
  const key = `${rule.name}:${identifier}`;
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${rule.windowSeconds}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" < now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" < now() THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0] ?? { count: 1, resetAt: new Date(Date.now() + rule.windowSeconds * 1000) };
  return { ok: row.count <= rule.limit, remaining: Math.max(0, rule.limit - row.count), resetAt: row.resetAt };
}

export async function enforce(rule: RateLimitRule, identifier: string | null, message = "Too many attempts. Please try again later."): Promise<void> {
  const result = await hit(rule, identifier ?? "unknown");
  if (!result.ok) throw new AppError(message, "RATE_LIMITED");
}

export const resetBucket = (rule: RateLimitRule, identifier: string) =>
  db.rateLimitBucket.deleteMany({ where: { key: `${rule.name}:${identifier}` } });

/** Housekeeping, called from the cron route. */
export const purgeExpiredBuckets = () => db.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
