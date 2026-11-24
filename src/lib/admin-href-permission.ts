import { ADMIN_NAV, type AdminNavLink } from "@/components/admin/nav";

/**
 * The permission needed to use an admin screen, from its link (longest matching sidebar link).
 * Edit mode uses it to hide buttons to screens someone can't open; the screens check it themselves.
 */
const LINKS: { path: string; permission: string }[] = ADMIN_NAV.flatMap((g) => g.items.flatMap((i) => [...(i.href && i.permission ? [{ href: i.href, permission: i.permission }] : []), ...((i.children ?? []) as AdminNavLink[])]))
  .map((l) => ({ path: l.href.split("?")[0]!, permission: l.permission as string }))
  .filter((l) => l.path !== "/admin")
  .sort((a, b) => b.path.length - a.path.length);

export function adminHrefPermission(href: string): string | null {
  const path = href.split(/[?#]/)[0]!;
  // Opening one product means editing it (the sidebar link only needs "view").
  if (/^\/admin\/software\/[^/]+/.test(path)) return "software.edit";
  if (path === "/admin/settings") return "settings.manage";
  return LINKS.find((l) => path === l.path || path.startsWith(`${l.path}/`))?.permission ?? null;
}
