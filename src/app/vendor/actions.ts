"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { cancelRequest, proposeReviewReply, requestSoftwareAction } from "@/server/services/approvals";
import { email, requiredText } from "@/lib/validation/common";
import { proposeOwnPassword, proposeOwnProfile, proposeTeamAccess, proposeTeamInvite, proposeTeamPasswordReset, proposeTeamRemoval } from "@/server/services/vendor-team";
import { actor } from "@/app/admin/_lib";

async function refresh() {
  revalidatePath("/vendor", "layout");
  revalidatePath("/admin/approvals");
}

export const requestProductAction = action(
  z.object({ id: z.string().cuid(), action: z.enum(["DELETE", "UNPUBLISH", "PUBLISH"]), note: z.string().max(1000).nullable().optional() }),
  async ({ id, action: kind, note }) => {
    const r = await requestSoftwareAction(await actor(), id, kind, note);
    await refresh();
    return ok(undefined, r.message);
  },
);

export const cancelRequestAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await cancelRequest(await actor(), id);
  await refresh();
  return ok(undefined, "Request withdrawn");
});

export const proposeReplyAction = action(z.object({ reviewId: z.string().cuid(), reply: z.string().max(2000).nullable() }), async ({ reviewId, reply }) => {
  const r = await proposeReviewReply(await actor(), reviewId, reply);
  await refresh();
  return ok(undefined, r.message);
});

// ─── Team & own account (all become approval requests) ───────────────────────

const perms = z.array(z.string().max(60)).max(30);

export const proposeInviteAction = action(
  z.object({ name: requiredText(80), email, permissions: perms, note: z.string().max(1000).nullable().optional() }),
  async ({ note, ...input }) => {
    const r = await proposeTeamInvite(await actor(), input, note);
    await refresh();
    return ok(undefined, r.message);
  },
);

export const proposeAccessAction = action(
  z.object({ id: z.string().cuid(), name: requiredText(80), permissions: perms, note: z.string().max(1000).nullable().optional() }),
  async ({ id, note, ...input }) => {
    const r = await proposeTeamAccess(await actor(), id, input, note);
    await refresh();
    return ok(undefined, r.message);
  },
);

export const proposeRemovalAction = action(z.object({ id: z.string().cuid(), note: z.string().max(1000).nullable().optional() }), async ({ id, note }) => {
  const r = await proposeTeamRemoval(await actor(), id, note);
  await refresh();
  return ok(undefined, r.message);
});

export const proposeResetAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  const r = await proposeTeamPasswordReset(await actor(), id);
  await refresh();
  return ok(undefined, r.message);
});

export const proposeOwnNameAction = action(z.object({ name: requiredText(80) }), async ({ name }) => {
  const r = await proposeOwnProfile(await actor(), { name });
  await refresh();
  return ok(undefined, r.message);
});

export const proposeOwnPasswordAction = action(
  z.object({ current: z.string().min(1, "Enter your current password").max(200), next: z.string().min(1, "Enter a new password").max(200) }),
  async (input) => {
    const r = await proposeOwnPassword(await actor(), input);
    await refresh();
    return ok(undefined, r.message);
  },
);
