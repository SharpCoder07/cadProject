/**
 * Who may use website edit mode (editing on the live pages). Pure data, safe anywhere; the server
 * checks it on every edit-mode request (server/rbac/edit-mode.ts).
 *
 * - Super Admin and Admin always may (while edit mode is switched on), and only they can switch it.
 * - Other staff roles may when the role has the "Edit on the website" permission (Admin › Roles).
 *   They still only see and save what their role can change in the admin panel.
 * - Vendor, reseller, buyer and view-only accounts never may.
 */
export const EDIT_MODE_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;
export const EDIT_MODE_PERMISSION = "site.editMode";

interface Who { roleKey: string; vendorId: string | null; readOnly?: boolean; permissions?: ReadonlySet<string>; mustChangePassword?: boolean }

// Not until they've chosen their own password (accounts created with an admin's password).
const isStaff = (u: Who) => !u.vendorId && !u.readOnly && u.roleKey !== "BUYER" && !u.mustChangePassword;

/** Super Admin or Admin: always allowed edit mode, and the only ones who can switch it on or off. */
export const isEditModeRole = (user: Who | null | undefined) => Boolean(user && isStaff(user) && (EDIT_MODE_ROLES as readonly string[]).includes(user.roleKey));

/** May use edit mode (when it's switched on). */
export const isEditModeUser = (user: Who | null | undefined) => Boolean(user && isStaff(user) && (isEditModeRole(user) || user.permissions?.has(EDIT_MODE_PERMISSION)));
