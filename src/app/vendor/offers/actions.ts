"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { offerInput, proposeOffer, proposeOfferRemoval } from "@/server/services/offers";
import { actor } from "@/app/admin/_lib";

function refresh() {
  revalidatePath("/vendor", "layout");
  revalidatePath("/admin/approvals");
}

export const proposeOfferAction = action(
  z.intersection(offerInput, z.object({ id: z.string().cuid().nullable(), note: z.string().max(1000).nullable().optional() })),
  async ({ id, note, ...offer }) => {
    const r = await proposeOffer(await actor(), id, offer, note);
    refresh();
    return ok(undefined, r.message);
  },
);

export const removeOfferAction = action(z.object({ id: z.string().cuid(), note: z.string().max(1000).nullable().optional() }), async ({ id, note }) => {
  const r = await proposeOfferRemoval(await actor(), id, note);
  refresh();
  return ok(undefined, r.message);
});
