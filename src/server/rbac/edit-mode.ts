import "server-only";
import { getStoredSettings } from "@/server/settings";
import { AppError } from "@/server/errors";
import type { Principal } from "./policy";
import { isEditModeRole, isEditModeUser } from "@/lib/edit-mode-roles";

export { EDIT_MODE_ROLES, isEditModeRole, isEditModeUser } from "@/lib/edit-mode-roles";

/*
 * Website edit mode (editing on the live pages): for Super Admin, Admin and staff roles given the
 * "Edit on the website" permission, while it's switched on in Admin › Website settings › Website edit
 * mode (only Super Admin and Admin can change that switch). What each person can change is still
 * checked per item by the same services as the admin panel.
 */

/** Can this person use edit mode on the website right now? */
export async function canUseEditMode(user: Principal | null | undefined) {
  if (!isEditModeUser(user)) return false;
  return (await getStoredSettings()).editMode.enabled;
}

/**
 * Website sidebar editor without the UI Editor: the admin bar and admin-menu sidebar on the website
 * (screens open over the page; each screen checks its own permissions). Same people as edit mode.
 */
export async function canUseSidebarOnly(user: Principal | null | undefined) {
  if (!isEditModeUser(user)) return false;
  const s = (await getStoredSettings()).editMode;
  return !s.enabled && s.sidebar;
}

export async function assertEditMode(user: Principal | null | undefined) {
  if (!(await canUseEditMode(user))) {
    throw new AppError(
      isEditModeUser(user) ? "The UI Editor is switched off (Admin › Website settings › Edit Mode)." : "Your role can't edit on the website. Make changes in the admin panel.",
      "FORBIDDEN",
    );
  }
}
