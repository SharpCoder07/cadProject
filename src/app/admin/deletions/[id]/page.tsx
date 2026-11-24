import { notFound } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { deletionWhat, getDeletion, permissionLabel } from "@/server/rbac/deletion";
import { isSuperAdmin } from "@/server/rbac/policy";
import { AppError } from "@/server/errors";
import { formatDateTime } from "@/lib/format";
import { Alert, Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { RequestStatusBadge } from "@/components/admin/approval-badges";
import { DeletionDecision, WithdrawDeletion } from "./decision";

export const metadata = { title: "Deletion request" };
export const dynamic = "force-dynamic";

export default async function DeletionRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("deletions.approve", `/admin/deletions/${id}`);
  const r = await getDeletion(user, id).catch((e) => { if (e instanceof AppError && e.code === "NOT_FOUND") notFound(); throw e; });
  const superAdmin = isSuperAdmin(user);
  const rows: [string, React.ReactNode][] = [
    ["Request", `Delete ${deletionWhat(r.kind)}`],
    ["Item", r.label],
    ...(r.detail ? [["What goes", <span key="d" className="text-danger">{r.detail}</span>] as [string, React.ReactNode]] : []),
    ["Needs", permissionLabel(r.permission)],
    ["Requested by", r.requestedBy ? `${r.requestedBy.name} (${r.requestedBy.email})${r.vendorId ? " · vendor user" : ""}` : "—"],
    ["Submitted", formatDateTime(r.createdAt)],
    ...(r.note ? [["Their note", `“${r.note}”`] as [string, React.ReactNode]] : []),
    ["Status", <RequestStatusBadge key="s" status={r.status} />],
    ...(r.decidedAt ? [["Decided", `${formatDateTime(r.decidedAt)}${r.decidedBy ? ` by ${r.decidedBy.name}` : ""}`] as [string, React.ReactNode]] : []),
    ...(r.decisionNote ? [["Decision note", r.decisionNote] as [string, React.ReactNode]] : []),
  ];
  return (
    <>
      <PageHeader title={`Delete ${deletionWhat(r.kind)}: ${r.label}`} description="Deletion request" back={{ href: "/admin/deletions", label: "Deletion requests" }} />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Panel>
          <PanelHeader title="Request" />
          <dl className="divide-y divide-line text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[10rem_1fr] gap-3 px-5 py-3"><dt className="text-muted">{k}</dt><dd className="text-ink">{v}</dd></div>
            ))}
          </dl>
          {r.detail && (
            <div className="px-5 pb-5">
              <Alert tone="info">This is a change that removes elements inside “{r.label}”. Approving saves their whole change as they made it. If the item was changed by someone else since, approving is refused so newer work isn't undone.</Alert>
            </div>
          )}
        </Panel>
        {r.status === "PENDING" && (
          <Panel>
            <PanelHeader title={superAdmin ? "Your decision" : "Waiting for the Super Admin"} />
            {superAdmin ? <DeletionDecision id={r.id} /> : null}
            {(r.requestedBy?.id === user.id || superAdmin) && <WithdrawDeletion id={r.id} own={r.requestedBy?.id === user.id} />}
          </Panel>
        )}
      </div>
    </>
  );
}
