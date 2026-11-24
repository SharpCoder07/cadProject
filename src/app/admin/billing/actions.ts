"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { cancelSubscription, deletePlan, grantInput, grantSubscription, planInput, savePlan, setPlanVisible } from "@/server/services/billing";
import { razorpayInput, saveRazorpaySettings, testRazorpay } from "@/server/payments/razorpay";
import { actor } from "../_lib";

function refresh() {
  revalidatePath("/admin/billing", "layout");
  revalidatePath("/vendor", "layout");
}

export const savePlanAction = action(planInput.extend({ id: z.string().cuid().nullable() }), async ({ id, ...rest }) => {
  await savePlan(await actor(), id, rest);
  refresh();
  return ok(undefined, id ? "Plan saved" : "Plan created");
});

export const deletePlanAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  const r = await deletePlan(await actor(), id);
  refresh();
  return ok(undefined, r === "hidden" ? "This plan has been bought before, so it was hidden instead of deleted" : "Plan deleted");
});

export const setPlanVisibleAction = action(z.object({ id: z.string().cuid(), isActive: z.boolean() }), async ({ id, isActive }) => {
  await setPlanVisible(await actor(), id, isActive);
  refresh();
  return ok(undefined, isActive ? "Plan shown" : "Plan hidden");
});

export const grantSubscriptionAction = action(grantInput, async (input) => {
  await grantSubscription(await actor(), input);
  refresh();
  return ok(undefined, "Subscription added. The vendor can now see buyer contact details.");
});

export const cancelSubscriptionAction = action(z.object({ id: z.string().cuid(), reason: z.string().trim().max(300).default("") }), async ({ id, reason }) => {
  await cancelSubscription(await actor(), id, reason);
  refresh();
  return ok(undefined, "Subscription cancelled. Refund any payment from the Razorpay dashboard.");
});

export const saveRazorpayAction = action(razorpayInput, async (input) => {
  await saveRazorpaySettings(await actor(), input);
  revalidatePath("/admin/settings/payments");
  revalidatePath("/vendor/plans");
  return ok(undefined, "Payment settings saved");
});

export const testRazorpayAction = action(razorpayInput, async (input) => ok(undefined, await testRazorpay(await actor(), input)));
