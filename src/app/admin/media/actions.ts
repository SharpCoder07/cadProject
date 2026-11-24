"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { revalidatePath } from "next/cache";
import { deleteMedia, mediaUsageFor, updateMedia } from "@/server/services/media";
import { actor } from "../_lib";

// Used by both the admin media library and the vendor portal's.
const refresh = () => {
  revalidatePath("/admin/media");
  revalidatePath("/vendor/media");
};

export const updateMediaAction = action(
  z.object({ id: z.string().cuid(), alt: z.string().trim().max(200).nullable(), caption: z.string().trim().max(300).nullable(), filename: z.string().trim().min(1).max(200) }),
  async ({ id, ...data }) => {
    await updateMedia(await actor(), id, data);
    refresh();
    return ok(undefined, "File details saved");
  },
);

export const mediaUsageAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  return ok(await mediaUsageFor(await actor(), id));
});

export const deleteMediaAction = action(z.object({ id: z.string().cuid(), force: z.boolean().default(false) }), async ({ id, force }) => {
  await deleteMedia(await actor(), id, force);
  refresh();
  return ok(undefined, "File deleted");
});
