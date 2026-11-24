import Link from "next/link";
import { Bug, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { listErrors } from "@/server/error-log";
import { can } from "@/server/rbac/policy";
import { ERROR_TYPES, ERROR_TYPE_INFO, type ErrorStatus, type ErrorType } from "@/lib/error-types";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { Alert } from "@/components/ui/misc";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, SearchField, SelectField, showing } from "@/components/admin/list-panel";
import { ErrorStatusBadge, ErrorTypeBadge } from "./badges";
import { ErrorBulk } from "./bulk";
import { AutoResolveControl } from "./auto-resolve";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Error logs" };
export const dynamic = "force-dynamic";

const TABS: { key: ErrorStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "ALL", label: "All" },
];
type SP = { status?: string; type?: string; q?: string; page?: string };

export default async function ErrorLogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("errors.view", "/admin/logs/errors");
  const sp = await searchParams;
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "PENDING") as ErrorStatus | "ALL";
  const type = ERROR_TYPES.find((t) => t === sp.type) as ErrorType | undefined;
  const data = await listErrors(user, { status, type, q: sp.q, page: Number(sp.page) || 1 }).catch((e: unknown) => {
    // The ErrorLog table doesn't exist until the error_logs migration has run.
    if (/ErrorLog|P2021|does not exist/i.test(String((e as Error)?.message ?? "") + String((e as { code?: string })?.code ?? ""))) return null;
    throw e;
  });
  if (!data) {
    return (
      <>
        <PageHeader title="Error logs" description="Every error on the website, admin panel, portals and APIs." />
        <Alert tone="warning" title="The error log table hasn't been created yet">Run <code>npx prisma migrate dev</code> (on the server: <code>npm run db:deploy</code>), then restart the website.</Alert>
      </>
    );
  }
  const canManage = can(user, "errors.manage");
  const autoHours = (await getSettings()).errorLogs?.autoResolveHours ?? 24;
  const n = (s?: string, t?: string) => data.counts.filter((c) => (!s || s === "ALL" || c.status === s) && (!t || c.type === t)).reduce((sum, c) => sum + c._count._all, 0);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/logs/errors${p.size ? `?${p}` : ""}`;
  };
  const reopened = data.items.filter((e) => e.reopenedAt && e.status === "PENDING").length;
  const table = (
    <AdminTable bare minWidth={70}>
      <thead>
        <tr>
          {canManage && <th className="w-10"><AllCheckbox ids={data.items.map((e) => e.id)} /></th>}
          <th>Status</th><th>Type</th><th>Error details</th><th className="text-right">Times</th><th>Last occurred</th>
        </tr>
      </thead>
      <tbody>
        {data.items.map((e) => (
          <tr key={e.id}>
            {canManage && <td><RowCheckbox id={e.id} label={e.message} /></td>}
            <td className="whitespace-nowrap"><ErrorStatusBadge status={e.status} reopened={Boolean(e.reopenedAt)} /></td>
            <td className="whitespace-nowrap"><ErrorTypeBadge type={e.type} /></td>
            <td className="max-w-[34rem]">
              <Link href={`/admin/logs/errors/${e.id}`} className="block truncate font-semibold hover:text-mint-ink" title={e.message}>{e.message}</Link>
              <span className="block truncate text-xs text-muted">
                {e.method && `${e.method} `}{e.source ?? "—"}{e.statusCode ? ` · ${e.statusCode}` : ""}{e.userName ? ` · ${e.userName}` : ""}
              </span>
            </td>
            <td className="text-right tabular-nums">{formatNumber(e.count)}</td>
            <td className="whitespace-nowrap text-muted" title={`First: ${formatDateTime(e.firstSeenAt)}`}>
              {formatDateTime(e.lastSeenAt)}<span className="block text-xs">{relativeTime(e.lastSeenAt)}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </AdminTable>
  );
  return (
    <SelectionProvider>
      <PageHeader title="Error logs" description="Every error on the website, admin panel, portals and APIs: what went wrong, where and when. Errors that stop happening are resolved automatically; you can still resolve one yourself." />
      <PageStats
        items={[
          { label: "Pending", value: formatNumber(n("PENDING")), icon: Clock, tone: n("PENDING") ? "red" : "neutral", sub: "Still to look at", href: qs({ status: "PENDING", type: undefined }) },
          { label: "Resolved", value: formatNumber(n("RESOLVED")), icon: CheckCircle2, tone: "green", sub: "Kept for 90 days", href: qs({ status: "RESOLVED", type: undefined }) },
          { label: "Happened again", value: formatNumber(reopened), icon: RotateCcw, sub: "Resolved, then came back (this page)" },
          { label: "All errors", value: formatNumber(n()), icon: Bug, sub: "Repeats are grouped" },
        ]}
      />
      <AutoResolveControl hours={autoHours} canManage={canManage} />
      {canManage && <ErrorBulk />}
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.map((t) => ({ href: qs({ status: t.key }), label: t.label, count: n(t.key, type), active: status === t.key }))} />}
        meta={showing(data.page, data.perPage, data.total)}
        filters={
          <FilterBar action="/admin/logs/errors" bare oneLine>
            <input type="hidden" name="status" value={status} />
            <SearchField defaultValue={sp.q} placeholder="Search message, page or reference…" />
            <SelectField name="type" label="Type" value={type}>
              <option value="">All types</option>
              {ERROR_TYPES.map((t) => <option key={t} value={t}>{ERROR_TYPE_INFO[t].label} ({n(status, t)})</option>)}
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/logs/errors" params={{ status, type, q: sp.q }} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<Bug className="h-5 w-5" />} title={status === "PENDING" ? "No pending errors" : "No errors found"}>
            {status === "PENDING" ? "Nothing is waiting. New errors appear here as soon as they happen." : "Try another tab or filter."}
          </PanelEmpty>
        ) : table}
      </ListPanel>
    </SelectionProvider>
  );
}
