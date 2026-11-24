import Link from "next/link";
import type { ApprovalEntity, ApprovalStatus } from "@prisma/client";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import { db } from "@/server/db";
import { listApprovals } from "@/server/services/approvals";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, SearchField, SelectField, showing } from "@/components/admin/list-panel";
import { ActionBadge, ENTITY_NAME, RequestStatusBadge, actionLabel } from "@/components/admin/approval-badges";
import { DecisionNote } from "./decision-note";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { cancelRequestAction } from "../actions";
import { requireVendor } from "../_lib";
import { WithdrawButton } from "./withdraw-button";
import { MarkRejectedSeen } from "./mark-seen";

export const metadata = { title: "Approval requests" };
export const dynamic = "force-dynamic";

const TABS: { key: ApprovalStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export default async function VendorRequests({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string; type?: string }> }) {
  const user = await requireVendor("vendor.portal", "/vendor/requests");
  const sp = await searchParams;
  const ENTITIES: ApprovalEntity[] = ["SOFTWARE", "OFFER", "VENDOR_PROFILE", "REVIEW_REPLY", "VENDOR_USER", "RESELLER_PRODUCT"];
  const entityType = ENTITIES.find((e) => e === sp.type);
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "ALL") as ApprovalStatus | "ALL";
  const [data, byStatus] = await Promise.all([
    listApprovals(user, { status, entityType, q: sp.q, page: Number(sp.page) || 1 }),
    db.approvalRequest.groupBy({ by: ["status"], where: { vendorId: user.vendorId }, _count: { _all: true }, orderBy: { status: "asc" } }),
  ]);
  const count = (s?: string) => byStatus.filter((b) => !s || s === "ALL" || b.status === s).reduce((n, b) => n + (typeof b._count === "object" ? b._count._all ?? 0 : 0), 0);
  const href = (s: string, item?: { entityType: string; entityId: string }) =>
    item ? (item.entityType === "SOFTWARE" ? `/vendor/listings/${item.entityId}` : item.entityType === "VENDOR_PROFILE" ? "/vendor/profile" : item.entityType === "VENDOR_USER" ? (item.entityId === user.id ? "/vendor/account" : "/vendor/team") : item.entityType === "OFFER" ? "/vendor/offers" : item.entityType === "RESELLER_PRODUCT" ? "/vendor/authorised" : "/vendor/reviews") : `/vendor/requests?status=${s}`;

  const pendingIds = data.items.filter((r) => r.status === "PENDING").map((r) => r.id);
  return (
    <SelectionProvider>
      {(status === "REJECTED" || status === "ALL") && <MarkRejectedSeen userId={user.id} />}
      <PageHeader title="Approval requests" description="Track every change you've sent for approval." />
      <PageStats
        items={[
          { label: "All requests", value: formatNumber(count()), icon: ShieldCheck, tone: "red", sub: "Submitted by your team" },
          { label: "Pending", value: formatNumber(count("PENDING")), icon: Clock, tone: count("PENDING") ? "amber" : "neutral", sub: count("PENDING") ? "Being reviewed" : "Nothing waiting", href: href("PENDING") },
          { label: "Approved", value: formatNumber(count("APPROVED")), icon: CheckCircle2, tone: "green", sub: "Now live", href: href("APPROVED") },
          { label: "Rejected", value: formatNumber(count("REJECTED")), icon: XCircle, sub: "See the reason and resubmit", href: href("REJECTED") },
        ]}
      />
      <BulkActionBar noun="request" items={[{ label: "Withdraw", action: cancelRequestAction, done: "Withdrew", danger: true, recycleBin: false, confirm: "Withdrawn requests are taken off the Super Admin's list. Only pending requests can be withdrawn." }]} />
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.map((t) => ({ href: href(t.key), label: t.label, count: count(t.key), active: status === t.key }))} />}
        meta={showing(data.page, 30, data.total)}
        filters={
          <FilterBar action="/vendor/requests" bare oneLine>
            {status !== "ALL" && <input type="hidden" name="status" value={status} />}
            <SearchField defaultValue={sp.q} placeholder="Search items or people…" />
            <SelectField name="type" label="Type" value={entityType}>
              <option value="">All types</option>
              {ENTITIES.map((e) => <option key={e} value={e}>{ENTITY_NAME[e]}</option>)}
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/vendor/requests" params={{ status, q: sp.q, type: entityType }} />}
      >
      {data.items.length === 0 ? (
        <PanelEmpty icon={<ShieldCheck className="h-5 w-5" />} title="No requests here">When you add or change a product, your company profile or a review reply, the request shows up here.</PanelEmpty>
      ) : (
        <AdminTable bare minWidth={60}>
          <thead><tr><th className="w-10">{pendingIds.length > 0 && <AllCheckbox ids={pendingIds} />}</th><th>Request</th><th>Item</th><th>Submitted by</th><th>Submitted</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.items.map((r) => (
              <tr key={r.id}>
                <td>{r.status === "PENDING" && <RowCheckbox id={r.id} label={r.entityLabel} />}</td>
                <td className="whitespace-nowrap"><ActionBadge action={r.action} /> <span className="ml-1 text-xs text-muted">{ENTITY_NAME[r.entityType]}</span></td>
                <td className="max-w-[24rem]">
                  <Link href={href("", r)} className="block truncate font-medium hover:text-mint-ink">{r.entityLabel}</Link>
                </td>
                <td className="text-muted">{r.requestedBy?.name ?? "—"}</td>
                <td className="whitespace-nowrap text-muted" title={relativeTime(r.createdAt)}>{formatDateTime(r.createdAt)}</td>
                <td className="whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <RequestStatusBadge status={r.status} />
                    {r.decisionNote && r.status !== "PENDING" && (
                      <DecisionNote rejected={r.status === "REJECTED"} item={r.entityLabel} request={`${actionLabel(r.action)} · ${ENTITY_NAME[r.entityType]}`} note={r.decisionNote} when={r.decidedAt ? formatDateTime(r.decidedAt) : null} />
                    )}
                  </span>
                  {r.decidedAt && r.status !== "PENDING" && <span className="block text-xs text-muted">{formatDateTime(r.decidedAt)}</span>}
                </td>
                <td className="text-right">{r.status === "PENDING" && <WithdrawButton id={r.id} />}</td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
      </ListPanel>
    </SelectionProvider>
  );
}
