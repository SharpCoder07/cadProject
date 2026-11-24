import { Archive } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/rbac/policy";
import { listRetentionRules } from "@/server/services/compliance/retention";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { RuleRow } from "./rule-row";

export const metadata = { title: "Data retention" };

/** Compliance & Privacy › Data retention: how long each kind of personal data is kept. */
export default async function RetentionPage() {
  const user = await requirePermission("compliance.view", "/admin/compliance/retention");
  const rules = await listRetentionRules(user);
  const editable = can(user, "compliance.manage");
  return (
    <>
      <PageHeader title="Data retention" description="How long each kind of personal data is kept. Switched-on rules run once a day (with the scheduled jobs); every run is written to the audit log." />
      <div className="mb-5 rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-muted">
        <span className="font-semibold text-ink">Legal review: </span>
        no period is assumed and every rule starts switched off. Periods depend on your obligations (tax, consumer, IT and data protection rules, disputes):
        agree each one with your lawyer. Backups keep removed data until they expire (System › Backup & restore).
      </div>
      <section className="rounded-2xl border border-line bg-surface">
        <h2 className="flex items-center gap-2 border-b border-line px-5 py-3 text-sm font-semibold text-ink"><Archive className="h-4 w-4 text-primary" aria-hidden />Rules</h2>
        {rules.length === 0 ? (
          <p className="p-5 text-sm text-muted">No rules yet. Run npm run db:migrate to add them.</p>
        ) : (
          <ul className="divide-y divide-line">
            {rules.map((r) => (
              <RuleRow
                key={r.id + r.updatedAt.toISOString()}
                editable={editable}
                r={{ id: r.id, name: r.name, description: r.description, action: r.action, retentionDays: r.retentionDays, isActive: r.isActive, legalReviewed: r.legalReviewed, legalNote: r.legalNote, minDays: r.minDays, dueNow: r.dueNow, lastRun: r.lastRunAt ? formatDateTime(r.lastRunAt) : null, lastRunCount: r.lastRunCount }}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
