import { History } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { auditFilterOptions, listAuditLog, type AuditPeriod } from "@/server/services/dashboard";
import { formatDateTime } from "@/lib/format";
import { auditArea, auditCode, auditFallback, auditTone } from "@/lib/audit-labels";
import { cn } from "@/lib/utils";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { DateRangeField } from "@/components/admin/date-range-field";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, SearchField, SelectField, showing } from "@/components/admin/list-panel";

export const metadata = { title: "Audit log" };

type SP = { q?: string; actor?: string; action?: string; area?: string; from?: string; to?: string; period?: string; page?: string };
const PERIODS: { key: AuditPeriod | ""; label: string }[] = [
  { key: "", label: "Everything" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "30d", label: "Last 30 days" },
  { key: "deletions", label: "Deletions" },
];
const CHIP = {
  red: "bg-danger/10 text-danger ring-danger/20",
  green: "bg-success/10 text-success ring-success/20",
  neutral: "bg-ink/[0.05] text-ink/75 ring-line",
};
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("audit.view", "/admin/audit-log");
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.key === sp.period) ? (sp.period as AuditPeriod) : undefined;
  const [data, options] = await Promise.all([
    listAuditLog(user, { q: sp.q?.trim() || undefined, actorId: sp.actor || undefined, action: sp.action || undefined, area: sp.area || undefined, from: sp.from || undefined, to: sp.to || undefined, period, page: Number(sp.page) || 1 }),
    auditFilterOptions(user),
  ]);
  const hrefFor = (key: string) => {
    const p = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "period" && k !== "page") as [string, string][]);
    if (key) p.set("period", key);
    const qs = p.toString();
    return `/admin/audit-log${qs ? `?${qs}` : ""}`;
  };
  const filtered = Boolean(sp.q || sp.actor || sp.action || sp.area || sp.from || sp.to || period);

  return (
    <>
      <PageHeader title="Audit log" description="Every change made in the admin, with who made it and what changed." />
      <div className="mb-4">
        <PillTabs label="Period" items={PERIODS.map((p) => ({ href: hrefFor(p.key), label: p.label, active: (period ?? "") === p.key }))} />
      </div>
      <ListPanel
        meta={showing(data.page, 50, data.total)}
        filters={
          <FilterBar action="/admin/audit-log" bare>
            {period && <input type="hidden" name="period" value={period} />}
            <SearchField defaultValue={sp.q} placeholder="Search by summary, action or email" />
            <SelectField name="actor" label="Person" value={sp.actor}>
              <option value="">Anyone</option>
              <option value="system">System</option>
              {options.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectField>
            <SelectField name="action" label="Action" value={sp.action}>
              <option value="">Any action</option>
              {options.actions.map((a) => <option key={a} value={a}>{auditCode(a)}</option>)}
            </SelectField>
            <SelectField name="area" label="Type" value={sp.area}>
              <option value="">Any type ({options.areas.reduce((n, a) => n + a.count, 0).toLocaleString("en-IN")})</option>
              {options.areas.map((a) => <option key={a.area} value={a.area}>{a.area} ({a.count.toLocaleString("en-IN")})</option>)}
            </SelectField>
            <DateRangeField from={sp.from} to={sp.to} />
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/audit-log" params={sp} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<History className="h-5 w-5" />} title="No events found">{filtered ? "Try another period, person or search." : "Changes made in the admin appear here."}</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={60}>
            <thead>
              <tr><th>When</th><th>Who</th><th>Action</th><th>What changed</th><th className="text-right">Detail</th></tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="whitespace-nowrap text-muted">{formatDateTime(a.createdAt)}</td>
                  <td className="min-w-0">
                    <span className="block font-medium text-ink">{a.actor?.name ?? "System"}</span>
                    {a.actor?.email && <span className="block text-xs text-muted">{a.actor.email}</span>}
                  </td>
                  <td>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <code className={cn("whitespace-nowrap rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold tracking-wide ring-1", CHIP[auditTone(a.action)])} title={a.action}>{auditCode(a.action, a.summary)}</code>
                      <span className="text-xs text-muted">{auditArea(a.action)}</span>
                    </span>
                  </td>
                  <td className="max-w-md break-words text-ink">{a.summary || auditFallback(a.action, a.entityType)}</td>
                  <td className="text-right">
                    {a.diff || a.ipAddress ? (
                      <details className="group inline-block text-left">
                        <summary className="cursor-pointer list-none text-sm font-semibold text-mint-ink hover:underline [&::-webkit-details-marker]:hidden">View</summary>
                        <div className="mt-2 w-72 max-w-[70vw] space-y-1.5 rounded-xl border border-line bg-bg p-3 text-xs text-muted">
                          {a.ipAddress && <p><span className="font-semibold text-ink">IP</span> {a.ipAddress}</p>}
                          {a.userAgent && <p className="break-words"><span className="font-semibold text-ink">Device</span> {a.userAgent}</p>}
                          {a.entityId && <p className="break-all"><span className="font-semibold text-ink">Record</span> {label(a.entityType)} · {a.entityId}</p>}
                          {a.diff != null && <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-surface p-2 font-mono text-[11px] text-ink ring-1 ring-line">{JSON.stringify(a.diff, null, 2)}</pre>}
                        </div>
                      </details>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </>
  );
}
