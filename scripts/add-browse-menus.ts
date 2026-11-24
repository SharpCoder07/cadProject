/**
 * Adds the classification pages (use cases, professions, features, platforms, deployment, licensing, budget,
 * customer types, operating systems) to the website menus:
 * - Header: a new "Browse" menu (between Industries and Resources) with one link per list.
 * The footer is left alone (an earlier version also added the links to "Footer: Resources"; take those out with
 * --remove-footer).
 * Lists switched off in Website settings › Classification lists are skipped, and the names follow that page.
 * Safe to re-run: links that are already there are left alone.
 *
 *   npm run db:add-browse-menus             # add them
 *   npm run db:add-browse-menus -- --remove # take them out again (header and footer)
 *   npm run db:add-browse-menus -- --remove-footer # only take the footer links out; the header "Browse" menu stays
 *
 * Rename, reorder or hide them afterwards in Admin › Website › Navigation menus.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { TAXONOMIES } from "../src/lib/taxonomies";

const db = new PrismaClient();
const GROUP = "Browse";
const remove = process.argv.includes("--remove");
const footerOnly = process.argv.includes("--remove-footer");

async function main() {
  const setting = await db.setting.findUnique({ where: { key: "taxonomies" } });
  const overrides = (setting?.value ?? {}) as Record<string, { enabled?: boolean; plural?: string } | undefined>;
  const links = TAXONOMIES.filter((t) => overrides[t.kind]?.enabled !== false).map((t) => ({ label: overrides[t.kind]?.plural?.trim() || t.plural, url: `/${t.path}` }));
  const urls = TAXONOMIES.map((t) => `/${t.path}`);

  // ── Header ── (untouched with --remove-footer)
  if (footerOnly) return removeFooter(urls);
  const header = await db.menu.findUnique({ where: { key: "header" }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!header) throw new Error("No header menu found (menu key “header”). Run the seed first: npx prisma db seed");
  const tops = header.items.filter((i) => i.parentId === null);
  const existing = tops.find((i) => i.label === GROUP && !i.url?.startsWith("http"));
  if (remove) {
    if (existing) {
      await db.menuItem.deleteMany({ where: { parentId: existing.id } });
      await db.menuItem.delete({ where: { id: existing.id } });
      console.log(`✓ header: removed “${GROUP}”`);
    }
  } else {
    let group = existing;
    if (!group) {
      // Just before Resources (or at the end when there is no Resources item).
      const resources = tops.find((i) => i.label.toLowerCase() === "resources");
      const at = resources ? resources.sortOrder : (tops.at(-1)?.sortOrder ?? -1) + 1;
      if (resources) await db.menuItem.updateMany({ where: { menuId: header.id, parentId: null, sortOrder: { gte: at } }, data: { sortOrder: { increment: 1 } } });
      group = await db.menuItem.create({ data: { menuId: header.id, label: GROUP, url: links[0]?.url ?? "/use-case", sortOrder: at } });
      console.log(`✓ header: added “${GROUP}”`);
    }
    const have = new Set(header.items.filter((i) => i.parentId === group!.id).map((i) => i.url));
    let n = header.items.filter((i) => i.parentId === group!.id).length;
    for (const l of links) {
      if (have.has(l.url)) continue;
      await db.menuItem.create({ data: { menuId: header.id, parentId: group.id, label: l.label, url: l.url, sortOrder: n++ } });
      console.log(`  + ${l.label} → ${l.url}`);
    }
  }

  if (remove) return removeFooter(urls);
  await clearCache();
}

/** Takes the classification links out of the "Footer: Resources" column (an earlier version of this script added them). */
async function removeFooter(urls: string[]) {
  const footer = await db.menu.findUnique({ where: { key: "footer.resources" } });
  if (footer) {
    const r = await db.menuItem.deleteMany({ where: { menuId: footer.id, parentId: null, url: { in: urls } } });
    console.log(r.count ? `✓ footer: removed ${r.count} links` : "• footer: no classification links to remove");
  }
  await clearCache();
}

async function clearCache() {
  // Menus are cached by the website: clear the cache so the change shows straight away.
  await rm(path.join(process.cwd(), ".next", "cache", "fetch-cache"), { recursive: true, force: true }).catch(() => undefined);
  console.log("Done. Reload the website (restart `npm run dev` if the menu hasn't changed).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
