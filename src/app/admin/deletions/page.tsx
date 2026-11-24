import Link from "next/link";
import type { ApprovalStatus } from "@prisma/client";
import { Trash2 } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { deletionWhat, listDeletions } from "@/server/rbac/deletion";
import { isSuperAdmin } from "@/server/rbac/policy";
import { formatDateTime, relativeTime } from "@/lib/format";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, SearchField, showing } from "@/components/admin/list-panel";
import { RequestStatusBadge } from "@/components/admin/approval-badges";

export const metadata = { title: "Deletion requests" };
export const dynamic = "force-dynamic";

const TABS: { key: ApprovalStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Withdrawn" },
  { key: "ALL", label: "All" },
];
type SP = { status?: string; page?: string; q?: string };

export default async function DeletionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("deletions.approve", "/admin/deletions");
  const sp = await searchParams;
  const status = (TABS.find((t) => t.key === sp.status)?.key ?? "PENDING") as ApprovalStatus | "ALL";
  const data = await listDeletions(user, { status, page: Number(sp.page) || 1, q: sp.q });
  const superAdmin = isSuperAdmin(user);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, page: undefined, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/deletions${p.size ? `?${p}` : ""}`;
  };
  return (
    <>
      <PageHeader
        title="Deletion requests"
        description={superAdmin
          ? "Deletions asked for by vendor and reseller users (their product, offer and team changes are in Approvals). Nothing is deleted until you approve."
          : "Deletions you asked for. Only the Super Admin can approve them; nothing is deleted until they do."}
      />
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.map((t) => ({ href: qs({ status: t.key }), label: t.label, active: status === t.key }))} />}
        meta={showing(data.page, 30, data.total)}
        filters={
          <FilterBar action="/admin/deletions" bare oneLine>
            <input type="hidden" name="status" value={status} />
            <SearchField defaultValue={sp.q} placeholder="Search items or people…" />
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/deletions" params={{ status, q: sp.q }} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<Trash2 className="h-5 w-5" />} title={status === "PENDING" ? "No requests waiting" : "No requests found"}>
            {superAdmin ? "When a vendor or reseller user asks to delete something, it appears here for you to approve." : "Nothing to show."}
          </PanelEmpty>
        ) : (
          <AdminTable bare minWidth={60}>
            <thead>
              <tr><th>What</th><th>Item</th>{superAdmin && <th>Requested by</th>}<th>Submitted</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-muted">Delete {deletionWhat(r.kind)}</td>
                  <td className="max-w-[26rem]">
                    <Link href={`/admin/deletions/${r.id}`} className="block truncate font-semibold hover:text-mint-ink">{r.label}</Link>
                    {r.detail && <span className="block truncate text-xs text-danger">Removes {r.detail}</span>}
                  </td>
                  {superAdmin && <td className="text-muted">{r.requestedBy?.name ?? "—"}{r.vendorId && <span className="block text-xs">Vendor user</span>}</td>}
                  <td className="whitespace-nowrap text-muted" title={relativeTime(r.createdAt)}>{formatDateTime(r.createdAt)}</td>
                  <td className="whitespace-nowrap"><RequestStatusBadge status={r.status} />{r.decidedBy && <span className="block text-xs text-muted">by {r.decidedBy.name}</span>}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </>
  );
}
