import { CalendarClock, CheckCircle2, Lock } from "lucide-react";
import { getVendorBilling } from "@/server/services/billing";
import { formatDate, formatDateTime } from "@/lib/format";
import { formatINR } from "@/lib/billing";
import { Alert, Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/misc";
import { AdminTable, PageHeader } from "@/components/admin/page-header";
import { requireVendor } from "../_lib";
import { PlansGrid } from "./plans-grid";

export const metadata = { title: "Plans & billing" };
export const dynamic = "force-dynamic";

const daysLeft = (d: Date) => Math.max(0, Math.ceil((d.getTime() - Date.now()) / 86_400_000));

export default async function VendorPlans() {
  const user = await requireVendor("vendor.portal", "/vendor/plans");
  const { plans, current, upcoming, history, paymentsEnabled, testMode } = await getVendorBilling(user);
  const canBuy = user.permissions.has("vendor.billing");
  const now = new Date();

  return (
    <>
      <PageHeader title="Plans & billing" description="Manage your plan and billing." />
      <div className="space-y-6">
        {current ? (
          <div className="flex flex-wrap items-center gap-3 rounded-panel border border-success/30 bg-success/5 px-5 py-4">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-success" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{current.planName} plan is active</p>
              <p className="text-sm text-muted">
                Until {formatDate(current.periodEnd!)} · {daysLeft(current.periodEnd!)} days left
                {upcoming && ` · then ${upcoming.planName} until ${formatDate(upcoming.periodEnd!)}`}
              </p>
            </div>
            {daysLeft(current.periodEnd!) <= 14 && !upcoming && <Badge tone="warning">Renew soon</Badge>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface px-5 py-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint-ink"><Lock className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">No active plan</p>
              <p className="text-sm text-muted">Buyer emails and phone numbers on your leads are hidden until you buy a plan.</p>
            </div>
          </div>
        )}

        {!paymentsEnabled && <Alert tone="info" title="Online payment isn't available yet">Contact our team to subscribe; we&apos;ll switch your plan on for you.</Alert>}
        {paymentsEnabled && testMode && <Alert tone="warning" title="Test mode">Payments use Razorpay&apos;s test environment, so no real money is taken.</Alert>}
        {!canBuy && paymentsEnabled && <Alert tone="info">Only your company&apos;s Vendor Admin can buy plans. Ask them, or ask the Super Admin to give you &ldquo;Buy plans&rdquo; access.</Alert>}

        <PlansGrid
          plans={plans.map((p) => ({ id: p.id, name: p.name, description: p.description, pricePaise: p.pricePaise, interval: p.interval, features: p.features, isFeatured: p.isFeatured }))}
          canBuy={canBuy}
          paymentsEnabled={paymentsEnabled}
          hasActive={Boolean(current)}
        />

        <Panel>
          <PanelHeader title="Billing history" description="Payments are processed securely by Razorpay." />
          {history.length === 0 ? (
            <EmptyState title="No payments yet" icon={<CalendarClock className="h-6 w-6" />} />
          ) : (
            <AdminTable minWidth={44}>
              <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Period</th><th>Status</th><th>Payment ID</th></tr></thead>
              <tbody>
                {history.map((h) => {
                  const expired = h.status === "ACTIVE" && h.periodEnd && h.periodEnd <= now;
                  const scheduled = h.status === "ACTIVE" && h.periodStart && h.periodStart > now;
                  return (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap">{formatDateTime(h.paidAt ?? h.createdAt)}</td>
                      <td>{h.planName}{h.purchasedBy && <span className="block text-xs text-muted">by {h.purchasedBy.name}</span>}</td>
                      <td className="tabular-nums">{h.source === "MANUAL" && h.amountPaise === 0 ? "Complimentary" : formatINR(h.amountPaise)}</td>
                      <td className="whitespace-nowrap text-muted">{h.periodStart && h.periodEnd ? `${formatDate(h.periodStart)} – ${formatDate(h.periodEnd)}` : "—"}</td>
                      <td>
                        <Badge tone={h.status === "CANCELLED" || expired ? "neutral" : h.status === "PENDING" ? "warning" : "success"}>
                          {h.status === "PENDING" ? "Not completed" : h.status === "CANCELLED" ? "Cancelled" : expired ? "Expired" : scheduled ? "Starts later" : "Active"}
                        </Badge>
                      </td>
                      <td className="font-mono text-xs text-muted">{h.razorpayPaymentId ?? (h.source === "MANUAL" ? "Added by our team" : "—")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          )}
        </Panel>
      </div>
    </>
  );
}
