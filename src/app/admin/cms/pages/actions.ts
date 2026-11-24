"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { pageInput, publishInput, sectionsInput } from "@/lib/validation/cms";
import { createPage, deletePage, restorePageRevision, saveSections, setPageStatus, updatePageMeta } from "@/server/services/cms";
import { actor, refresh } from "../../_lib";

export const createPageAction = action(pageInput, async (input) => {
  const p = await createPage(await actor(), input);
  refresh("/admin/cms/pages");
  return ok({ id: p.id }, "Page created as a draft");
});

export const updatePageAction = action(z.object({ id: z.string().cuid(), data: pageInput }), async ({ id, data }) => {
  await updatePageMeta(await actor(), id, data);
  refresh("/admin/cms/pages", `/admin/cms/pages/${id}`);
  return ok(undefined, "Page settings saved");
});

export const saveSectionsAction = action(sectionsInput, async ({ pageId, sections, revisionMessage }) => {
  await saveSections(await actor(), pageId, sections, revisionMessage);
  refresh(`/admin/cms/pages/${pageId}`);
  return ok(undefined, "Sections saved");
});

export const setPageStatusAction = action(publishInput, async ({ id, status, scheduledAt }) => {
  await setPageStatus(await actor(), id, status, scheduledAt);
  refresh("/admin/cms/pages", `/admin/cms/pages/${id}`);
  return ok(undefined, scheduledAt && status === "PUBLISHED" ? "Scheduled" : { DRAFT: "Unpublished", PUBLISHED: "Published", ARCHIVED: "Archived" }[status]);
});

export const deletePageAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deletePage(await actor(), id);
  refresh("/admin/cms/pages");
  return ok(undefined, "Page deleted");
});

export const restorePageAction = action(z.object({ revisionId: z.string().cuid(), pageId: z.string().cuid() }), async ({ revisionId, pageId }) => {
  await restorePageRevision(await actor(), revisionId);
  refresh(`/admin/cms/pages/${pageId}`);
  return ok(undefined, "Version restored");
});
