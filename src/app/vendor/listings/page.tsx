import Link from "next/link";
import { Clock, Globe, Inbox, Package, Pencil, Plus } from "lucide-react";
import { db } from "@/server/db";
import { listSoftwareAdmin } from "@/server/services/software";
import { requestStateFor } from "@/server/services/approvals";
import { formatNumber, formatDateTime } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { AdminTable, FilterBar, PageHeader, StatusBadge } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PillTabs, ROW_ICON, SearchField, showingAll } from "@/components/admin/list-panel";
import { SoftwareLogo } from "@/components/site/software-card";
import { requireVendor } from "../_lib";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { requestProductAction } from "../actions";
import { DecisionNote } from "../requests/decision-note";

export const metadata = { title: "Products" };
export const dynamic = "force-dynamic";

const PENDING_LABEL = { CREATE: "Awaiting approval to publish", UPDATE: "Changes awaiting approval", DELETE: "Deletion requested", PUBLISH: "Awaiting approval to re-publish", UNPUBLISH: "Unpublish requested", PASSWORD: "Pending" } as const;
const TABS = [
  ["ALL", "All"],
  ["PUBLISHED", "Live"],
  ["DRAFT", "Drafts"],
  ["IN_REVIEW", "In review"],
  ["ARCHIVED", "Archived"],
] as const;

export default async function VendorListings({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requireVendor("vendor.listings", "/vendor/listings");
  const sp = await searchParams;
  const status = TABS.find(([k]) => k === sp.status)?.[0] ?? "ALL";
  const canSubmit = user.permissions.has("vendor.listings.submit");
  const [data, byStatus, pendingCount] = await Promise.all([
    listSoftwareAdmin(user, { perPage: 100, q: sp.q, status }),
    db.software.groupBy({ by: ["status"], where: { vendorId: user.vendorId }, _count: { _all: true }, _sum: { enquiryCount: true }, orderBy: { status: "asc" } }),
    db.approvalRequest.count({ where: { vendorId: user.vendorId, entityType: "SOFTWARE", status: "PENDING" } }),
  ]);
  const states = await requestStateFor(user.vendorId, "SOFTWARE", data.items.map((s) => s.id));
  const count = (s?: string) => byStatus.filter((b) => !s || s === "ALL" || b.status === s).reduce((n, b) => n + (typeof b._count === "object" ? b._count._all ?? 0 : 0), 0);
  const enquiries = byStatus.reduce((n, b) => n + (b._sum.enquiryCount ?? 0), 0);
  const href = (s: string) => {
    const p = new URLSearchParams(Object.entries({ status: s === "ALL" ? undefined : s, q: sp.q }).filter(([, v]) => v) as [string, string][]);
    return `/vendor/listings${p.size ? `?${p}` : ""}`;
  };
  const add = canSubmit ? <ButtonLink size="sm" href="/vendor/listings/new"><Plus className="h-4 w-4" aria-hidden /> Add a product</ButtonLink> : undefined;
  const canDelete = user.permissions.has("vendor.listings.delete");
  // Rows with a request already waiting can't be ticked (one request per product at a time).
  const selectable = data.items.filter((s) => states.get(s.id)?.status !== "PENDING").map((s) => s.id);
  const bulk = [
    ...(canSubmit ? [{ label: "Request publish", action: requestProductAction, extra: { action: "PUBLISH", note: null }, done: "Requested publishing for", confirm: "The Super Admin reviews each product before it goes live." }] : []),
    ...(canDelete ? [
      { label: "Request unpublish", action: requestProductAction, extra: { action: "UNPUBLISH", note: null }, done: "Requested unpublishing for", confirm: "Each product stays live until the Super Admin approves." },
      { label: "Request deletion", action: requestProductAction, extra: { action: "DELETE", note: null }, done: "Requested deletion for", danger: true, recycleBin: false, confirm: "Each product is deleted only after the Super Admin approves." },
    ] : []),
  ];
  return (
    <SelectionProvider>
      <PageHeader title="Your products" description="Manage every product your company lists." actions={add} />
      <PageStats
        items={[
          { label: "Products", value: formatNumber(count()), icon: Package, tone: "red", sub: "Listed by your company" },
          { label: "Live", value: formatNumber(count("PUBLISHED")), icon: Globe, tone: "green", sub: "Visible to buyers", href: href("PUBLISHED") },
          { label: "Awaiting approval", value: formatNumber(pendingCount), icon: Clock, tone: pendingCount ? "amber" : "neutral", sub: pendingCount ? "Being reviewed by our team" : "Nothing waiting", href: "/vendor/requests?status=PENDING" },
          { label: "Product enquiries", value: formatNumber(enquiries), icon: Inbox, sub: "1 lead counts once per product it asks about" },
        ]}
      />
      {bulk.length > 0 && <BulkActionBar noun="product" items={bulk} />}
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.filter(([k]) => k === "ALL" || k === "PUBLISHED" || count(k) > 0).map(([k, label]) => ({ href: href(k), label, count: count(k), active: status === k }))} />}
        meta={showingAll(data.items.length)}
        filters={
          count() > 0 && (
            <FilterBar action="/vendor/listings" bare oneLine>
              {status !== "ALL" && <input type="hidden" name="status" value={status} />}
              <SearchField defaultValue={sp.q} placeholder="Search your products…" />
            </FilterBar>
          )
        }
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<Package className="h-5 w-5" />} title={count() === 0 ? "No products yet" : "No matching products"} action={count() === 0 ? add : undefined}>
            {count() > 0 ? "Try another status or search." : canSubmit ? "Add a product. It goes live once it's approved." : "Your company hasn't added any products yet."}
          </PanelEmpty>
        ) : (
          <AdminTable bare minWidth={56}>
            <thead><tr>{bulk.length > 0 && <th className="w-10"><AllCheckbox ids={selectable} /></th>}<th>Product</th><th>Website status</th><th>Approval</th><th className="text-right" title="Each lead counts once for every product it asks about, so this can be higher than the number of leads.">Enquiries</th><th>Updated</th><th className="w-12"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {data.items.map((s) => {
                const st = states.get(s.id);
                return (
                  <tr key={s.id}>
                    {bulk.length > 0 && <td>{st?.status !== "PENDING" && <RowCheckbox id={s.id} label={s.name} />}</td>}
                    <td>
                      <div className="flex items-center gap-3">
                        <SoftwareLogo logo={s.logo} name={s.name} size={36} />
                        <Link href={`/vendor/listings/${s.id}`} className="font-semibold text-ink hover:text-mint-ink">{s.name}</Link>
                      </div>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      {st?.status === "PENDING" ? <Badge tone="accent">{PENDING_LABEL[st.action]}</Badge> : st?.status === "REJECTED" ? <span className="inline-flex items-center gap-1.5"><Badge tone="danger">Rejected</Badge><DecisionNote rejected item={s.name} request={PENDING_LABEL[st.action] ?? "Change"} note={st.decisionNote || "No reason was given."} when={formatDateTime(st.updatedAt)} /></span> : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-right tabular-nums">{s.enquiryCount}</td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(s.updatedAt)}</td>
                    <td><div className="flex justify-end"><Link href={`/vendor/listings/${s.id}`} title="Edit" aria-label={`Edit ${s.name}`} className={ROW_ICON}><Pencil className="h-4 w-4" /></Link></div></td>
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
