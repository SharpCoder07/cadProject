import Link from "next/link";
import type { ApprovalEntity, ApprovalStatus } from "@prisma/client";
import { CheckCircle2, Clock, ShieldCheck, Store, XCircle } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listApprovals } from "@/server/services/approvals";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { ApprovalBulk } from "./approval-bulk";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, SearchField, SelectField, showing } from "@/components/admin/list-panel";
import { ActionBadge, ENTITY_NAME, RequestStatusBadge } from "@/components/admin/approval-badges";

export const metadata = { title: "Approvals" };
export const dynamic = "force-dynamic";

const TABS: { key: ApprovalStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Withdrawn" },
  { key: "ALL", label: "All" },
];
const ENTITIES: ApprovalEntity[] = ["SOFTWARE", "OFFER", "VENDOR_PROFILE", "REVIEW_REPLY", "VENDOR_USER"];

type SP = { status?: string; vendorId?: string; type?: string; page?: string; q?: string };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("approvals.manage", "/admin/approvals");
  const sp = await searchParams;
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "PENDING") as ApprovalStatus | "ALL";
  const entityType = ENTITIES.find((e) => e === sp.type);
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [data, vendors, byStatus, decided30, vendorsWaiting] = await Promise.all([
    listApprovals(user, { status, vendorId: sp.vendorId || undefined, entityType, page: Number(sp.page) || 1, q: sp.q }),
    db.vendor.findMany({ where: { users: { some: {} } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.approvalRequest.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    db.approvalRequest.groupBy({ by: ["status"], where: { decidedAt: { gte: since } }, _count: { _all: true }, orderBy: { status: "asc" } }),
    db.approvalRequest.findMany({ where: { status: "PENDING" }, distinct: ["vendorId"], select: { vendorId: true } }),
  ]);
  const n = (rows: typeof byStatus, s?: string) => rows.filter((b) => !s || s === "ALL" || b.status === s).reduce((t, b) => t + (typeof b._count === "object" ? b._count._all ?? 0 : 0), 0);
  const pendingCount = n(byStatus, "PENDING");
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/approvals${p.size ? `?${p}` : ""}`;
  };

  return (
    <SelectionProvider>
      <PageHeader title="Approvals" description="Review and approve every change your vendors submit." />
      <PageStats
        items={[
          { label: "Waiting for you", value: formatNumber(pendingCount), icon: Clock, tone: pendingCount ? "amber" : "neutral", sub: pendingCount ? "Vendor changes to review" : "All caught up", href: qs({ status: "PENDING" }) },
          { label: "Vendors waiting", value: formatNumber(vendorsWaiting.length), icon: Store, sub: "With at least one request" },
          { label: "Approved", value: formatNumber(n(decided30, "APPROVED")), icon: CheckCircle2, tone: "green", sub: "In the last 30 days", href: qs({ status: "APPROVED" }) },
          { label: "Rejected", value: formatNumber(n(decided30, "REJECTED")), icon: XCircle, tone: "red", sub: "In the last 30 days", href: qs({ status: "REJECTED" }) },
        ]}
      />
      <ApprovalBulk />
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.map((t) => ({ href: qs({ status: t.key }), label: t.label, count: n(byStatus, t.key), active: status === t.key }))} />}
        meta={showing(data.page, 30, data.total)}
        filters={
          <FilterBar action="/admin/approvals" bare oneLine>
            <input type="hidden" name="status" value={status} />
            <SearchField defaultValue={sp.q} placeholder="Search items, vendors or requesters…" />
            <SelectField name="vendorId" label="Vendor" value={sp.vendorId}>
              <option value="">All vendors</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </SelectField>
            <SelectField name="type" label="Type" value={entityType}>
              <option value="">All types</option>
              {ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_NAME[e]}</option>)}
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/approvals" params={{ status, vendorId: sp.vendorId, type: sp.type, q: sp.q }} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<ShieldCheck className="h-5 w-5" />} title={status === "PENDING" ? "No requests waiting" : "No requests found"}>
            {status === "PENDING" ? "When a vendor adds, edits, unpublishes or deletes something, it appears here for you to approve." : "Try another tab or filter."}
          </PanelEmpty>
        ) : (
          <AdminTable bare minWidth={64}>
            <thead>
              <tr><th className="w-10"><AllCheckbox ids={data.items.filter((r) => r.status === "PENDING").map((r) => r.id)} /></th><th>Request</th><th>Item</th><th>Vendor</th><th>Requested by</th><th>Submitted</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.status === "PENDING" && <RowCheckbox id={r.id} label={r.entityLabel} />}</td>
                  <td className="whitespace-nowrap"><ActionBadge action={r.action} /> <span className="ml-1 text-xs text-muted">{ENTITY_NAME[r.entityType]}</span></td>
                  <td className="max-w-[22rem]"><Link href={`/admin/approvals/${r.id}`} className="block truncate font-semibold hover:text-mint-ink">{r.entityLabel}</Link>{r.note && <span className="block truncate text-xs text-muted">“{r.note}”</span>}</td>
                  <td><Link href={`/admin/vendor-portal/${r.vendor.id}`} className="hover:text-mint-ink">{r.vendor.name}</Link></td>
                  <td className="text-muted">{r.requestedBy?.name ?? "—"}</td>
                  <td className="whitespace-nowrap text-muted" title={relativeTime(r.createdAt)}>{formatDateTime(r.createdAt)}</td>
                  <td className="whitespace-nowrap"><RequestStatusBadge status={r.status} />{r.decidedBy && <span className="block text-xs text-muted">by {r.decidedBy.name}</span>}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
