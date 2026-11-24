import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { db, type Tx } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, isUniqueViolation, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import type { AnnouncementInput, BannerInput, MenuItemInput, RedirectInput } from "@/lib/validation/cms";
import type { z } from "zod";
import type { faqGroupInput, testimonialInput } from "@/lib/validation/cms";
import type { Prisma } from "@prisma/client";
import { withBin } from "@/server/system/trash";
import { recordRevision } from "@/server/revisions";
import { guardDelete, guardRemovals } from "@/server/rbac/deletion";

export const MENUS_TAG = "cms:menus";
export const BANNERS_TAG = "cms:banners";
export const ANNOUNCEMENTS_TAG = "cms:announcements";
export const BLOCKS_TAG = "cms:blocks";
export const REDIRECTS_TAG = "redirects";

// ─── Menus ───────────────────────────────────────────────────────────────────

export interface ResolvedMenuItem {
  id: string;
  label: string;
  href: string;
  badge: string | null;
  newTab: boolean;
  children: ResolvedMenuItem[];
}

/** Public menu with links resolved to URLs; inactive items and items pointing to unpublished pages are dropped. */
export const getMenu = (key: string) =>
  unstable_cache(
    async (): Promise<ResolvedMenuItem[]> => {
      const menu = await db.menu.findUnique({
        where: { key },
        include: {
          items: {
            where: { isActive: true },
            orderBy: { sortOrder: "asc" },
            include: { page: { select: { slug: true, status: true } }, category: { select: { slug: true, isActive: true } } },
          },
        },
      });
      if (!menu) return [];
      const resolve = (it: (typeof menu.items)[number]): string | null => {
        if (it.page) return it.page.status === "PUBLISHED" ? (it.page.slug === "home" ? "/" : `/${it.page.slug}`) : null;
        if (it.category) return it.category.isActive ? `/categories/${it.category.slug}` : null;
        return it.url ?? null;
      };
      const build = (parentId: string | null): ResolvedMenuItem[] =>
        menu.items
          .filter((i) => i.parentId === parentId)
          .map((i) => ({ id: i.id, label: i.label, href: resolve(i) ?? "", badge: i.badge, newTab: i.openInNewTab, children: build(i.id) }))
          .filter((i) => i.href || i.children.length);
      return build(null);
    },
    ["menu", key],
    { tags: [MENUS_TAG], revalidate: 3600 },
  )();

