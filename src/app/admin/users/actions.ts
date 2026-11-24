"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { email, requiredText } from "@/lib/validation/common";
import { createUserWithPassword, deleteRole, inviteUser, resendInvite, revokeAllSessions, revokeSession, saveRole, setUserStatus, updateUser } from "@/server/services/users";
import { resetTwoFactor } from "@/server/auth/two-factor";
import { unblockEmail, unblockNetwork } from "@/server/auth/login-guard";
import { actor, refresh } from "../_lib";

export const inviteUserAction = action(z.object({ name: requiredText(80), email, roleId: z.string().cuid(), vendorId: z.string().cuid().nullable().optional() }), async (input) => {
  const r = await inviteUser(await actor(), input);
  refresh("/admin/users");
  return ok({ id: r.user.id, inviteLink: r.inviteLink }, "Invitation sent");
});
export const createUserAction = action(
  z.object({ name: requiredText(80), email, roleId: z.string().cuid(), vendorId: z.string().cuid().nullable().optional(), password: z.string().max(128), mustChange: z.boolean().default(true) }),
  async (input) => {
    const u = await createUserWithPassword(await actor(), input);
    refresh("/admin/users");
    return ok({ id: u.id }, "User created");
  },
);
export const updateUserAction = action(z.object({ id: z.string().cuid(), name: requiredText(80), roleId: z.string().cuid(), vendorId: z.string().cuid().nullable().optional() }), async ({ id, ...rest }) => {
  await updateUser(await actor(), id, rest);
  refresh("/admin/users", `/admin/users/${id}`);
  return ok(undefined, "User saved");
});
export const setUserStatusAction = action(z.object({ id: z.string().cuid(), status: z.enum(["ACTIVE", "SUSPENDED"]) }), async ({ id, status }) => {
  await setUserStatus(await actor(), id, status);
  refresh("/admin/users", `/admin/users/${id}`);
  return ok(undefined, status === "SUSPENDED" ? "Account suspended and signed out everywhere" : "Account reactivated");
});
export const resendInviteAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  const link = await resendInvite(await actor(), id);
  return ok({ inviteLink: link }, "Invitation re-sent");
});
export const revokeSessionAction = action(z.object({ id: z.string().cuid(), userId: z.string().cuid() }), async ({ id, userId }) => {
  await revokeSession(await actor(), id);
  refresh(`/admin/users/${userId}`, "/admin/account");
  return ok(undefined, "Session signed out");
});
export const revokeAllSessionsAction = action(z.object({ userId: z.string().cuid() }), async ({ userId }) => {
  await revokeAllSessions(await actor(), userId);
  refresh(`/admin/users/${userId}`);
  return ok(undefined, "Signed out of all devices");
});
export const saveRoleAction = action(
  z.object({ id: z.string().cuid().nullable(), name: requiredText(60), key: z.string().regex(/^[A-Za-z_]{3,40}$/, "Letters and underscores"), description: z.string().max(300).nullable(), permissions: z.array(z.string()).max(100) }),
  async ({ id, ...rest }) => {
    await saveRole(await actor(), id, rest);
    refresh("/admin/roles");
    return ok(undefined, "Role saved — applies on the next page load");
  },
);
export const deleteRoleAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteRole(await actor(), id);
  refresh("/admin/roles");
  return ok(undefined, "Role deleted");
});

export const resetTwoFactorAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await resetTwoFactor(await actor(), id);
  refresh("/admin/users", `/admin/users/${id}`);
  return ok(undefined, "Two-step verification reset. They'll set up a new authenticator at their next sign-in.");
});

/** Users › Blocked sign-ins (takes the email or the network id as `id`, for the bulk bar). */
export const unblockEmailAction = action(z.object({ id: z.string().min(3).max(320) }), async ({ id }) => {
  await unblockEmail(await actor(), id);
  refresh("/admin/users/blocked");
  return ok(undefined, "Sign-in unblocked");
});
export const unblockNetworkAction = action(z.object({ id: z.string().regex(/^[a-f0-9]{16,64}$/) }), async ({ id }) => {
  await unblockNetwork(await actor(), id);
  refresh("/admin/users/blocked");
  return ok(undefined, "Network unblocked");
});
