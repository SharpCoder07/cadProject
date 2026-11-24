"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { redirectInput } from "@/lib/validation/cms";
import { deleteRedirect, saveRedirect } from "@/server/services/navigation";
import { actor, refresh } from "../_lib";

export const saveRedirectAction = action(z.object({ id: z.string().cuid().nullable(), data: redirectInput }), async ({ id, data }) => {
  await saveRedirect(await actor(), id, data);
  refresh("/admin/seo");
  return ok(undefined, "Redirect saved — live within a minute");
});
export const deleteRedirectAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteRedirect(await actor(), id);
  refresh("/admin/seo");
  return ok(undefined, "Redirect deleted");
});
