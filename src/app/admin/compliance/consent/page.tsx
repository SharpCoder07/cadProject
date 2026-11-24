import { CheckCircle2, ClipboardCheck, EyeOff, ListChecks, Undo2 } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/rbac/policy";
import { getStoredSettings } from "@/server/settings";
import { db } from "@/server/db";
import { consentListQuery, consentStats, listConsents } from "@/server/services/compliance/consent";
import { CONSENT_FIELDS } from "@/lib/compliance/settings-fields";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { ListPanel, PanelEmpty, PanelPagination, SearchField, SelectField, showing } from "@/components/admin/list-panel";
import { SettingsForm } from "../../settings/settings-form";
import { savePurposeAction, togglePurposeAction } from "../actions";

export const metadata = { title: "Consent" };

type SP = { q?: string; purpose?: string; status?: string; source?: string; page?: string };
const SOURCE: Record<string, string> = { signup: "Sign-up", enquiry: "Enquiry", account: "Account settings", admin: "Admin" };
const WHERE: Record<string, string> = { signup: "Sign-up", enquiry: "Enquiry forms", account: "Account settings" };

/** Compliance & Privacy › Consent: purposes (what people agree to) and every consent given or withdrawn. */
export default async function ConsentPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("compliance.view", "/admin/compliance/consent");
  const sp = await searchParams;
  const query = consentListQuery.parse({ ...sp, purpose: sp.purpose || undefined, status: sp.status || undefined, source: sp.source || undefined, q: sp.q || undefined });
  const [purposes, stats, data, settings] = await Promise.all([
    db.consentPurpose.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    consentStats(user),
    listConsents(user, query),
    getStoredSettings(),
  ]);
  const editable = can(user, "compliance.manage");
  const count = (id: string, status: "GRANTED" | "WITHDRAWN") => stats.byPurpose.find((b) => b.purposeId === id && b.status === status)?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Consent"
        description="What people agree to, and a record of every consent given or withdrawn. Optional purposes are never pre-ticked; withdrawing is as easy as giving consent (Account › Settings)."
        actions={editable ? <CrudAddButton entity="purpose" label="Add purpose" /> : undefined}
      />
      <PageStats
        items={[
          { label: "Active consents", value: stats.granted, icon: CheckCircle2, tone: "green", sub: "Currently given" },
          { label: "Given (30 days)", value: stats.granted30, icon: ClipboardCheck, sub: "New consent records" },
          { label: "Withdrawn (30 days)", value: stats.withdrawn30, icon: Undo2, tone: "red", sub: "Closed records" },
          { label: "Purposes", value: purposes.filter((p) => p.isActive).length, icon: ListChecks, sub: `${purposes.filter((p) => !p.isNecessary && p.isActive).length} optional` },
        ]}
      />

      <div className="mb-5 rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-muted">
        <span className="font-semibold text-ink">Legal review: </span>
        whether a purpose needs consent or is part of the service the person asked for (for example, sharing an enquiry with vendors) is a legal
        judgement. The starting purposes are a suggestion: confirm each one, its wording and where it&apos;s shown with your lawyer.
      </div>

      <CrudManager
        addInHeader
        entity="purpose"
        newLabel="Add purpose"
        columns={["Purpose", "Type", "Shown on", "Given", "Withdrawn"]}
        rows={purposes.map((p) => ({
          id: p.id,
          name: p.name,
          active: p.isActive,
          searchText: `${p.name} ${p.key} ${p.description}`,
          cells: [
            <span key="n"><span className="block font-medium text-ink">{p.name}</span><span className="block max-w-md text-xs text-muted">{p.description}</span></span>,
            p.isNecessary ? "Needed for the service" : "Optional consent",
            p.appliesTo.map((a) => WHERE[a] ?? a).join(", ") || "—",
            count(p.id, "GRANTED").toLocaleString("en-IN"),
            count(p.id, "WITHDRAWN").toLocaleString("en-IN"),
          ],
          values: { key: p.key, name: p.name, description: p.description, isNecessary: p.isNecessary, appliesTo: p.appliesTo, sortOrder: p.sortOrder },
        }))}
        fields={[
          { name: "name", label: "Name", type: "text", required: true, hint: "What people see, e.g. “Marketing emails”." },
          { name: "key", label: "Key", type: "text", required: true, hint: "Lower-case, e.g. marketing. Can't change once consent records use it." },
          { name: "description", label: "Description", type: "textarea", required: true, hint: "Plain-language description of what the data is used for. Shown next to the choice." },
          { name: "isNecessary", label: "Needed for the service", type: "switch", hint: "On: shown as information and recorded automatically (no checkbox). Off: an optional, unticked choice." },
          { name: "appliesTo", label: "Shown on", type: "tags", placeholder: "signup, account", hint: "Any of: signup, enquiry, account (comma separated)." },
          { name: "sortOrder", label: "Order", type: "number" },
        ]}
        emptyValues={{ key: "", name: "", description: "", isNecessary: false, appliesTo: ["account"], sortOrder: purposes.length }}
        save={savePurposeAction}
        toggle={editable ? togglePurposeAction : undefined}
        emptyText="No purposes yet. Run npm run db:migrate to add the starting set."
      />

      <div className="mt-6">
        <ListPanel
          title="Consent records"
          meta={`${showing(data.page, 50, data.total)}${data.masked ? " · emails masked" : ""}`}
          actions={data.masked ? <span className="inline-flex items-center gap-1 text-xs text-muted"><EyeOff className="h-3.5 w-3.5" aria-hidden />Needs “view personal data” to see emails</span> : undefined}
          filters={
            <FilterBar action="/admin/compliance/consent" bare>
              <SearchField defaultValue={sp.q} placeholder="Search by email" />
              <SelectField name="purpose" label="Purpose" value={sp.purpose}>
                <option value="">Any purpose</option>
                {purposes.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
              </SelectField>
              <SelectField name="status" label="Status" value={sp.status}>
                <option value="">Any status</option>
                <option value="GRANTED">Given</option>
                <option value="WITHDRAWN">Withdrawn</option>
              </SelectField>
              <SelectField name="source" label="Where" value={sp.source}>
                <option value="">Anywhere</option>
                {Object.entries(SOURCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectField>
            </FilterBar>
          }
          footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/compliance/consent" params={sp} />}
        >
          {data.rows.length === 0 ? (
            <PanelEmpty icon={<ClipboardCheck className="h-5 w-5" />} title="No consent records">Records appear when people sign up, send an enquiry or change their choices.</PanelEmpty>
          ) : (
            <AdminTable bare minWidth={60}>
              <thead>
                <tr><th>Person</th><th>Purpose</th><th>Status</th><th>Given</th><th>Withdrawn</th><th>Where</th><th>Notice</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="font-medium text-ink">{r.email}</span>{r.userId && <span className="block text-xs text-muted">Has an account</span>}</td>
                    <td>{r.purpose.name}</td>
                    <td><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", r.status === "GRANTED" ? "bg-success/10 text-success ring-success/20" : "bg-ink/[0.05] text-ink/70 ring-line")}>{r.status === "GRANTED" ? "Given" : "Withdrawn"}</span></td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(r.grantedAt)}</td>
                    <td className="whitespace-nowrap text-muted">{r.withdrawnAt ? `${formatDateTime(r.withdrawnAt)}${r.withdrawSource ? ` (${SOURCE[r.withdrawSource] ?? r.withdrawSource})` : ""}` : "—"}</td>
                    <td>{SOURCE[r.source] ?? r.source}</td>
                    <td className="text-muted">v{r.noticeVersion}</td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )}
        </ListPanel>
      </div>

      {editable && (
        <section className="mt-6">
          <h2 className="mb-3 text-base font-semibold text-ink">Notice version</h2>
          <SettingsForm settingKey="compliance" fields={CONSENT_FIELDS} initial={settings.compliance as Record<string, unknown>} />
        </section>
      )}
    </>
  );
}
