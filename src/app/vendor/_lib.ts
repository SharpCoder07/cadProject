import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { can, type Principal } from "@/server/rbac/policy";
import type { Permission } from "@/server/rbac/permissions";

/** Vendor-portal page guard: signed in, belongs to a vendor, and holds `permission` for that vendor. */
export async function requireVendor(permission: Permission, path: string): Promise<Principal & { vendorId: string }> {
  const user = await requireUser(path);
  if (!user.vendorId) redirect("/admin");
  if (!can(user, permission, { vendorId: user.vendorId })) redirect("/vendor?denied=1");
  return user as Principal & { vendorId: string };
}
