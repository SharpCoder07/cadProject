import "server-only";
import { AppError, forbidden } from "@/server/errors";
import type { Principal } from "@/server/rbac/policy";

/** The recycle bin and backups are for Super Admins only, whatever a custom role is given. */
export const isSystemAdmin = (u: Principal | null | undefined): u is Principal => u?.roleKey === "SUPER_ADMIN";

export function assertSystemAdmin(u: Principal | null | undefined): asserts u is Principal {
  if (!u) throw new AppError("Sign in to continue.", "UNAUTHENTICATED");
  if (!isSystemAdmin(u)) throw forbidden("Only a Super Admin can do this.");
}
