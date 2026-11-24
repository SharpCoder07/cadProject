"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { authorInput, blogCategoryInput, postInput, publishInput } from "@/lib/validation/cms";
import { deleteAuthor, deleteBlogCategory, deletePost, restorePostRevision, saveAuthor, saveBlogCategory, savePost, setPostStatus } from "@/server/services/blog";
import { actor, refresh } from "../_lib";

export const savePostAction = action(z.object({ id: z.string().cuid().nullable(), data: postInput }), async ({ id, data }) => {
  const p = await savePost(await actor(), id, data);
  refresh("/admin/blog", `/admin/blog/${p.id}`);
  return ok({ id: p.id }, id ? "Post saved" : "Draft created");
});
export const setPostStatusAction = action(publishInput, async ({ id, status, scheduledAt }) => {
  await setPostStatus(await actor(), id, status, scheduledAt);
  refresh("/admin/blog", `/admin/blog/${id}`);
  return ok(undefined, scheduledAt && status === "PUBLISHED" ? "Scheduled" : status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Unpublished");
});
export const deletePostAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => { await deletePost(await actor(), id); refresh("/admin/blog"); return ok(undefined, "Post deleted"); });
export const restorePostAction = action(z.object({ revisionId: z.string().cuid(), postId: z.string().cuid() }), async ({ revisionId, postId }) => { await restorePostRevision(await actor(), revisionId); refresh(`/admin/blog/${postId}`); return ok(undefined, "Version restored"); });

export const saveAuthorAction = action(z.object({ id: z.string().cuid().nullable(), data: authorInput }), async ({ id, data }) => { await saveAuthor(await actor(), id, data); refresh("/admin/blog/authors"); return ok(undefined); });
export const deleteAuthorAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => { await deleteAuthor(await actor(), id); refresh("/admin/blog/authors"); return ok(undefined); });
export const saveBlogCategoryAction = action(z.object({ id: z.string().cuid().nullable(), data: blogCategoryInput }), async ({ id, data }) => { await saveBlogCategory(await actor(), id, data); refresh("/admin/blog/categories"); return ok(undefined); });
export const deleteBlogCategoryAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => { await deleteBlogCategory(await actor(), id); refresh("/admin/blog/categories"); return ok(undefined); });
