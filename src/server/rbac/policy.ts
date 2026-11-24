import { AppError, forbidden } from "@/server/errors";
import { VENDOR_MEDIA_PERMISSIONS, type Permission } from "./permissions";

/** The authenticated principal as seen by policy checks. */
export interface Principal {
  id: string;
  email: string;
  name: string;
  roleKey: string;
  vendorId: string | null;
  permissions: ReadonlySet<Permission>;
  /** View-only (demo) account: can open pages but every change is refused. */
  readOnly?: boolean;
  /** Created by an admin with a password: must choose their own before using the admin / portals. */
  mustChangePassword?: boolean;
}

/** A resource that may belong to a vendor (software, lead, brand…). */
export interface VendorOwned {
  vendorId: string | null;
}

/**
 * Pure permission check.
 * - Vendor-portal users (vendorId set) only ever act on resources owned by their vendor,
 *   regardless of which permission is asked for.
 * - Staff users need the permission; resource ownership is not restricted.
 * The permission set already includes what a role implies and, for the Super Admin, everything
 * (see withSystem in server/auth/session.ts).
 */
export function can(user: Principal | null | undefined, permission: Permission, resource?: VendorOwned | null): boolean {
  if (!user) return false;
  if (!user.permissions.has(permission)) return false;
  // vendor.* permissions only ever apply inside a vendor company (never to staff accounts).
  if (permission.startsWith("vendor.") && !user.vendorId) return false;
  if (user.vendorId) {
    if (!permission.startsWith("vendor.") && !VENDOR_MEDIA_PERMISSIONS.includes(permission)) return false;
    if (resource !== undefined) return resource !== null && resource.vendorId === user.vendorId;
  }
  return true;
}

export function assertCan(user: Principal | null | undefined, permission: Permission, resource?: VendorOwned | null): asserts user is Principal {
  if (!user) throw new AppError("Sign in to continue.", "UNAUTHENTICATED");
  if (!can(user, permission, resource)) throw forbidden();
}

export function canAny(user: Principal | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(user, p));
}

export const isVendorUser = (user: Principal) => user.vendorId !== null;
/** The one role with full control: every deletion, roles and permissions, and approving deletion requests. */
export const isSuperAdmin = (user: Principal | null | undefined): boolean => Boolean(user && !user.vendorId && user.roleKey === "SUPER_ADMIN" && !user.readOnly);
