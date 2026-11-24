"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { deleteReviews, moderateReviews } from "@/server/services/reviews";
import { saveComparison, deleteComparison, comparisonInput, saveCompareShowcase } from "@/server/services/comparisons";
import { actor, refresh } from "../_lib";

const ids = z.array(z.string().cuid()).min(1).max(200);

export const moderateAction = action(z.object({ ids, status: z.enum(["APPROVED", "REJECTED", "PENDING"]) }), async ({ ids: list, status }) => {
  await moderateReviews(await actor(), list, status);
  refresh("/admin/reviews");
  return ok(undefined, status === "APPROVED" ? "Approved — now visible on the product page" : status === "REJECTED" ? "Rejected" : "Moved back to pending");
});
export const deleteReviewsAction = action(z.object({ ids }), async ({ ids: list }) => {
  await deleteReviews(await actor(), list);
  refresh("/admin/reviews");
  return ok(undefined, "Deleted");
});
export const saveComparisonAction = action(z.object({ id: z.string().cuid().nullable(), data: comparisonInput }), async ({ id, data }) => {
  await saveComparison(await actor(), id, data);
  refresh("/admin/comparisons");
  return ok(undefined, "Comparison saved");
});
export const deleteComparisonAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteComparison(await actor(), id);
  refresh("/admin/comparisons");
  return ok(undefined, "Comparison deleted");
});

/** Admin › Comparisons › Compare page: the two ready-made lists on the public compare page. */
export const saveCompareShowcaseAction = action(z.object({ value: z.unknown() }), async ({ value }) => {
  await saveCompareShowcase(await actor(), value);
  refresh("/admin/comparisons/showcase", "/compare");
  return ok(undefined, "Compare page lists saved");
});
