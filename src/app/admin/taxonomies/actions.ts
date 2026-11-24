"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { action, ok } from "@/server/action";
import { deleteTerms, installStarterTerms, saveTerm, termInput } from "@/server/services/taxonomies";
import { TAXONOMY_KINDS } from "@/lib/taxonomies";
import { actor } from "../_lib";

const kind = z.enum(TAXONOMY_KINDS);

export const saveTermAction = action(z.intersection(termInput, z.object({ kind, id: z.string().cuid().nullable() })), async ({ kind: k, id, ...data }) => {
  const t = await saveTerm(await actor(), k, id, data);
  revalidatePath("/admin/taxonomies", "layout");
  return ok({ id: t.id }, id ? "Saved" : `Added “${t.name}”`);
});

export const deleteTermsAction = action(z.object({ kind, ids: z.array(z.string().cuid()).min(1).max(200) }), async ({ kind: k, ids }) => {
  const n = await deleteTerms(await actor(), k, ids);
  revalidatePath("/admin/taxonomies", "layout");
  return ok(undefined, `Deleted ${n} ${n === 1 ? "term" : "terms"}`);
});

export const installStarterTermsAction = action(z.object({ kind }), async ({ kind: k }) => {
  const n = await installStarterTerms(await actor(), k);
  revalidatePath("/admin/taxonomies", "layout");
  return ok(undefined, n ? `Added ${n} starter ${n === 1 ? "term" : "terms"}` : "All starter terms are already there");
});
