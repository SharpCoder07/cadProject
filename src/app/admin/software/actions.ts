"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { bulkFlag, softwareInput, statusTransition } from "@/lib/validation/software";
import {
  createSoftware, deleteSoftware, duplicateSoftware, restoreSoftwareRevision, setSoftwareFlag, setSoftwareStatus, updateSoftware,
} from "@/server/services/software";
import { proposeSoftware } from "@/server/services/approvals";
import { actor, refresh } from "../_lib";

// Vendor-portal users share the editor, but their saves become approval requests.
export const createSoftwareAction = action(softwareInput, async (input) => {
  const user = await actor();
  if (user.vendorId) {
    const r = await proposeSoftware(user, null, input, input.revisionMessage);
    refresh("/vendor/listings", "/vendor/requests", "/admin/approvals");
    return ok({ id: r.id }, r.message);
  }
  const sw = await createSoftware(user, input);
  refresh("/admin/software");
  return ok({ id: sw.id }, "Listing created as a draft");
});

/** Staff with publish permission: create the listing and put it live in one step. */
export const createAndPublishSoftwareAction = action(softwareInput, async (input) => {
  const user = await actor();
  if (user.vendorId) {
    // Vendor-portal saves always go through approval.
    const r = await proposeSoftware(user, null, input, input.revisionMessage);
    refresh("/vendor/listings", "/vendor/requests", "/admin/approvals");
    return ok({ id: r.id }, r.message);
  }
  const sw = await createSoftware(user, input);
  refresh("/admin/software");
  try {
    await setSoftwareStatus(user, [sw.id], "PUBLISHED");
  } catch (e) {
    // The listing exists now; open it as a draft rather than failing (a retry would duplicate it).
    const why = e instanceof Error ? e.message : "it couldn't be published";
    return ok({ id: sw.id }, `Saved as a draft — not published: ${why}`);
  }
  refresh(`/software/${sw.slug}`);
  return ok({ id: sw.id }, "Listing created and published");
});

/** Staff with publish permission: save unsaved edits to a draft and publish it. */
export const saveAndPublishSoftwareAction = action(z.object({ id: z.string().cuid(), data: softwareInput }), async ({ id, data }) => {
  const user = await actor();
  if (user.vendorId) {
    const r = await proposeSoftware(user, id, data, data.revisionMessage);
    refresh("/vendor/listings", `/vendor/listings/${id}`, "/vendor/requests", "/admin/approvals");
    return ok({ id }, r.message);
  }
  await updateSoftware(user, id, data);
  await setSoftwareStatus(user, [id], "PUBLISHED");
  refresh("/admin/software", `/admin/software/${id}`, "/vendor/listings");
  return ok({ id }, "Saved and published");
});

export const updateSoftwareAction = action(z.object({ id: z.string().cuid(), data: softwareInput }), async ({ id, data }) => {
  const user = await actor();
  if (user.vendorId) {
    const r = await proposeSoftware(user, id, data, data.revisionMessage);
    refresh("/vendor/listings", `/vendor/listings/${id}`, "/vendor/requests", "/admin/approvals");
    return ok({ id }, r.message);
  }
  await updateSoftware(user, id, data);
  refresh("/admin/software", `/admin/software/${id}`, "/vendor/listings");
  return ok({ id }, "Changes saved");
});

export const setStatusAction = action(statusTransition, async ({ ids, status, scheduledAt }) => {
  const r = await setSoftwareStatus(await actor(), ids, status, scheduledAt);
  refresh("/admin/software", "/vendor/listings", ...ids.map((id) => `/admin/software/${id}`));
  const label = r.scheduled ? "Scheduled for publishing" : { DRAFT: "Moved to drafts", IN_REVIEW: "Sent for review", PUBLISHED: "Published", ARCHIVED: "Archived" }[status];
  return ok(r, `${label}${r.count > 1 ? ` (${r.count} listings)` : ""}`);
});

export const setFlagAction = action(bulkFlag, async ({ ids, flag, value }) => {
  await setSoftwareFlag(await actor(), ids, flag, value);
  refresh("/admin/software");
  return ok(undefined, "Updated");
});

export const deleteSoftwareAction = action(z.object({ ids: z.array(z.string().cuid()).min(1).max(200) }), async ({ ids }) => {
  const n = await deleteSoftware(await actor(), ids);
  refresh("/admin/software");
  return ok(n, `Deleted ${n} listing${n === 1 ? "" : "s"}`);
});

export const duplicateSoftwareAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  const sw = await duplicateSoftware(await actor(), id);
  refresh("/admin/software");
  return ok({ id: sw.id }, "Duplicated as a new draft");
});

export const restoreRevisionAction = action(z.object({ revisionId: z.string().cuid(), softwareId: z.string().cuid() }), async ({ revisionId, softwareId }) => {
  await restoreSoftwareRevision(await actor(), revisionId);
  refresh(`/admin/software/${softwareId}`);
  return ok(undefined, "Version restored");
});
