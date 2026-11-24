"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { categoryInput, categoryMove } from "@/lib/validation/taxonomy";
import { createCategory, deleteCategory, moveCategory, updateCategory } from "@/server/services/categories";
import { actor, refresh } from "../_lib";

export const saveCategoryAction = action(z.object({ id: z.string().cuid().nullable(), data: categoryInput }), async ({ id, data }) => {
  const user = await actor();
  const c = id ? await updateCategory(user, id, data) : await createCategory(user, data);
  refresh("/admin/categories");
  return ok({ id: c.id }, id ? "Category saved" : "Category created");
});

export const moveCategoryAction = action(categoryMove, async ({ id, parentId, orderedSiblingIds }) => {
  await moveCategory(await actor(), id, parentId, orderedSiblingIds);
  refresh("/admin/categories");
  return ok(undefined, "Order saved");
});

export const deleteCategoryAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteCategory(await actor(), id);
  refresh("/admin/categories");
  return ok(undefined, "Category deleted");
});
