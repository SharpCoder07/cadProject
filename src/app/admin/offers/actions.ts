"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { deleteOffer, endOffer, offerInput, saveOffer } from "@/server/services/offers";
import { actor } from "../_lib";

// Validated here (field by field) so the form can highlight mistakes; the service validates again.
export const saveOfferAction = action(z.intersection(offerInput, z.object({ id: z.string().cuid().nullable(), publish: z.boolean() })), async ({ id, publish, ...offer }) => {
  const o = await saveOffer(await actor(), id, offer, publish);
  revalidatePath("/admin/offers");
  return ok(undefined, o.status === "PUBLISHED" ? (o.startsAt > new Date() ? "Offer scheduled" : "Offer is live") : "Draft saved");
});

export const endOfferAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await endOffer(await actor(), id);
  revalidatePath("/admin/offers");
  return ok(undefined, "Offer ended");
});

export const deleteOfferAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteOffer(await actor(), id);
  revalidatePath("/admin/offers");
  return ok(undefined, "Offer deleted");
});
