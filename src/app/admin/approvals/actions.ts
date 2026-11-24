"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { decideRequest } from "@/server/services/approvals";
import { actor, refresh } from "../_lib";

export const decideRequestAction = action(
  z.object({ id: z.string().cuid(), decision: z.enum(["APPROVE", "REJECT"]), note: z.string().max(1000).nullable().optional() }),
  async ({ id, decision, note }) => {
    const status = await decideRequest(await actor(), id, decision, note);
    refresh("/admin", "/admin/approvals", `/admin/approvals/${id}`, "/admin/software", "/admin/vendor-portal", "/vendor/requests", "/vendor/listings");
    return ok(undefined, status === "APPROVED" ? "Approved and applied" : "Rejected — the vendor has been told why");
  },
);