export async function getMenuForEdit(user: Principal, key: string) {
  assertCan(user, "cms.navigation.view");
  const menu = await db.menu.findUnique({ where: { key }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!menu) throw notFound("Menu");
  const build = (parentId: string | null): MenuItemInput[] =>
    menu.items
      .filter((i) => i.parentId === parentId)
      .map((i) => ({ id: i.id, label: i.label, url: i.url, pageId: i.pageId, categoryId: i.categoryId, badge: i.badge, openInNewTab: i.openInNewTab, isActive: i.isActive, children: build(i.id) }));
  return { ...menu, tree: build(null) };
}

type MenuRow = { id: string; parentId: string | null; label: string; url: string | null; pageId: string | null; categoryId: string | null; badge: string | null; openInNewTab: boolean; isActive: boolean };
/** A menu's items as a tree in the editor's shape (no ids), for version history. */
const menuTree = (rows: MenuRow[], parentId: string | null = null): MenuItemInput[] =>
  rows.filter((i) => i.parentId === parentId).map((i) => ({ label: i.label, url: i.url, pageId: i.pageId, categoryId: i.categoryId, badge: i.badge, openInNewTab: i.openInNewTab, isActive: i.isActive, children: menuTree(rows, i.id) }) as MenuItemInput);

/**
 * Replaces a menu's whole item tree atomically (drag-and-drop editor saves the full tree). Every save is kept as a
 * version (and the menu as it was before the first versioned save), so removed items can be brought back.
 */
export async function saveMenu(user: Principal, key: string, name: string, items: MenuItemInput[], message?: string) {
  assertCan(user, "cms.navigation");
  const current = await db.menu.findUnique({ where: { key }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (current) {
    const tree = (parentId: string | null): unknown[] => current.items.filter((i) => i.parentId === parentId).map((i) => ({ label: i.label, children: tree(i.id) }));
    const strip = (list: MenuItemInput[]): unknown[] => list.map((i) => ({ label: i.label, children: strip(i.children ?? []) }));
    await guardRemovals(user, { kind: "menu.save", args: { key, name, items }, label: `Menu “${current.name}”`, before: tree(null), after: strip(items), root: "the menu" });
  }
  const depthOf = (list: MenuItemInput[], d = 1): number => Math.max(d, ...list.map((i) => (i.children.length ? depthOf(i.children, d + 1) : d)));
  if (items.length && depthOf(items) > 3) throw new AppError("Menus can be nested at most 3 levels deep.");

  await db.$transaction(async (tx) => {
    const menu = await tx.menu.upsert({ where: { key }, create: { key, name }, update: { name } });
    if (current?.items.length && !(await tx.revision.count({ where: { entityType: "menu", entityId: menu.id } }))) {
      await recordRevision(tx, "menu", menu.id, json({ name: current.name, items: menuTree(current.items) }), null, "Before version history started");
    }
    await tx.menuItem.deleteMany({ where: { menuId: menu.id } });
    const insert = async (tx2: Tx, list: MenuItemInput[], parentId: string | null) => {
      for (const [i, item] of list.entries()) {
        const created = await tx2.menuItem.create({
          data: {
            menuId: menu.id, parentId, label: item.label, url: item.url || null, pageId: item.pageId ?? null, categoryId: item.categoryId ?? null,
            badge: item.badge, openInNewTab: item.openInNewTab, isActive: item.isActive, sortOrder: i,
          },
        });
        if (item.children.length) await insert(tx2, item.children, created.id);
      }
    };
    await insert(tx, items, null);
    await recordRevision(tx, "menu", menu.id, json({ name, items: menuTree(await tx.menuItem.findMany({ where: { menuId: menu.id }, orderBy: { sortOrder: "asc" } })) }), user.id, message ?? "Saved menu");
    await audit({ actorId: user.id, action: "menu.update", entityType: "menu", entityId: menu.id, summary: `Saved menu ${key}` }, tx);
  });
  revalidateTag(MENUS_TAG);
}

// ─── Banners ─────────────────────────────────────────────────────────────────

const activeWindow = () => {
  const now = new Date();
  return { isActive: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] };
};

export const getBanners = (placement: string) =>
  unstable_cache(
    () =>
      db.banner.findMany({
        where: { placement, ...activeWindow() },
        orderBy: { sortOrder: "asc" },
        include: { image: { select: { url: true, alt: true, width: true, height: true } }, mobileImage: { select: { url: true } } },
      }),
    ["banners", placement],
    // Short revalidate so scheduled start/end times take effect without an edit.
    { tags: [BANNERS_TAG], revalidate: 300 },
  )();

export async function saveBanner(user: Principal, id: string | null, input: BannerInput) {
  assertCan(user, id ? "cms.navigation" : "cms.navigation.create");
  const data = { ...input, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, ctaUrl: input.ctaUrl ?? null };
  const banner = id ? await db.banner.update({ where: { id }, data }) : await db.banner.create({ data: { ...data, sortOrder: await db.banner.count({ where: { placement: input.placement } }) } });
  await audit({ actorId: user.id, action: id ? "banner.update" : "banner.create", entityType: "banner", entityId: banner.id, summary: `${banner.title} @ ${banner.placement}` });
  revalidateTag(BANNERS_TAG);
  return banner;
}

// ─── Announcements ───────────────────────────────────────────────────────────

export const getActiveAnnouncements = unstable_cache(
  () => db.announcement.findMany({ where: activeWindow(), orderBy: { sortOrder: "asc" }, take: 3 }),
  ["announcements"],
  { tags: [ANNOUNCEMENTS_TAG], revalidate: 300 },
);

export async function saveAnnouncement(user: Principal, id: string | null, input: AnnouncementInput) {
  assertCan(user, id ? "cms.navigation" : "cms.navigation.create");
  const data = { ...input, startsAt: input.startsAt ?? null, endsAt: input.endsAt ?? null, linkUrl: input.linkUrl ?? null };
  const a = id ? await db.announcement.update({ where: { id }, data }) : await db.announcement.create({ data });
  await audit({ actorId: user.id, action: id ? "announcement.update" : "announcement.create", entityType: "announcement", entityId: a.id, summary: a.message.slice(0, 120) });
  revalidateTag(ANNOUNCEMENTS_TAG);
  return a;
}

// ─── Generic ordered-list helpers (banners, announcements, testimonials) ────

type Orderable = "banner" | "announcement" | "testimonial";
const PERM: Record<Orderable, "cms.navigation" | "cms.blocks"> = { banner: "cms.navigation", announcement: "cms.navigation", testimonial: "cms.blocks" };
const TAG: Record<Orderable, string> = { banner: BANNERS_TAG, announcement: ANNOUNCEMENTS_TAG, testimonial: BLOCKS_TAG };

export async function reorderItems(user: Principal, kind: Orderable, orderedIds: string[]) {
  assertCan(user, PERM[kind]);
  await db.$transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) {
      if (kind === "banner") await tx.banner.update({ where: { id }, data: { sortOrder: i } });
      else if (kind === "announcement") await tx.announcement.update({ where: { id }, data: { sortOrder: i } });
      else await tx.testimonial.update({ where: { id }, data: { sortOrder: i } });
    }
  });
  revalidateTag(TAG[kind]);
}

