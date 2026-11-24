import Link from "next/link";
import { Activity, Building2, ClipboardCheck, Users } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { formatNumber, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { AdminTable, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, showingAll } from "@/components/admin/list-panel";
import { ListSearch } from "@/components/site/list-search";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { setVerificationAction } from "../vendors/actions";

export const metadata = { title: "Vendor portal" };
export const dynamic = "force-dynamic";

export default async function VendorPortalOverview({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePermission("approvals.manage", "/admin/vendor-portal");
  const sp = await searchParams;
  const q = sp.q?.trim().toLowerCase();
  const [vendors, pending, vendorUsers] = await Promise.all([
    db.vendor.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, kind: true, verification: true, isActive: true, _count: { select: { users: true, software: true } }, software: { where: { status: "PUBLISHED" }, select: { id: true } } },
    }),
    db.approvalRequest.groupBy({ by: ["vendorId"], where: { status: "PENDING" }, _count: { _all: true }, orderBy: { vendorId: "asc" } }),
    db.user.findMany({ where: { vendorId: { not: null } }, select: { id: true, vendorId: true } }),
  ]);
  const lastSeen = vendorUsers.length
    ? await db.auditLog.groupBy({ by: ["actorId"], where: { actorId: { in: vendorUsers.map((u) => u.id) } }, _max: { createdAt: true }, orderBy: { actorId: "asc" } })
    : [];
  const vendorOfUser = new Map(vendorUsers.map((u) => [u.id, u.vendorId!]));
  const lastActivity = new Map<string, Date>();
  for (const row of lastSeen) {
    const v = row.actorId ? vendorOfUser.get(row.actorId) : undefined;
    const at = row._max.createdAt;
    if (v && at && (!lastActivity.get(v) || at > lastActivity.get(v)!)) lastActivity.set(v, at);
  }
  const pendingOf = new Map(pending.map((p) => [p.vendorId, typeof p._count === "object" ? p._count._all ?? 0 : 0]));
  const withPortal = vendors.filter((v) => v._count.users > 0);
  const withoutPortal = vendors.length - withPortal.length;
  const shown = withPortal.filter((v) => !q || v.name.toLowerCase().includes(q));
  const pendingTotal = [...pendingOf.values()].reduce((a, b) => a + b, 0);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const activeWeek = withPortal.filter((v) => (lastActivity.get(v.id)?.getTime() ?? 0) > weekAgo).length;

  return (
    <SelectionProvider>
      <PageHeader title="Vendor portal" description="Monitor every vendor and reseller company, its users and activity." />
      <PageStats
        items={[
          { label: "Vendors on the portal", value: formatNumber(withPortal.length), icon: Building2, tone: "red", sub: `${formatNumber(withoutPortal)} without portal users` },
          { label: "Vendor users", value: formatNumber(vendorUsers.length), icon: Users, sub: "People who can sign in" },
          { label: "Pending requests", value: formatNumber(pendingTotal), icon: ClipboardCheck, tone: pendingTotal ? "amber" : "neutral", sub: pendingTotal ? "Waiting for approval" : "All caught up", href: "/admin/approvals" },
          { label: "Active this week", value: formatNumber(activeWeek), icon: Activity, tone: "green", sub: "Vendors who made changes" },
        ]}
      />
      <BulkActionBar
        noun="vendor"
        items={[
          { label: "Mark verified", action: setVerificationAction, extra: { verification: "VERIFIED" }, done: "Verified" },
          { label: "Mark pending", action: setVerificationAction, extra: { verification: "PENDING" }, done: "Marked pending" },
          { label: "Reject", action: setVerificationAction, extra: { verification: "REJECTED" }, done: "Rejected", confirm: "Rejected vendors lose their verified badge. Their products stay listed and their users can still sign in." },
        ]}
      />
      <ListPanel
        title="Vendors using the portal"
        meta={showingAll(shown.length)}
        actions={withPortal.length > 0 && <ListSearch panel placeholder="Search vendors…" basePath="/admin/vendor-portal" params={{ q: sp.q }} scopeLabel="Vendor portal" className="w-full sm:w-72" />}
        footer={withoutPortal > 0 && <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">{withoutPortal} other vendor{withoutPortal === 1 ? " has" : "s have"} no portal users. Manage all vendors under <Link href="/admin/vendors" className="font-medium text-primary hover:underline">Vendors &amp; brands</Link>.</p>}
      >
        {withPortal.length === 0 ? (
          <PanelEmpty icon={<Building2 className="h-5 w-5" />} title="No vendor users yet">
            Invite someone from <Link href="/admin/users" className="underline">Users</Link> with a Vendor Admin, Vendor Editor or Vendor Viewer role and choose their company.
          </PanelEmpty>
        ) : shown.length === 0 ? (
          <PanelEmpty icon={<Building2 className="h-5 w-5" />} title="No matching vendors">Try a different search.</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={56}>
            <thead><tr><th className="w-10"><AllCheckbox ids={shown.map((v) => v.id)} /></th><th>Vendor</th><th className="text-right">Users</th><th className="text-right">Live / all products</th><th>Pending requests</th><th>Last vendor activity</th></tr></thead>
            <tbody>
              {shown.map((v) => {
                const p = pendingOf.get(v.id) ?? 0;
                const last = lastActivity.get(v.id);
                return (
                  <tr key={v.id}>
                    <td><RowCheckbox id={v.id} label={v.name} /></td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-soft text-xs font-bold text-mint-ink">{v.name.slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0">
                          <Link href={`/admin/vendor-portal/${v.id}`} className="font-semibold text-ink hover:text-mint-ink">{v.name}</Link>
                          {v.kind === "RESELLER" && <Badge tone="primary" className="ml-2">Reseller</Badge>}
                          <span className="mt-0.5 flex flex-wrap gap-1">{v.verification === "VERIFIED" ? <Badge tone="success">Verified</Badge> : <Badge>{v.verification.toLowerCase()}</Badge>}{!v.isActive && <Badge tone="danger">Inactive</Badge>}</span>
                        </span>
                      </div>
                    </td>
                    <td className="text-right tabular-nums">{v._count.users}</td>
                    <td className="text-right tabular-nums">{v.software.length} / {v._count.software}</td>
                    <td>{p ? <Link href={`/admin/approvals?vendorId=${v.id}`}><Badge tone="accent">{p} pending</Badge></Link> : <span className="text-muted">None</span>}</td>
                    <td className="text-muted">{last ? formatDateTime(last) : "No activity yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
