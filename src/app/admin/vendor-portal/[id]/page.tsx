import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader, StatusBadge } from "@/components/admin/page-header";
import { ActionBadge, ENTITY_NAME, RequestStatusBadge } from "@/components/admin/approval-badges";
import { currentSubscription } from "@/server/services/billing";

export const metadata = { title: "Vendor" };
export const dynamic = "force-dynamic";

export default async function VendorPortalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePermission("approvals.manage", `/admin/vendor-portal/${id}`);
  const v = await db.vendor.findUnique({
    where: { id },
    select: {
      id: true, name: true, slug: true, verification: true, isActive: true, receivesLeads: true,
      users: { orderBy: { name: "asc" }, select: { id: true, name: true, email: true, status: true, lastLoginAt: true, role: { select: { name: true } } } },
      software: { orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, name: true, status: true, updatedAt: true } },
    },
  });
  if (!v) notFound();
  const userIds = v.users.map((u) => u.id);
  const [requests, activity, pendingCount, plan, leadCount] = await Promise.all([
    db.approvalRequest.findMany({ where: { vendorId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { requestedBy: { select: { name: true } } } }),
    userIds.length ? db.auditLog.findMany({ where: { actorId: { in: userIds } }, orderBy: { createdAt: "desc" }, take: 30, include: { actor: { select: { name: true } } } }) : [],
    db.approvalRequest.count({ where: { vendorId: id, status: "PENDING" } }),
    currentSubscription(id),
    db.lead.count({ where: { vendorId: id } }),
  ]);
  const pendingFor = new Set(requests.filter((r) => r.status === "PENDING").map((r) => r.entityId));

  return (
    <>
      <PageHeader
        title={v.name}
        description={`${v.users.length} portal user${v.users.length === 1 ? "" : "s"} · ${v.software.length} product${v.software.length === 1 ? "" : "s"} · ${pendingCount} pending request${pendingCount === 1 ? "" : "s"}`}
        back={{ href: "/admin/vendor-portal", label: "Vendor portal" }}
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/admin/vendors/${v.id}`} className="font-medium hover:underline">Edit vendor</Link>
            <Link href={`/vendors/${v.slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium hover:underline">Public page <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {plan ? <Badge tone="success">{plan.planName} plan until {formatDate(plan.periodEnd)}</Badge> : <Badge tone="neutral">No active plan — lead contacts hidden</Badge>}
        <Badge tone={v.receivesLeads ? "primary" : "neutral"}>{leadCount} lead{leadCount === 1 ? "" : "s"}{v.receivesLeads ? "" : " · leads off"}</Badge>
        <Link href={`/admin/billing/subscriptions?vendorId=${v.id}`} className="font-medium hover:underline">Billing</Link>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Users" description="Change roles, suspend or sign them out from Users." actions={<Link href="/admin/users" className="text-sm font-semibold hover:underline">Manage users</Link>} />
          {v.users.length === 0 ? <EmptyState title="No portal users" /> : (
            <ul className="divide-y divide-line">
              {v.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">
                    <Link href={`/admin/users/${u.id}`} className="font-semibold hover:underline">{u.name}</Link>
                    <span className="block truncate text-xs text-muted">{u.email} · {u.lastLoginAt ? `last signed in ${formatDateTime(u.lastLoginAt)}` : "never signed in"}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5"><Badge tone="primary">{u.role.name}</Badge>{u.status !== "ACTIVE" && <Badge tone="warning">{u.status.toLowerCase()}</Badge>}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Requests" actions={<Link href={`/admin/approvals?vendorId=${v.id}&status=ALL`} className="text-sm font-semibold hover:underline">View all</Link>} />
          {requests.length === 0 ? <EmptyState title="No requests yet" /> : (
            <ul className="divide-y divide-line">
              {requests.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/approvals/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-bg/60">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2"><ActionBadge action={r.action} /><span className="truncate font-medium">{r.entityLabel}</span></span>
                      <span className="block text-xs text-muted">{ENTITY_NAME[r.entityType]} · {r.requestedBy?.name ?? "—"} · {formatDateTime(r.createdAt)}</span>
                    </span>
                    <RequestStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Products" />
          {v.software.length === 0 ? <EmptyState title="No products yet" /> : (
            <ul className="divide-y divide-line">
              {v.software.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <Link href={`/admin/software/${s.id}`} className="min-w-0 truncate font-medium hover:underline">{s.name}</Link>
                  <span className="flex shrink-0 items-center gap-1.5">{pendingFor.has(s.id) && <Badge tone="accent">Request pending</Badge>}<StatusBadge status={s.status} /></span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Activity" description="Everything this vendor's users did, newest first." />
          {activity.length === 0 ? <EmptyState title="No activity yet" /> : (
            <ul className="divide-y divide-line text-sm">
              {activity.map((a) => (
                <li key={a.id} className="px-5 py-2.5">
                  <span className="font-medium">{a.actor?.name ?? "—"}</span> <span className="text-muted">{a.summary ?? a.action}</span>
                  <span className="block text-xs text-muted">{formatDateTime(a.createdAt)}{a.ipAddress ? ` · ${a.ipAddress}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