export async function deleteItem(user: Principal, kind: Orderable, id: string) {
  await guardDelete(user, kind, { id });
  if (kind === "banner") await withBin(user, "Banner", [id], (tx) => tx.banner.delete({ where: { id } }));
  else if (kind === "announcement") await withBin(user, "Announcement", [id], (tx) => tx.announcement.delete({ where: { id } }));
  else await withBin(user, "Testimonial", [id], (tx) => tx.testimonial.delete({ where: { id } }));
  await audit({ actorId: user.id, action: `${kind}.delete`, entityType: kind, entityId: id });
  revalidateTag(TAG[kind]);
}

export async function toggleItem(user: Principal, kind: Orderable, id: string, isActive: boolean) {
  assertCan(user, PERM[kind]);
  if (kind === "banner") await db.banner.update({ where: { id }, data: { isActive } });
  else if (kind === "announcement") await db.announcement.update({ where: { id }, data: { isActive } });
  else await db.testimonial.update({ where: { id }, data: { isActive } });
  revalidateTag(TAG[kind]);
}

// ─── Testimonials & FAQs ─────────────────────────────────────────────────────

export const getTestimonials = (limit: number) =>
  unstable_cache(
    () => db.testimonial.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, take: limit, include: { avatar: { select: { url: true } } } }),
    ["testimonials", String(limit)],
    { tags: [BLOCKS_TAG], revalidate: 3600 },
  )();

export async function saveTestimonial(user: Principal, id: string | null, input: z.infer<typeof testimonialInput>) {
  assertCan(user, id ? "cms.blocks" : "cms.blocks.create");
  const data = { ...input, rating: input.rating ?? null };
  const t = id ? await db.testimonial.update({ where: { id }, data }) : await db.testimonial.create({ data: { ...data, sortOrder: await db.testimonial.count() } });
  revalidateTag(BLOCKS_TAG);
  return t;
}

export const getFaqGroup = (key: string) =>
  unstable_cache(
    () => db.faqGroup.findUnique({ where: { key }, include: { items: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } }),
    ["faq", key],
    { tags: [BLOCKS_TAG], revalidate: 3600 },
  )();

export async function saveFaqGroup(user: Principal, id: string | null, input: z.infer<typeof faqGroupInput>, message?: string) {
  assertCan(user, id ? "cms.blocks" : "cms.blocks.create");
  if (id) {
    const cur = await db.faqGroup.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    if (cur) await guardRemovals(user, { kind: "faq.save", args: { id, input }, label: `FAQ group “${cur.title}”`, before: { items: cur.items.map((i) => ({ question: i.question })) }, after: { items: input.items.map((i) => ({ question: i.question })) }, root: "the FAQ group" });
  }
  try {
    const group = await db.$transaction(async (tx) => {
      const before = id ? await tx.faqGroup.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } }) : null;
      const g = id
        ? await tx.faqGroup.update({ where: { id }, data: { key: input.key, title: input.title } })
        : await tx.faqGroup.create({ data: { key: input.key, title: input.title } });
      // Version history: the group as it was before the first versioned save, then every save.
      if (before?.items.length && !(await tx.revision.count({ where: { entityType: "faq", entityId: g.id } }))) {
        await recordRevision(tx, "faq", g.id, json(faqSnapshot(before)), null, "Before version history started");
      }
      await tx.faqItem.deleteMany({ where: { groupId: g.id } });
      if (input.items.length) {
        await tx.faqItem.createMany({ data: input.items.map((it, i) => ({ groupId: g.id, question: it.question, answer: it.answer, isActive: it.isActive, sortOrder: i })) });
      }
      await recordRevision(tx, "faq", g.id, json({ key: input.key, title: input.title, items: input.items.map((it) => ({ question: it.question, answer: it.answer, isActive: it.isActive })) }), user.id, message ?? (id ? "Saved FAQs" : "Created FAQ group"));
      await audit({ actorId: user.id, action: "faq.update", entityType: "faq_group", entityId: g.id, summary: g.title }, tx);
      return g;
    });
    revalidateTag(BLOCKS_TAG);
    return group;
  } catch (e) {
    if (isUniqueViolation(e, "key")) throw new AppError("Another FAQ group uses that key.", "CONFLICT", { key: ["Already in use"] });
    throw e;
  }
}

