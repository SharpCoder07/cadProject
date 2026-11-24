import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { getError } from "@/server/error-log";
import { can } from "@/server/rbac/policy";
import { AppError } from "@/server/errors";
import { ERROR_TYPE_INFO, type ErrorType } from "@/lib/error-types";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { ErrorStatusBadge, ErrorTypeBadge } from "../badges";
import { ErrorStatusForm } from "./status-form";

export const metadata = { title: "Error" };
export const dynamic = "force-dynamic";

export default async function ErrorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("errors.view", `/admin/logs/errors/${id}`);
  const e = await getError(user, id).catch((err) => { if (err instanceof AppError && err.code === "NOT_FOUND") notFound(); throw err; });
  const rows: [string, React.ReactNode][] = [
    ["Status", <ErrorStatusBadge key="s" status={e.status} reopened={Boolean(e.reopenedAt)} />],
    ["Type", <span key="t"><ErrorTypeBadge type={e.type} /> <span className="ml-1 text-xs text-muted">{ERROR_TYPE_INFO[e.type as ErrorType]?.description}</span></span>],
    ["Where", `${e.method ? `${e.method} ` : ""}${e.source ?? "—"}${e.statusCode ? ` (${e.statusCode})` : ""}`],
    ["Happened", `${formatNumber(e.count)} ${e.count === 1 ? "time" : "times"}`],
    ["First occurred", formatDateTime(e.firstSeenAt)],
    ["Last occurred", formatDateTime(e.lastSeenAt)],
    ...(e.reopenedAt ? [["Happened again", `${formatDateTime(e.reopenedAt)}, after being marked resolved`] as [string, React.ReactNode]] : []),
    ...(e.digest ? [["Reference", <code key="d" className="text-xs">{e.digest}</code>] as [string, React.ReactNode]] : []),
    ["Signed-in person", e.userName ?? "Visitor (not signed in) or system"],
    ...(e.userAgent ? [["Browser", <span key="ua" className="text-xs text-muted">{e.userAgent}</span>] as [string, React.ReactNode]] : []),
    ...(e.resolvedAt ? [["Resolved", `${formatDateTime(e.resolvedAt)}${e.resolvedByName ? (e.resolvedById ? ` by ${e.resolvedByName}` : ` · ${e.resolvedByName}`) : ""}`] as [string, React.ReactNode]] : []),
  ];
  return (
    <>
      <PageHeader title={e.message.length > 120 ? `${e.message.slice(0, 120)}…` : e.message} description="Error" back={{ href: "/admin/logs/errors", label: "Error logs" }} />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          <Panel>
            <PanelHeader title="Error details" />
            <p className="whitespace-pre-wrap break-words px-5 pt-1 text-sm font-medium text-ink">{e.message}</p>
            <dl className="mt-3 divide-y divide-line border-t border-line text-sm">
              {rows.map(([k, v]) => <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 px-5 py-2.5"><dt className="text-muted">{k}</dt><dd className="min-w-0 break-words text-ink">{v}</dd></div>)}
            </dl>
          </Panel>
          {e.details && (
            <Panel>
              <PanelHeader title="Technical details" description="Stack trace: the code that was running when it failed." />
              <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words bg-bg px-5 py-4 text-xs leading-relaxed text-ink">{e.details}</pre>
            </Panel>
          )}
        </div>
        <Panel>
          <PanelHeader title="Status" />
          <ErrorStatusForm id={e.id} status={e.status as "PENDING" | "RESOLVED"} note={e.note} canManage={can(user, "errors.manage")} />
        </Panel>
      </div>
    </>
  );
}
