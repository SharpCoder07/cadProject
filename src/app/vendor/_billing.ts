import "server-only";
import type { Principal } from "@/server/rbac/policy";
import { getVendorBilling } from "@/server/services/billing";
import type { UpgradeBilling } from "@/components/vendor/contact-lock";

/** What the Buy Plan dialog needs: this company's plans (vendor or reseller plans) and whether it can pay now. */
export async function upgradeBilling(user: Principal & { vendorId: string }): Promise<UpgradeBilling> {
  const b = await getVendorBilling(user);
  return {
    plans: b.plans.map((p) => ({ id: p.id, name: p.name, description: p.description, pricePaise: p.pricePaise, interval: p.interval, features: p.features, isFeatured: p.isFeatured })),
    canBuy: user.permissions.has("vendor.billing"),
    paymentsEnabled: b.paymentsEnabled,
    hasActive: Boolean(b.current),
  };
}
