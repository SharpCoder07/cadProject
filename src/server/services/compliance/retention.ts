import "server-only";
import { z } from "zod";
import { db, type Tx } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";

const REMOVED = "[Removed after the retention period]";
const REMOVED_EMAIL = "removed@erased.invalid";
const DAY = 86_400_000;

/** Lets this transaction remove protected history (audit log, case events), as retention allows. */
const allowPurge = (tx: Tx) => tx.$executeRaw`SELECT set_config('app.audit_purge', 'on', true)`;

interface Job {
  /** Shortest period allowed, so a typo can't wipe recent records. */
  minDays: number;
  count: (cutoff: Date) => Promise<number>;
  run: (cutoff: Date) => Promise<number>;
}

/** The built-in retention jobs (one per RetentionRule key). */
export const RETENTION_JOBS: Record<string, Job> = {
  privacy_unconfirmed: {
    minDays: 7,
    count: (cutoff) => db.privacyCase.count({ where: { status: "PENDING_VERIFICATION", createdAt: { lt: cutoff } } }),
    run: (cutoff) =>
      db.$transaction(async (tx) => {
        const ids = (await tx.privacyCase.findMany({ where: { status: "PENDING_VERIFICATION", createdAt: { lt: cutoff } }, select: { id: true }, take: 5000 })).map((c) => c.id);
        if (!ids.length) return 0;
        await allowPurge(tx);
        await tx.privacyCaseEvent.deleteMany({ where: { caseId: { in: ids } } });
        return (await tx.privacyCase.deleteMany({ where: { id: { in: ids } } })).count;
      }),
  },
  privacy_closed: {
    minDays: 30,
    count: (cutoff) => db.privacyCase.count({ where: { status: { in: ["RESOLVED", "REJECTED", "CLOSED"] }, resolvedAt: { lt: cutoff }, NOT: { details: REMOVED } } }),
    run: async (cutoff) =>
      (await db.privacyCase.updateMany({
        where: { status: { in: ["RESOLVED", "REJECTED", "CLOSED"] }, resolvedAt: { lt: cutoff }, NOT: { details: REMOVED } },
        data: { name: "Removed", email: REMOVED_EMAIL, phone: null, details: REMOVED, userId: null, ipHash: null },
      })).count,
  },
  lead_contact: {
    minDays: 30,
    count: (cutoff) => db.lead.count({ where: { createdAt: { lt: cutoff }, NOT: { email: REMOVED_EMAIL } } }),
    run: async (cutoff) =>
      (await db.lead.updateMany({
        where: { createdAt: { lt: cutoff }, NOT: { email: REMOVED_EMAIL } },
        data: { name: "Removed", email: REMOVED_EMAIL, phone: "", company: null, city: null, message: null, ipHash: null, userAgent: null },
      })).count,
  },
  cookie_choices: {
    minDays: 30,
    count: (cutoff) => db.cookiePreference.count({ where: { createdAt: { lt: cutoff } } }),
    run: async (cutoff) => (await db.cookiePreference.deleteMany({ where: { createdAt: { lt: cutoff } } })).count,
  },
  audit_log: {
    minDays: 90,
    count: (cutoff) => db.auditLog.count({ where: { createdAt: { lt: cutoff } } }),
    run: (cutoff) =>
      db.$transaction(async (tx) => {
        await allowPurge(tx);
        return (await tx.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } })).count;
      }),
  },
};

const cutoffFor = (days: number, now = Date.now()) => new Date(now - days * DAY);

export async function listRetentionRules(user: Principal) {
  assertCan(user, "compliance.view");
  const rules = await db.retentionRule.findMany({ orderBy: { createdAt: "asc" } });
  // How many records each rule would act on today (for rules with a period).
  const due = await Promise.all(rules.map((r) => (r.retentionDays && RETENTION_JOBS[r.key] ? RETENTION_JOBS[r.key]!.count(cutoffFor(r.retentionDays)).catch(() => null) : Promise.resolve(null))));
  return rules.map((r, i) => ({ ...r, dueNow: due[i] ?? null, minDays: RETENTION_JOBS[r.key]?.minDays ?? 1, supported: Boolean(RETENTION_JOBS[r.key]) }));
}

