/**
 * Which Delete permission an admin screen's deletions need, from its URL. Pure (client-safe); used only to word
 * the delete confirmation. The real check is on the server (server/rbac/deletion.ts).
 */
const BY_PATH: [prefix: string, permission: string][] = [
  ["/admin/software", "software.delete"],
  ["/admin/categories", "categories.delete"],
  ["/admin/industries", "taxonomy.delete"],
  ["/admin/attributes", "taxonomy.delete"],
  ["/admin/taxonomies", "taxonomy.delete"],
  ["/admin/vendors", "vendors.delete"],
  ["/admin/brands", "vendors.delete"],
  ["/admin/resellers", "vendors.delete"],
  ["/admin/reviews", "reviews.delete"],
  ["/admin/questions", "reviews.delete"],
  ["/admin/comparisons", "comparisons.delete"],
  ["/admin/offers", "offers.delete"],
  ["/admin/cms/pages", "cms.pages.delete"],
  ["/admin/cms/menus", "cms.navigation.delete"],
  ["/admin/cms/banners", "cms.navigation.delete"],
  ["/admin/cms/announcements", "cms.navigation.delete"],
  ["/admin/cms/blocks", "cms.blocks.delete"],
  ["/admin/cms/testimonials", "cms.blocks.delete"],
  ["/admin/cms/faqs", "cms.blocks.delete"],
  ["/admin/blog", "blog.delete"],
  ["/admin/media", "media.delete"],
  ["/admin/seo", "seo.delete"],
  ["/admin/geo", "geo.delete"],
  ["/admin/billing", "billing.delete"],
  ["/admin/roles", "roles.manage"],
  ["/admin/system", "system.manage"],
];

export function deletePermissionFor(pathname: string): string | null {
  const hit = BY_PATH.find(([p]) => pathname === p || pathname.startsWith(`${p}/`));
  return hit?.[1] ?? null;
}

/** Shown (and returned by the server) when someone without the Delete permission tries to delete. */
export const NO_DELETE_MESSAGE = "You don't have permission to delete this item.";
/** Delete confirmation for staff who may delete. */
export const RECYCLE_BIN_CONFIRM = "This item will be moved to the Recycle Bin. To restore it, please contact the Super Admin.";
