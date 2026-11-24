import "server-only";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { BUYER_ROLE_KEY } from "@/server/rbac/permissions";
import { sendTemplate } from "./config";

/**
 * Sends the right welcome email once an account becomes active for the first time:
 * buyers after confirming their email, vendor users and staff after accepting their invitation.
 * Never throws; a failed welcome email must not break sign-in.
 */
export async function sendWelcome(userId: string): Promise<void> {
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, status: true, role: { select: { key: true, name: true } }, vendor: { select: { name: true, kind: true } } } });
    if (!user || user.status !== "ACTIVE") return;
    const app = env.APP_URL.replace(/\/+$/, "");
    if (user.role.key === BUYER_ROLE_KEY) {
      await sendTemplate("welcome_buyer", user.email, { user_name: user.name, browse_url: `${app}/categories`, account_url: `${app}/account` });
    } else if (user.vendor?.kind === "RESELLER") {
      await sendTemplate("welcome_reseller", user.email, {
        user_name: user.name,
        vendor_name: user.vendor.name,
        portal_url: `${app}/reseller`,
        profile_url: `${app}/reseller/profile`,
        authorised_url: `${app}/reseller/authorised`,
        leads_url: `${app}/reseller/leads`,
      });
    } else if (user.vendor) {
      await sendTemplate("welcome_vendor", user.email, {
        user_name: user.name,
        vendor_name: user.vendor.name,
        portal_url: `${app}/vendor`,
        profile_url: `${app}/vendor/profile`,
        listings_url: `${app}/vendor/listings`,
        leads_url: `${app}/vendor/leads`,
      });
    } else {
      await sendTemplate("welcome_team", user.email, { user_name: user.name, role_name: user.role.name, admin_url: `${app}/admin`, account_url: `${app}/admin/account` });
    }
  } catch (e) {
    console.error("[email] welcome email failed", e);
  }
}
