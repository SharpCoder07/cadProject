import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardCheck, History, ShieldAlert, ShieldCheck, Users, Eye, Settings2 } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { COMPLIANCE_CATEGORIES, listComplianceAudit, securityChecks, securitySummary, type CheckStatus } from "@/server/services/compliance/security";
import { formatDateTime } from "@/lib/format";
import { auditCode } from "@/lib/audit-labels";
import { cn } from "@/lib/utils";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { DateRangeField } from "@/components/admin/date-range-field";
import { ListPanel, PanelEmpty, PanelPagination, SelectField, showing } from "@/components/admin/list-panel";

export const metadata = { title: "Security & audit logs" };

type SP = { category?: string; result?: string; from?: string; to?: string; page?: string };

const STATUS: Record<CheckStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok: { label: "In place", cls: "bg-success/10 text-success ring-success/20", Icon: CheckCircle2 },
  attention: { label: "Needs attention", cls: "bg-warning/10 text-warning ring-warning/25", Icon: AlertTriangle },
  manual: { label: "Confirm manually", cls: "bg-ink/[0.05] text-ink/75 ring-line", Icon: ClipboardCheck },
};
const RESULT: Record<string, string> = { success: "bg-success/10 text-success ring-success/20", failure: "bg-danger/10 text-danger ring-danger/20", denied: "bg-warning/10 text-warning ring-warning/25" };

/** Compliance & Privacy › Security & audit logs: security controls (checked live) and security/privacy audit events. */
export default async function ComplianceSecurityPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("compliance.view", "/admin/compliance/security");
  const sp = await searchParams;
  const [checks, summary, data] = await Promise.all([
    securityChecks(user),
    securitySummary(user),
    listComplianceAudit(user, { category: sp.category, result: sp.result, from: sp.from, to: sp.to, page: Number(sp.page) || 1 }),
  ]);
  const cards = [
    { label: "Failed or refused sign-ins", value: summary.failed, Icon: ShieldAlert },
    { label: "Role & permission changes", value: summary.roleChanges, Icon: Users },
    { label: "Privacy record views", value: summary.privacyViews, Icon: Eye },
    { label: "Settings changes", value: summary.settingsChanges, Icon: Settings2 },
  ];
  return (
    <>
      <PageHeader title="Security & audit logs" description="Security controls checked against the running system, and every sign-in, permission, privacy and settings event. Audit records can't be edited or deleted." />

      <section aria-labelledby="sec-30d" className="mb-6">
        <h2 id="sec-30d" className="mb-3 text-sm font-semibold text-muted">Last 30 days</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, Icon }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
              <span><span className="block text-2xl font-bold tabular-nums text-ink">{value.toLocaleString("en-IN")}</span><span className="text-xs text-muted">{label}</span></span>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="sec-controls" className="mb-6 rounded-[20px] border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3.5">
          <ShieldCheck className="h-5 w-5 text-primary" aria-hidden />
          <h2 id="sec-controls" className="font-semibold text-ink">Security controls</h2>
          <span className="ml-auto text-xs text-muted">{checks.filter((c) => c.status === "ok").length} of {checks.length} in place</span>
        </div>
        <ul className="divide-y divide-line">
          {checks.map((c) => {
            const s = STATUS[c.status];
            return (
              <li key={c.key} className="flex flex-col gap-1.5 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-4">
                <span className={cn("inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 sm:w-40", s.cls)}><s.Icon className="h-3.5 w-3.5" aria-hidden />{s.label}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{c.title}</span>
                  <span className="block text-sm text-muted">{c.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <ListPanel
        title="Security & privacy events"
        meta={showing(data.page, 50, data.total)}
        actions={<Link href="/admin/audit-log" className="text-sm font-semibold text-primary hover:underline">Full audit log</Link>}
        filters={
          <FilterBar action="/admin/compliance/security" bare>
            <SelectField name="category" label="Type" value={sp.category}>
              {COMPLIANCE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </SelectField>
            <SelectField name="result" label="Result" value={sp.result}>
              <option value="">Any result</option>
              <option value="success">Success</option>
              <option value="failure">Failure</option>
              <option value="denied">Refused</option>
            </SelectField>
            <DateRangeField from={sp.from} to={sp.to} />
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/compliance/security" params={sp} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<History className="h-5 w-5" />} title="No events found">Try another type, result or date range.</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={60}>
            <thead>
              <tr><th>When</th><th>Who</th><th>Event</th><th>Result</th><th>Details</th></tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="whitespace-nowrap text-muted">{formatDateTime(a.createdAt)}</td>
                  <td>
                    <span className="block font-medium text-ink">{a.actor?.name ?? (a.actorType === "system" ? "System" : "Unknown")}</span>
                    <span className="block text-xs capitalize text-muted">{a.actorType}{a.ipAddress ? ` · ${a.ipAddress}` : ""}</span>
                  </td>
                  <td><code className="whitespace-nowrap rounded-full bg-ink/[0.05] px-2 py-0.5 font-sans text-[11px] font-semibold text-ink/75 ring-1 ring-line" title={a.action}>{auditCode(a.action, a.summary)}</code></td>
                  <td><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1", RESULT[a.result] ?? RESULT.success)}>{a.result === "denied" ? "Refused" : a.result}</span></td>
                  <td className="max-w-md break-words text-ink">{a.summary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </>
  );
}
