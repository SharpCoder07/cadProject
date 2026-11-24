import { requirePermission } from "@/server/auth/session";
import { env } from "@/server/env";
import { getRazorpaySettings } from "@/server/payments/razorpay";
import { PageHeader } from "@/components/admin/page-header";
import { RazorpayForm } from "./razorpay-form";

export const metadata = { title: "Payment settings" };
export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  await requirePermission("billing.manage", "/admin/settings/payments");
  const s = await getRazorpaySettings();
  return (
    <>
      <PageHeader title="Payment settings" description="Manage Razorpay payments for vendor plans." />
      <div className="max-w-3xl">
        <RazorpayForm initial={s} webhookUrl={`${env.APP_URL.replace(/\/$/, "")}/api/webhooks/razorpay`} />
      </div>
    </>
  );
}
