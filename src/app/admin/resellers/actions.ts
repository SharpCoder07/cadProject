"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { removeAuthorisedProduct, setAuthorisedProduct } from "@/server/services/resellers";
import { actor, refresh } from "../_lib";

const id = z.string().cuid();

export const setAuthorisedProductAction = action(
  z.object({ resellerId: id, softwareId: id, partnerLevel: z.string().trim().max(60).nullable(), note: z.string().nullish() }),
  async ({ resellerId, softwareId, partnerLevel }) => {
    await setAuthorisedProduct(await actor(), resellerId, softwareId, partnerLevel);
    refresh(`/admin/resellers/${resellerId}`, "/admin/resellers");
    return ok(undefined, "Authorised product saved");
  },
);

export const removeAuthorisedProductAction = action(z.object({ resellerId: id, softwareId: id, note: z.string().nullish() }), async ({ resellerId, softwareId }) => {
  await removeAuthorisedProduct(await actor(), resellerId, softwareId);
  refresh(`/admin/resellers/${resellerId}`, "/admin/resellers");
  return ok(undefined, "Removed");
});
