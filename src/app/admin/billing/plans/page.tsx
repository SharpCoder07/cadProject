import { CreditCard, Eye, Sparkles, Users } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { listPlansAdmin } from "@/server/services/billing";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { NewPlanButton, PlansManager } from "./plans-manager";

export const metadata = { title: "Vendor plans" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await requirePermission("billing.view", "/admin/billing/plans");
  const plans = await listPlansAdmin(user);
  return (
    <>
      <PageHeader title="Vendor plans" description="Manage every plan vendors can buy in their portal." actions={<NewPlanButton />} />
      <PageStats
        items={[
          { label: "Plans", value: plans.length, icon: CreditCard, tone: "red", sub: "In total" },
          { label: "Visible", value: plans.filter((p) => p.isActive).length, icon: Eye, tone: "green", sub: "Vendors can buy these" },
          { label: "Active vendors", value: plans.reduce((n, p) => n + p._count.subscriptions, 0), icon: Users, sub: "On a plan right now" },
          { label: "Highlighted", value: plans.filter((p) => p.isFeatured).length, icon: Sparkles, sub: "Marked as popular" },
        ]}
      />
      <PlansManager
        plans={plans.map((p) => ({ id: p.id, name: p.name, description: p.description ?? "", price: p.pricePaise / 100, interval: p.interval, features: p.features, isActive: p.isActive, isFeatured: p.isFeatured, sortOrder: p.sortOrder, audience: p.audience, activeCount: p._count.subscriptions }))}
      />
    </>
  );
}
