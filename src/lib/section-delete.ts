/**
 * Deleting sections of the homepage / CMS pages (or anything inside one): only the Super Admin, or a role the
 * Super Admin gave "Pages › Delete". Anyone else is refused ("You don't have permission to delete this item."). Pure, for
 * screens only; enforced on the server in services/cms.ts › saveSections (server/rbac/deletion.ts).
 */
export const SECTION_DELETE_PERMISSION = "cms.pages.delete";

export const canDeleteSections = (user: { roleKey: string; permissions: ReadonlySet<string> } | null | undefined) =>
  Boolean(user && (user.roleKey === "SUPER_ADMIN" || user.permissions.has(SECTION_DELETE_PERMISSION)));

export const SECTION_DELETE_REFUSED = "You don't have permission to delete this item. Hide it instead.";