export const retentionRuleInput = z.object({
  retentionDays: z.coerce.number().int().min(1).max(36_500).nullable(),
  isActive: z.boolean(),
  legalReviewed: z.boolean(),
  legalNote: z.string().trim().max(1000).nullable().optional(),
});

export async function saveRetentionRule(user: Principal, id: string, data: z.infer<typeof retentionRuleInput>) {
  assertCan(user, "compliance.manage");
  const rule = await db.retentionRule.findUnique({ where: { id } });
  if (!rule) throw notFound("Retention rule");
  const job = RETENTION_JOBS[rule.key];
  if (data.retentionDays && job && data.retentionDays < job.minDays) throw new AppError(`Keep this for at least ${job.minDays} days.`, "BAD_REQUEST", { retentionDays: [`At least ${job.minDays} days`] });
  if (data.isActive && !data.retentionDays) throw new AppError("Set a period before switching the rule on.", "BAD_REQUEST", { retentionDays: ["Required to switch on"] });
  await db.retentionRule.update({ where: { id }, data: { retentionDays: data.retentionDays, isActive: data.isActive, legalReviewed: data.legalReviewed, legalNote: data.legalNote || null, updatedById: user.id } });
  await audit({
    actorId: user.id,
    action: "compliance.retention_rule_updated",
    entityType: "retentionRule",
    entityId: id,
    summary: `${rule.name}: ${data.retentionDays ? `${data.retentionDays} days` : "no period"}, ${data.isActive ? "on" : "off"}${data.legalReviewed ? "" : " (not legally reviewed)"}`,
    diff: { before: { retentionDays: rule.retentionDays, isActive: rule.isActive, legalReviewed: rule.legalReviewed }, after: data },
  });
}

async function runRule(rule: { id: string; key: string; name: string; action: string; retentionDays: number | null }, actorId: string | null) {
  const job = RETENTION_JOBS[rule.key];
  if (!job || !rule.retentionDays) return 0;
  const days = Math.max(rule.retentionDays, job.minDays);
  const n = await job.run(cutoffFor(days));
  await db.retentionRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date(), lastRunCount: n } });
  await audit({ actorId, action: "compliance.retention_run", entityType: "retentionRule", entityId: rule.id, summary: `${rule.name}: ${n} record${n === 1 ? "" : "s"} ${rule.action === "anonymise" ? "anonymised" : "deleted"} (older than ${days} days)`, metadata: { count: n, days } });
  return n;
}

/** "Run now" in Admin › Retention (only switched-on rules). */
export async function runRetentionRuleNow(user: Principal, id: string) {
  assertCan(user, "compliance.manage");
  const rule = await db.retentionRule.findUnique({ where: { id } });
  if (!rule) throw notFound("Retention rule");
  if (!rule.isActive || !rule.retentionDays) throw new AppError("Switch the rule on (with a period) first.", "BAD_REQUEST");
  return runRule(rule, user.id);
}

/** Daily from /api/cron: every switched-on rule that hasn't run in the last 23 hours. */
export async function runDueRetention(): Promise<Record<string, number>> {
  const since = new Date(Date.now() - 23 * 60 * 60 * 1000);
  const rules = await db.retentionRule.findMany({ where: { isActive: true, retentionDays: { not: null }, OR: [{ lastRunAt: null }, { lastRunAt: { lt: since } }] } });
  const out: Record<string, number> = {};
  for (const r of rules) {
    try {
      out[r.key] = await runRule(r, null);
    } catch (e) {
      console.error("[retention] failed", r.key, e);
    }
  }
  return out;
}
