"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { announcementInput, bannerInput, faqGroupInput, menuInput, reusableBlockInput, testimonialInput } from "@/lib/validation/cms";
import { deleteFaqGroup, deleteItem, reorderItems, restoreFaqRevision, restoreMenuRevision, saveAnnouncement, saveBanner, saveFaqGroup, saveMenu, saveTestimonial, toggleItem } from "@/server/services/navigation";
import { deleteReusableBlock, saveReusableBlock } from "@/server/services/cms";
import { actor, refresh } from "../_lib";

const idOrNull = z.string().cuid().nullable();
const ids = z.object({ ids: z.array(z.string().cuid()).max(200) });
const toggle = z.object({ id: z.string().cuid(), isActive: z.boolean() });
const byId = z.object({ id: z.string().cuid() });

export const saveBannerAction = action(z.object({ id: idOrNull, data: bannerInput }), async ({ id, data }) => { await saveBanner(await actor(), id, data); refresh("/admin/cms/banners"); return ok(undefined); });
export const deleteBannerAction = action(byId, async ({ id }) => { await deleteItem(await actor(), "banner", id); refresh("/admin/cms/banners"); return ok(undefined); });
export const reorderBannersAction = action(ids, async ({ ids: list }) => { await reorderItems(await actor(), "banner", list); return ok(undefined); });
export const toggleBannerAction = action(toggle, async ({ id, isActive }) => { await toggleItem(await actor(), "banner", id, isActive); refresh("/admin/cms/banners"); return ok(undefined, isActive ? "Banner shown" : "Banner hidden"); });

export const saveAnnouncementAction = action(z.object({ id: idOrNull, data: announcementInput }), async ({ id, data }) => { await saveAnnouncement(await actor(), id, data); refresh("/admin/cms/announcements"); return ok(undefined); });
export const deleteAnnouncementAction = action(byId, async ({ id }) => { await deleteItem(await actor(), "announcement", id); refresh("/admin/cms/announcements"); return ok(undefined); });
export const reorderAnnouncementsAction = action(ids, async ({ ids: list }) => { await reorderItems(await actor(), "announcement", list); return ok(undefined); });
export const toggleAnnouncementAction = action(toggle, async ({ id, isActive }) => { await toggleItem(await actor(), "announcement", id, isActive); refresh("/admin/cms/announcements"); return ok(undefined); });

export const saveTestimonialAction = action(z.object({ id: idOrNull, data: testimonialInput }), async ({ id, data }) => { await saveTestimonial(await actor(), id, data); refresh("/admin/cms/testimonials"); return ok(undefined); });
export const deleteTestimonialAction = action(byId, async ({ id }) => { await deleteItem(await actor(), "testimonial", id); refresh("/admin/cms/testimonials"); return ok(undefined); });
export const reorderTestimonialsAction = action(ids, async ({ ids: list }) => { await reorderItems(await actor(), "testimonial", list); return ok(undefined); });
export const toggleTestimonialAction = action(toggle, async ({ id, isActive }) => { await toggleItem(await actor(), "testimonial", id, isActive); refresh("/admin/cms/testimonials"); return ok(undefined); });

export const saveFaqGroupAction = action(z.object({ id: idOrNull, data: faqGroupInput }), async ({ id, data }) => { await saveFaqGroup(await actor(), id, data); refresh("/admin/cms/faqs"); return ok(undefined, "FAQs saved"); });
export const deleteFaqGroupAction = action(byId, async ({ id }) => { await deleteFaqGroup(await actor(), id); refresh("/admin/cms/faqs"); return ok(undefined, "FAQ group deleted"); });
export const restoreFaqAction = action(z.object({ revisionId: z.string().cuid() }), async ({ revisionId }) => { await restoreFaqRevision(await actor(), revisionId); refresh("/admin/cms/faqs"); return ok(undefined, "Version restored"); });
export const restoreMenuAction = action(z.object({ revisionId: z.string().cuid() }), async ({ revisionId }) => { await restoreMenuRevision(await actor(), revisionId); refresh("/admin/cms/menus"); return ok(undefined, "Version restored"); });

export const saveMenuAction = action(menuInput, async ({ key, name, items }) => { await saveMenu(await actor(), key, name, items); refresh("/admin/cms/menus"); return ok(undefined, "Menu saved"); });

export const saveBlockAction = action(z.object({ id: idOrNull, data: reusableBlockInput }), async ({ id, data }) => { const b = await saveReusableBlock(await actor(), id, data); refresh("/admin/cms/blocks"); return ok({ id: b.id }, "Block saved"); });
export const deleteBlockAction = action(byId, async ({ id }) => { await deleteReusableBlock(await actor(), id); refresh("/admin/cms/blocks"); return ok(undefined, "Block deleted"); });
