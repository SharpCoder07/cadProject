import "server-only";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertEditMode } from "@/server/rbac/edit-mode";

/** For website edit-mode API routes: the signed-in staff member, if edit mode is allowed for them and switched on. */
export async function editModeUser() {
  const user = await getCurrentUser();
  if (!user || user.vendorId) throw new AppError("Sign in to the admin panel to edit.", "UNAUTHENTICATED");
  await assertEditMode(user);
  return user;
}
