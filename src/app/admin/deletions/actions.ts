"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { cancelDeletion, decideDeletion } from "@/server/rbac/deletion";
import { actor, refresh } from "../_lib";

export const decideDeletionAction = action(
  z.object({ id: z.string().cuid(), decision: z.enum(["APPROVE", "REJECT"]), note: z.string().max(1000).nullable().optional() }),
  async ({ id, decision, note }) => {
    const status = await decideDeletion(await actor(), id, decision, note);
    refresh("/admin", "/admin/deletions", `/admin/deletions/${id}`);
    return ok(undefined, status === "APPROVED" ? "Approved — it has been deleted" : "Rejected — they've been told why");
  },
);

export const cancelDeletionAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await cancelDeletion(await actor(), id);
  refresh("/admin/deletions", `/admin/deletions/${id}`);
  return ok(undefined, "Request withdrawn");
});
