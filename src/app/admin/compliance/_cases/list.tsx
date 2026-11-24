import Link from "next/link";
import { AlarmClock, CheckCircle2, Inbox, MailQuestion, Timer } from "lucide-react";
import type { Principal } from "@/server/rbac/policy";
import { caseListQuery, listCases } from "@/server/services/compliance/cases";
import { isOverdue, STATUS_LABEL, typeLabel, typesFor, type CaseKind } from "@/lib/compliance/cases";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminTable, FilterBar } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, SearchField, SelectField, showing } from "@/components/admin/list-panel";

export type CaseSP = { status?: string; type?: string; q?: string; page?: string };

export const STATUS_TONE: Record<string, string> = {
  PENDING_VERIFICATION: "bg-ink/[0.05] text-ink/60 ring-line",
  OPEN: "bg-primary/10 text-primary ring-primary/20",
  IN_PROGRESS: "bg-primary/10 text-primary ring-primary/20",
  AWAITING_REQUESTER: "bg-warning/10 text-warning ring-warning/25",
  RESOLVED: "bg-success/10 text-success ring-success/20",
  REJECTED: "bg-ink/[0.05] text-ink/70 ring-line",
  CLOSED: "bg-ink/[0.05] text-ink/70 ring-line",
};

/** Shared list for Data requests and Grievances. */
export async function CaseList({ user, kind, sp, base, settingsMissing }: { user: Principal; kind: CaseKind; sp: CaseSP; base: string; settingsMissing: boolean }) {
  const query = caseListQuery.parse({ kind, status: sp.status || undefined, type: sp.type || undefined, q: sp.q || undefined, page: sp.page });
  const data = await listCases(user, query);
  const n = (s: keyof typeof data.counts) => data.counts[s] ?? 0;
  const active = n("OPEN") + n("IN_PROGRESS") + n("AWAITING_REQUESTER");
  const types = typesFor(kind);
  const tab = (status: string, label: string, count?: number) => ({ href: `${base}?status=${status}`, label, count, active: query.status === status });
  return (
    <>
      <PageStats
        items={[
          { label: "Open", value: active, icon: Inbox, sub: "Received, in progress or waiting" },
          { label: "Past target date", value: data.overdue, icon: AlarmClock, tone: data.overdue ? "red" : "neutral", sub: settingsMissing ? "No timeline set yet" : "From Compliance settings" },
          { label: "Waiting for email confirmation", value: n("PENDING_VERIFICATION"), icon: MailQuestion, sub: "Sent without signing in" },
          { label: "Resolved", value: n("RESOLVED"), icon: CheckCircle2, tone: "green", sub: "All time" },
        ]}
      />
      {settingsMissing && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-muted">
          <Timer className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
          <p><span className="font-semibold text-ink">No response timeline set. </span>Target dates appear once you set them in <Link href="/admin/compliance/settings" className="font-semibold text-primary hover:underline">Compliance settings</Link>, as confirmed with your lawyer. None is assumed.</p>
        </div>
      )}
      <ListPanel
        tabs={<PillTabs items={[tab("ACTIVE", "Open", active), tab("OVERDUE", "Past target", data.overdue), tab("PENDING_VERIFICATION", "Unconfirmed", n("PENDING_VERIFICATION")), tab("RESOLVED", "Resolved"), tab("ALL", "All")]} />}
        meta={`${showing(data.page, 30, data.total)}${data.masked ? " · emails masked" : ""}`}
        filters={
          <FilterBar action={base} bare>
            <input type="hidden" name="status" value={query.status} />
            <SearchField defaultValue={sp.q} placeholder="Reference, name or email" />
            <SelectField name="type" label="Type" value={sp.type}>
              <option value="">Any type</option>
              {types.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath={base} params={sp} />}
      >
        {data.rows.length === 0 ? (
          <PanelEmpty icon={<Inbox className="h-5 w-5" />} title="Nothing here">{kind === "DATA_REQUEST" ? "Requests sent from the Privacy center appear here." : kind === "GRIEVANCE" ? "Complaints sent from the Privacy center appear here." : "Content reports sent from the Privacy center appear here."}</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={60}>
            <thead><tr><th>Reference</th><th>{kind === "DATA_REQUEST" ? "Request" : kind === "GRIEVANCE" ? "Complaint" : "Report"}</th><th>From</th><th>Status</th><th>Target</th><th>Assigned</th><th>Received</th></tr></thead>
            <tbody>
              {data.rows.map((r) => {
                const late = isOverdue(r);
                return (
                  <tr key={r.id}>
                    <td><Link href={`${base}/${r.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{r.referenceNo}</Link></td>
                    <td><Link href={`${base}/${r.id}`} className="font-medium text-ink hover:underline">{r.subject || typeLabel(kind, r.type)}</Link>{r.subject && <span className="block text-xs text-muted">{typeLabel(kind, r.type)}</span>}</td>
                    <td><span className="block text-ink">{r.name}</span><span className="block text-xs text-muted">{r.email}{r.userId ? " · account" : ""}</span></td>
                    <td><span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", STATUS_TONE[r.status])}>{STATUS_LABEL[r.status]}</span></td>
                    <td className={cn("whitespace-nowrap", late ? "font-semibold text-danger" : "text-muted")}>{r.dueAt ? formatDate(r.dueAt) : "—"}{late && " · late"}</td>
                    <td className="text-muted">{r.assignedTo?.name ?? "—"}</td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </>
  );
}
