import Link from "next/link";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listSubscriptions } from "@/server/services/billing";
import { formatINR } from "@/lib/billing";
import { formatDate, formatDateTime } from "@/lib/format";
import { CalendarClock, CreditCard, Hourglass, IndianRupee } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, SearchField, SelectField, showing } from "@/components/admin/list-panel";
import { CancelSubscriptionButton, GrantSubscriptionButton, SubscriptionBulk } from "./subscription-actions";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";

export const metadata = { title: "Subscriptions" };
export const dynamic = "force-dynamic";

const TABS = [["", "All"], ["active", "Active"], ["expired", "Expired"], ["cancelled", "Cancelled"], ["pending", "Not completed"]] as const;

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("billing.view", "/admin/billing/subscriptions");
  const sp = await searchParams;
  const now = new Date();
  const soon = new Date(now.getTime() + 14 * 86_400_000);
  const [data, activeCount, vendors, plans, expiring, unfinished] = await Promise.all([
    listSubscriptions(user, { status: sp.status, vendorId: sp.vendorId, page: Number(sp.page) || 1, q: sp.q }),
    db.vendorSubscription.groupBy({ by: ["vendorId"], where: { status: "ACTIVE", periodStart: { lte: now }, periodEnd: { gt: now } } }),
    db.vendor.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.vendorPlan.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }], select: { id: true, name: true, pricePaise: true, interval: true, isActive: true } }),
    db.vendorSubscription.count({ where: { status: "ACTIVE", periodEnd: { gt: now, lte: soon } } }),
    db.vendorSubscription.count({ where: { status: "PENDING" } }),
  ]);
  const href = (status: string) => {
    const p = new URLSearchParams(Object.entries({ status, vendorId: sp.vendorId, q: sp.q }).filter(([, v]) => v) as [string, string][]);
    return `/admin/billing/subscriptions${p.size ? `?${p}` : ""}`;
  };

  return (
    <SelectionProvider>
      <PageHeader
        title="Subscriptions"
        description="Track every vendor plan, bought online or added by your team."
        actions={<GrantSubscriptionButton vendors={vendors} plans={plans} />}
      />
      <PageStats
        items={[
          { label: "Active vendors", value: formatNumber(activeCount.length), icon: CreditCard, tone: "green", sub: "With a live plan", href: href("active") },
          { label: "Paid this month", value: formatINR(data.revenueThisMonth), icon: IndianRupee, tone: "red", sub: "Online payments" },
          { label: "Ending soon", value: formatNumber(expiring), icon: CalendarClock, tone: expiring ? "amber" : "neutral", sub: "In the next 14 days" },
          { label: "Not completed", value: formatNumber(unfinished), icon: Hourglass, sub: "Checkouts left unpaid", href: href("pending") },
        ]}
      />
      <SubscriptionBulk />
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.map(([key, label]) => ({ href: href(key), label, active: (sp.status ?? "") === key }))} />}
        meta={showing(data.page, 30, data.total)}
        filters={
          <FilterBar action="/admin/billing/subscriptions" bare oneLine>
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <SearchField defaultValue={sp.q} placeholder="Search vendors, plans or payment IDs…" />
            <SelectField name="vendorId" label="Vendor" value={sp.vendorId}>
              <option value="">All vendors</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/billing/subscriptions" params={sp} />}
      >
      {data.items.length === 0 ? (
        <PanelEmpty icon={<CreditCard className="h-5 w-5" />} title="No subscriptions here yet">Plans vendors buy, or that you add, appear here.</PanelEmpty>
      ) : (
        <AdminTable bare minWidth={60}>
          <thead><tr><th className="w-10"><AllCheckbox ids={data.items.filter((s) => s.status === "ACTIVE" && s.periodEnd && s.periodEnd > now).map((s) => s.id)} /></th><th>Vendor</th><th>Plan</th><th>Amount</th><th>Access period</th><th>Status</th><th>Payment</th><th /></tr></thead>
          <tbody>
            {data.items.map((s) => {
              const live = s.status === "ACTIVE" && s.periodEnd && s.periodEnd > now;
              const scheduled = live && s.periodStart && s.periodStart > now;
              const status = s.status === "PENDING" ? ["Not completed", "warning"] : s.status === "CANCELLED" ? ["Cancelled", "danger"] : !live ? ["Expired", "neutral"] : scheduled ? ["Starts later", "primary"] : ["Active", "success"];
              return (
                <tr key={s.id}>
                  <td>{live && <RowCheckbox id={s.id} label={`${s.planName} for ${s.vendor.name}`} />}</td>
                  <td><Link href={`/admin/vendor-portal/${s.vendor.id}`} className="font-medium hover:text-mint-ink">{s.vendor.name}</Link>{s.purchasedBy && <span className="block text-xs text-muted">by {s.purchasedBy.name}</span>}</td>
                  <td>{s.planName}</td>
                  <td className="tabular-nums">{s.source === "MANUAL" && s.amountPaise === 0 ? "Free" : formatINR(s.amountPaise)}</td>
                  <td className="whitespace-nowrap text-muted">{s.periodStart && s.periodEnd ? `${formatDate(s.periodStart)} – ${formatDate(s.periodEnd)}` : `Started ${formatDateTime(s.createdAt)}`}</td>
                  <td><Badge tone={status[1] as "success"}>{status[0]}</Badge></td>
                  <td className="text-xs text-muted">
                    {s.source === "MANUAL" ? "Added by admin" : <span className="font-mono">{s.razorpayPaymentId ?? s.razorpayOrderId ?? "—"}</span>}
                    {s.note && <span className="block max-w-[14rem] truncate" title={s.note}>{s.note}</span>}
                  </td>
                  <td className="text-right">{s.status === "ACTIVE" && live && <CancelSubscriptionButton id={s.id} label={`${s.planName} for ${s.vendor.name}`} />}</td>
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
