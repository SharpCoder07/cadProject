"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { requireUser, currentSessionId } from "@/server/auth/session";
import { requiredText } from "@/lib/validation/common";
import { changeMyPassword, sendMyResetLink, signOutMyOtherSessions, signOutMySession, updateMyProfile } from "@/server/services/account";
import { cancelAuthenticatorChange, confirmAuthenticatorChange, confirmOptionalTwoFactor, disableOptionalTwoFactor, regenerateBackupCodes, startAuthenticatorChange, startOptionalTwoFactor } from "@/server/auth/two-factor";

async function refresh() {
  revalidatePath("/admin", "layout");
}

export const updateProfileAction = action(
  z.object({ name: requiredText(80) }),
  async (input) => {
    await updateMyProfile(await requireUser("/admin/account"), input);
    await refresh();
    return ok(undefined, "Profile saved");
  },
);

export const changePasswordAction = action(
  z.object({ current: z.string().min(1, "Enter your current password").max(200), next: z.string().min(1, "Enter a new password").max(200) }),
  async (input) => {
    await changeMyPassword(await requireUser("/admin/account"), input, await currentSessionId());
    await refresh();
    return ok(undefined, "Password changed. Other devices have been signed out.");
  },
);

export const sendResetLinkAction = action(z.object({}), async () => {
  await sendMyResetLink(await requireUser("/admin/account"));
  return ok(undefined, "Reset link sent to your email");
});

export const signOutSessionAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await signOutMySession(await requireUser("/admin/account"), id);
  await refresh();
  return ok(undefined, "Device signed out");
});

export const signOutOthersAction = action(z.object({}), async () => {
  const n = await signOutMyOtherSessions(await requireUser("/admin/account"), await currentSessionId());
  await refresh();
  return ok(undefined, n ? `Signed out of ${n} other ${n === 1 ? "device" : "devices"}` : "No other devices were signed in");
});

// ─── Two-step verification (self-service for staff and vendor users alike) ───

const codeInput = z.object({ code: z.string().trim().min(6, "Enter a code").max(20) });

export const newBackupCodesAction = action(codeInput, async ({ code }) => {
  const codes = await regenerateBackupCodes(await requireUser("/admin/account"), code);
  return ok(codes);
});

export const startAuthenticatorChangeAction = action(codeInput, async ({ code }) => {
  const setup = await startAuthenticatorChange(await requireUser("/admin/account"), code);
  return ok(setup);
});

export const confirmAuthenticatorChangeAction = action(codeInput, async ({ code }) => {
  await confirmAuthenticatorChange(await requireUser("/admin/account"), code, await currentSessionId());
  await refresh();
  return ok(undefined, "Your new authenticator app is set up. The old one no longer works.");
});

// Buyer accounts: two-step verification is optional, so they can switch it on and off.
export const startOptionalTwoFactorAction = action(z.object({}), async () => ok(await startOptionalTwoFactor(await requireUser("/account/settings"))));

export const confirmOptionalTwoFactorAction = action(codeInput, async ({ code }) => {
  const codes = await confirmOptionalTwoFactor(await requireUser("/account/settings"), code);
  revalidatePath("/account", "layout");
  return ok(codes, "Two-step verification is on");
});

export const disableOptionalTwoFactorAction = action(codeInput, async ({ code }) => {
  await disableOptionalTwoFactor(await requireUser("/account/settings"), code);
  revalidatePath("/account", "layout");
  return ok(undefined, "Two-step verification is off");
});

export const cancelAuthenticatorChangeAction = action(z.object({}), async () => {
  await cancelAuthenticatorChange(await requireUser("/admin/account"));
  return ok(undefined);
});