const faqSnapshot = (g: { key: string; title: string; items: { question: string; answer: string; isActive: boolean }[] }) =>
  ({ key: g.key, title: g.title, items: g.items.map((i) => ({ question: i.question, answer: i.answer, isActive: i.isActive })) });
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/** Puts a menu back as it was in a saved version (pages and categories deleted since are left out of the links). */
export async function restoreMenuRevision(user: Principal, revisionId: string) {
  assertCan(user, "cms.navigation");
  const rev = await db.revision.findUnique({ where: { id: revisionId } });
  if (!rev || rev.entityType !== "menu") throw notFound("Version");
  const menu = await db.menu.findUnique({ where: { id: rev.entityId }, select: { key: true } });
  if (!menu) throw notFound("Menu");
  const snap = rev.snapshot as unknown as { name: string; items: MenuItemInput[] };
  const [pages, cats] = await Promise.all([db.page.findMany({ select: { id: true } }), db.category.findMany({ select: { id: true } })]);
  const pageIds = new Set(pages.map((p) => p.id));
  const catIds = new Set(cats.map((c) => c.id));
  const clean = (list: MenuItemInput[]): MenuItemInput[] => list.map((i) => ({ ...i, pageId: i.pageId && pageIds.has(i.pageId) ? i.pageId : null, categoryId: i.categoryId && catIds.has(i.categoryId) ? i.categoryId : null, children: clean(i.children ?? []) }));
  await saveMenu(user, menu.key, snap.name, clean(snap.items), `Restored version ${rev.version}`);
}

/** Puts an FAQ group back as it was in a saved version. */
export async function restoreFaqRevision(user: Principal, revisionId: string) {
  const rev = await db.revision.findUnique({ where: { id: revisionId } });
  if (!rev || rev.entityType !== "faq") throw notFound("Version");
  const snap = rev.snapshot as unknown as z.infer<typeof faqGroupInput>;
  await saveFaqGroup(user, rev.entityId, snap, `Restored version ${rev.version}`);
}

export async function deleteFaqGroup(user: Principal, id: string) {
  await guardDelete(user, "faqGroup", { id });
  const g = await withBin(user, "FaqGroup", [id], (tx) => tx.faqGroup.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "faq.delete", entityType: "faq_group", entityId: id, summary: g.title });
  revalidateTag(BLOCKS_TAG);
}

// ─── Redirects ───────────────────────────────────────────────────────────────

/** Active redirects as a map, cached; consulted by the not-found handler and middleware API. */
export const getRedirectMap = unstable_cache(
  async () => {
    const rows = await db.redirect.findMany({ where: { isActive: true }, select: { fromPath: true, toPath: true, statusCode: true } });
    return Object.fromEntries(rows.map((r) => [r.fromPath.toLowerCase().replace(/\/$/, "") || "/", { to: r.toPath, status: r.statusCode }]));
  },
  ["redirects"],
  { tags: [REDIRECTS_TAG], revalidate: 3600 },
);

export async function saveRedirect(user: Principal, id: string | null, input: RedirectInput) {
  assertCan(user, "seo.manage");
  const fromPath = input.fromPath.replace(/\/$/, "") || "/";
  // Prevent simple loops A→B and B→A.
  const reverse = await db.redirect.findFirst({ where: { fromPath: input.toPath, toPath: fromPath, isActive: true } });
  if (reverse) throw new AppError("That would create a redirect loop with an existing rule.", "CONFLICT");
  try {
    const data = { ...input, fromPath };
    const r = id ? await db.redirect.update({ where: { id }, data }) : await db.redirect.create({ data });
    await audit({ actorId: user.id, action: id ? "redirect.update" : "redirect.create", entityType: "redirect", entityId: r.id, summary: `${r.fromPath} → ${r.toPath} (${r.statusCode})` });
    revalidateTag(REDIRECTS_TAG);
    return r;
  } catch (e) {
    if (isUniqueViolation(e, "fromPath")) throw new AppError("A redirect for that path already exists.", "CONFLICT", { fromPath: ["Already redirected"] });
    throw e;
  }
}

export async function deleteRedirect(user: Principal, id: string) {
  await guardDelete(user, "redirect", { id });
  const r = await withBin(user, "Redirect", [id], (tx) => tx.redirect.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "redirect.delete", entityType: "redirect", entityId: id, summary: `${r.fromPath} → ${r.toPath}` });
  revalidateTag(REDIRECTS_TAG);
}

/** When a slug changes, keep the old URL working. */
export async function addSlugRedirect(fromPath: string, toPath: string) {
  if (fromPath === toPath) return;
  await db.redirect.upsert({ where: { fromPath }, create: { fromPath, toPath, statusCode: 301, note: "Created automatically after a URL change" }, update: { toPath, isActive: true } });
  await db.redirect.updateMany({ where: { toPath: fromPath }, data: { toPath } }); // flatten chains
  revalidateTag(REDIRECTS_TAG);
}
