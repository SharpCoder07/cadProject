import { Scale } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { getStoredSettings } from "@/server/settings";
import { can } from "@/server/rbac/policy";
import { PageHeader } from "@/components/admin/page-header";
import { COMPLIANCE_FIELDS } from "@/lib/compliance/settings-fields";
import { SettingsForm } from "../../settings/settings-form";

export const metadata = { title: "Compliance settings" };

/** Compliance & Privacy › Compliance settings: legal entity, contacts, grievance officer and (empty until confirmed) timelines. */
export default async function ComplianceSettingsPage() {
  const user = await requirePermission("compliance.view", "/admin/compliance/settings");
  const settings = await getStoredSettings();
  const c = settings.compliance;
  const editable = can(user, "compliance.manage");
  return (
    <>
      <PageHeader title="Compliance settings" description="Who you are, how people reach you about their data, and the response times you work to. Used by the grievance page, legal documents and request workflows." />
      <div className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm ${c.legalReviewDone ? "border-success/30 bg-success/5" : "border-warning/40 bg-warning/5"}`}>
        <Scale className={`mt-0.5 h-5 w-5 shrink-0 ${c.legalReviewDone ? "text-success" : "text-warning"}`} aria-hidden />
        <div>
          <p className="font-semibold text-ink">{c.legalReviewDone ? "Legal review recorded" : "Needs legal review"}</p>
          <p className="mt-0.5 text-muted">
            Software alone doesn&apos;t make the platform compliant. Which laws apply, their commencement dates and any response deadlines depend on your business model:
            confirm them with an Indian privacy or technology lawyer, then fill in the timelines. Timelines are empty by default and no deadline is assumed.
          </p>
          {c.legalReviewNote && <p className="mt-1 text-ink">{c.legalReviewNote}</p>}
        </div>
      </div>
      {editable ? (
        <SettingsForm settingKey="compliance" fields={COMPLIANCE_FIELDS} initial={c as Record<string, unknown>} />
      ) : (
        <dl className="grid gap-3 rounded-2xl border border-line bg-surface p-5 text-sm sm:grid-cols-2">
          {COMPLIANCE_FIELDS.map((f) => {
            const v = (c as Record<string, unknown>)[f.name];
            return (
              <div key={f.name}>
                <dt className="text-xs font-semibold text-muted">{f.label}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-ink">{typeof v === "boolean" ? (v ? "Yes" : "No") : v === undefined || v === "" ? "—" : String(v)}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </>
  );
}
