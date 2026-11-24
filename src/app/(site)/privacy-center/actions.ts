"use server";

import { action, ok } from "@/server/action";
import { getCurrentUser } from "@/server/auth/session";
import { getRequestMeta } from "@/server/request";
import { caseSubmission } from "@/lib/compliance/cases";
import { confirmCase, submitCase } from "@/server/services/compliance/cases";
import { z } from "zod";

/** Privacy center form (website and account): a data request or a complaint. */
export const submitCaseAction = action(caseSubmission, async (input) => {
  const user = await getCurrentUser().catch(() => null);
  const { ip } = await getRequestMeta();
  // Staff accounts use the admin; partners and buyers are verified by their session.
  const signedIn = user && !user.readOnly ? user : null;
  const r = await submitCase(input, { user: signedIn, ip, source: signedIn ? "account" : "website" });
  return ok(r);
});

export const confirmCaseAction = action(z.object({ token: z.string().max(200) }), async ({ token }) => ok(await confirmCase(token)));
