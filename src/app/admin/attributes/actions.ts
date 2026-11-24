"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { attributeInput, industryInput } from "@/lib/validation/taxonomy";
import { deleteAttribute, deleteIndustry, reorderAttributes, saveAttribute, saveIndustry } from "@/server/services/taxonomy";
import { actor, refresh } from "../_lib";

export const saveAttributeAction = action(z.object({ id: z.string().cuid().nullable(), data: attributeInput }), async ({ id, data }) => {
  await saveAttribute(await actor(), id, data);
  refresh("/admin/attributes");
  return ok(undefined, "Attribute saved");
});
export const deleteAttributeAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteAttribute(await actor(), id);
  refresh("/admin/attributes");
  return ok(undefined, "Attribute deleted");
});
export const reorderAttributesAction = action(z.object({ ids: z.array(z.string().cuid()).max(500) }), async ({ ids }) => {
  await reorderAttributes(await actor(), ids);
  return ok(undefined);
});
export const saveIndustryAction = action(z.object({ id: z.string().cuid().nullable(), data: industryInput }), async ({ id, data }) => {
  await saveIndustry(await actor(), id, data);
  refresh("/admin/industries");
  return ok(undefined, "Industry saved");
});
export const deleteIndustryAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteIndustry(await actor(), id);
  refresh("/admin/industries");
  return ok(undefined, "Industry deleted");
});
