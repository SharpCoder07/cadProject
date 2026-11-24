"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { brandInput, vendorInput, vendorVerification } from "@/lib/validation/taxonomy";
import { deleteBrand, deleteVendor, saveBrand, saveVendor, setVendorVerification } from "@/server/services/taxonomy";
import { proposeVendorProfile } from "@/server/services/approvals";
import { db } from "@/server/db";
import { actor, refresh } from "../_lib";

export const saveVendorAction = action(z.object({ id: z.string().cuid().nullable(), data: vendorInput }), async ({ id, data }) => {
  const user = await actor();
  if (user.vendorId) {
    // Vendor-portal profile edits wait for Super Admin approval.
    const r = await proposeVendorProfile(user, data);
    refresh("/vendor/profile", "/vendor/requests", "/admin/approvals");
    return ok({ id: user.vendorId }, r.message);
  }
  const v = await saveVendor(user, id, data);
  refresh("/admin/vendors", `/admin/vendors/${v.id}`, "/vendor/profile");
  return ok({ id: v.id }, id ? "Vendor saved" : "Vendor created");
});
export const deleteVendorAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteVendor(await actor(), id);
  refresh("/admin/vendors");
  return ok(undefined, "Vendor deleted");
});
export const verifyVendorAction = action(vendorVerification, async ({ id, verification, canPublish }) => {
  await setVendorVerification(await actor(), id, verification, canPublish);
  refresh(`/admin/vendors/${id}`, "/admin/vendors");
  return ok(undefined, "Verification updated");
});
export const saveBrandAction = action(z.object({ id: z.string().cuid().nullable(), data: brandInput }), async ({ id, data }) => {
  await saveBrand(await actor(), id, data);
  refresh("/admin/brands", "/brands", `/brands/${data.slug}`, "/", ...(data.vendorId ? [`/admin/vendors/${data.vendorId}`] : []));
  return ok(undefined, "Brand saved");
});
export const deleteBrandAction = action(z.object({ id: z.string().cuid() }), async ({ id }) => {
  await deleteBrand(await actor(), id);
  refresh("/admin/vendors", "/admin/brands", "/brands", "/");
  return ok(undefined, "Brand deleted");
});

/** Bulk select: change verification but keep each vendor's own "can publish" setting. */
export const setVerificationAction = action(z.object({ id: z.string().cuid(), verification: vendorVerification.shape.verification }), async ({ id, verification }) => {
  const v = await db.vendor.findUnique({ where: { id }, select: { canPublish: true } });
  await setVendorVerification(await actor(), id, verification, v?.canPublish ?? false);
  refresh("/admin/vendors");
  return ok(undefined, "Verification updated");
});
