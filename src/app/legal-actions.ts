"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { actor } from "@/app/admin/_lib";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta, hashIp } from "@/server/request";
import { acceptPending } from "@/server/services/compliance/legal";

/** "I've read and accept" on the update notice in the account area and partner portals. */
export const acceptLegalUpdatesAction = action(z.object({ versionIds: z.array(z.string().min(1).max(40)).min(1).max(20) }), async ({ versionIds }) => {
  const me = await actor();
  await enforce(RULES.consentChange, me.id, "Too many requests. Try again in a few minutes.");
  const meta = await getRequestMeta();
  await acceptPending(me, versionIds, { ipHash: hashIp(meta.ip), userAgent: meta.userAgent });
  revalidatePath("/", "layout");
  return ok(undefined, "Thank you, your acceptance is recorded");
});
