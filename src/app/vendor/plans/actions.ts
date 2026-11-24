"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { confirmCheckout, startCheckout } from "@/server/services/billing";
import { actor } from "@/app/admin/_lib";

export const startCheckoutAction = action(z.object({ planId: z.string().cuid() }), async ({ planId }) => ok(await startCheckout(await actor(), planId)));

export const confirmCheckoutAction = action(
  z.object({ orderId: z.string().min(1).max(60), paymentId: z.string().min(1).max(60), signature: z.string().min(1).max(200) }),
  async (input) => {
    const sub = await confirmCheckout(await actor(), input);
    revalidatePath("/vendor", "layout");
    return ok({ periodEnd: sub.periodEnd?.toISOString() ?? null }, "Payment received. Your plan is active.");
  },
);
