"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { searchProductsForFavourites, setFavourite, setOfferEmails } from "@/server/services/offers";
import { deleteMyReview, reviewEdit, updateMyReview } from "@/server/services/reviews";
import { actor } from "@/app/admin/_lib";
import { setMyConsent } from "@/server/services/compliance/consent";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta, hashIp } from "@/server/request";

export const searchFavouritesAction = action(z.object({ q: z.string().max(100) }), async ({ q }) => ok(await searchProductsForFavourites(await actor(), q)));

export const setFavouriteAction = action(z.object({ softwareId: z.string().cuid(), on: z.boolean() }), async ({ softwareId, on }) => {
  await setFavourite(await actor(), softwareId, on);
  revalidatePath("/account/favourites");
  return ok(undefined, on ? "Added to favourites" : "Removed from favourites");
});

/** Bulk "Remove from favourites" (takes the product id as `id`). */
export const removeFavouriteAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await setFavourite(await actor(), id, false);
  revalidatePath("/account/favourites");
  revalidatePath("/account");
  return ok(undefined, "Removed from favourites");
});

export const setOfferEmailsAction = action(z.object({ on: z.boolean() }), async ({ on }) => {
  await setOfferEmails(await actor(), on);
  return ok(undefined, on ? "You'll get an email when a favourite has a new offer" : "Offer emails turned off");
});

export const updateMyReviewAction = action(reviewEdit, async (input) => {
  const { status } = await updateMyReview(await actor(), input);
  revalidatePath("/account/reviews");
  revalidatePath("/account");
  return ok(undefined, status === "PENDING" ? "Review updated — it's hidden until our team approves the changes" : "Review updated");
});

export const deleteMyReviewAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteMyReview(await actor(), id);
  revalidatePath("/account/reviews");
  revalidatePath("/account");
  return ok(undefined, "Review deleted");
});

/** Account › Settings › Privacy & consent: turn one optional purpose on or off (history is kept). */
export const setMyConsentAction = action(z.object({ purposeKey: z.string().regex(/^[a-z0-9_]{1,40}$/), granted: z.boolean() }), async ({ purposeKey, granted }) => {
  const me = await actor();
  await enforce(RULES.consentChange, me.id, "Too many changes. Try again in a few minutes.");
  const { ip } = await getRequestMeta();
  await setMyConsent(me, purposeKey, granted, hashIp(ip));
  revalidatePath("/account/settings");
  return ok(undefined, granted ? "Consent given" : "Consent withdrawn");
});

/** Account › Privacy center › Download my data (JSON). */
export const exportMyDataAction = action(z.object({}), async () => {
  const { exportMyData } = await import("@/server/services/compliance/cases");
  return ok(await exportMyData(await actor()), "Your data is downloading");
});
