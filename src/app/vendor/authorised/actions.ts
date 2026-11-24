"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { proposeResellerProduct, proposeResellerProductRemoval } from "@/server/services/resellers";
import { actor as me } from "@/app/admin/_lib";
const done = () => ["/vendor/authorised", "/vendor/requests", "/admin/approvals"].forEach((p) => revalidatePath(p));

export const proposeAuthorisedAction = action(
  z.object({ softwareId: z.string().cuid({ message: "Choose a product" }), partnerLevel: z.string().trim().max(60).nullable(), note: z.string().trim().max(500).nullish() }),
  async ({ softwareId, partnerLevel, note }) => {
    const r = await proposeResellerProduct(await me(), softwareId, partnerLevel, note);
    done();
    return ok(undefined, r.message);
  },
);

export const proposeAuthorisedRemovalAction = action(z.object({ softwareId: z.string().cuid(), note: z.string().trim().max(500).nullish() }), async ({ softwareId, note }) => {
  const r = await proposeResellerProductRemoval(await me(), softwareId, note);
  done();
  return ok(undefined, r.message);
});
