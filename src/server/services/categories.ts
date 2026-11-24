import "server-only";
import type { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { db, type Tx } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, isUniqueViolation, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { sanitizeRichText } from "@/server/sanitize";
import { categoryLayout, type CategoryInput } from "@/lib/validation/taxonomy";
import { upsertSeo } from "./seo";
import { addSlugRedirect } from "./navigation";
import { moveToBin } from "@/server/system/trash";
import { guardDelete } from "@/server/rbac/deletion";

export const CATEGORIES_TAG = "categories";

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parentId: string | null;
  depth: number;
  sortOrder: number;
  isActive: boolean;
  showInNav: boolean;
  softwareCount: number;
  children: CategoryNode[];
}

/** Builds a tree from flat rows (rows are pre-sorted by sortOrder, name). */
export function buildTree<T extends { id: string; parentId: string | null }>(rows: T[]): (T & { children: (T & { children: unknown[] })[] })[] {
  type Node = T & { children: Node[] };
  const byId = new Map<string, Node>();
  for (const r of rows) byId.set(r.id, { ...r, children: [] });
  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots as (T & { children: (T & { children: unknown[] })[] })[];
}

async function loadTree(includeInactive: boolean): Promise<CategoryNode[]> {
  const rows = await db.category.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, slug: true, icon: true, parentId: true, depth: true, sortOrder: true, isActive: true, showInNav: true,
      _count: { select: { software: { where: { software: { status: "PUBLISHED" } } } } },
    },
  });
  return buildTree(rows.map(({ _count, ...r }) => ({ ...r, softwareCount: _count.software }))) as CategoryNode[];
}

/** Public, cached category tree (active categories only). */
export const getCategoryTree = unstable_cache(() => loadTree(false), ["categories:tree"], { tags: [CATEGORIES_TAG], revalidate: 3600 });

export async function getAdminCategoryTree(user: Principal) {
  assertCan(user, "categories.view");
  return loadTree(true);
}

export async function getCategoryForEdit(user: Principal, id: string) {
  assertCan(user, "categories.view");
  const c = await db.category.findUnique({
    where: { id },
    include: {
      seo: true, image: true, banner: true,
      featured: { orderBy: { sortOrder: "asc" }, include: { software: { select: { id: true, name: true } } } },
      attributes: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!c) throw notFound("Category");
  return { ...c, layout: categoryLayout.parse(c.layout ?? {}) };
}

/** Computes depth/path for a node under `parentId`, rejecting cycles. */
async function placement(tx: Tx, id: string | null, parentId: string | null) {
  if (!parentId) return { depth: 0, path: "/" };
  const parent = await tx.category.findUnique({ where: { id: parentId }, select: { id: true, depth: true, path: true } });
  if (!parent) throw new AppError("Parent category not found.");
  if (id && (parent.id === id || parent.path.includes(`/${id}/`))) {
    throw new AppError("A category can't be moved inside itself or one of its subcategories.");
  }
  if (parent.depth >= 4) throw new AppError("Categories can be nested at most 5 levels deep.");
  return { depth: parent.depth + 1, path: `${parent.path}${parent.id}/` };
}

/** Rewrites path/depth for every descendant after a move. */
async function rebuildDescendants(tx: Tx, id: string) {
  const node = await tx.category.findUniqueOrThrow({ where: { id }, select: { id: true, depth: true, path: true } });
  const queue = [node];
  while (queue.length) {
    const current = queue.shift()!;
    const children = await tx.category.findMany({ where: { parentId: current.id }, select: { id: true } });
    for (const child of children) {
      const updated = await tx.category.update({
        where: { id: child.id },
        data: { depth: current.depth + 1, path: `${current.path}${current.id}/` },
        select: { id: true, depth: true, path: true },
      });
      queue.push(updated);
    }
  }
}

async function writeRelations(tx: Tx, categoryId: string, input: CategoryInput) {
  await tx.categoryFeatured.deleteMany({ where: { categoryId } });
  if (input.featuredSoftwareIds.length) {
    await tx.categoryFeatured.createMany({ data: input.featuredSoftwareIds.map((softwareId, i) => ({ categoryId, softwareId, sortOrder: i })), skipDuplicates: true });
  }
  await tx.categoryAttribute.deleteMany({ where: { categoryId } });
  if (input.attributes.length) {
    await tx.categoryAttribute.createMany({ data: input.attributes.map((a, i) => ({ categoryId, attributeId: a.attributeId, isFilter: a.isFilter, sortOrder: i })), skipDuplicates: true });
  }
}

const baseData = (input: CategoryInput) => ({
  name: input.name,
  slug: input.slug,
  shortName: input.shortName,
  description: input.description,
  content: sanitizeRichText(input.content),
  icon: input.icon,
  isActive: input.isActive,
  showInNav: input.showInNav,
  imageId: input.imageId,
  bannerId: input.bannerId,
  layout: input.layout as Prisma.InputJsonValue,
});

function revalidate() {
  revalidateTag(CATEGORIES_TAG);
  revalidateTag("catalog");
  revalidateTag("cms:menus");
}

function slugConflict(e: unknown): never {
  if (isUniqueViolation(e, "slug")) throw new AppError("That URL slug is already used by another category.", "CONFLICT", { slug: ["Already in use"] });
  throw e;
}

export async function createCategory(user: Principal, input: CategoryInput) {
  assertCan(user, "categories.create");
  try {
    const created = await db.$transaction(async (tx) => {
      const place = await placement(tx, null, input.parentId ?? null);
      const last = await tx.category.findFirst({ where: { parentId: input.parentId ?? null }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      const seoId = await upsertSeo(tx, null, input.seo);
      const c = await tx.category.create({ data: { ...baseData(input), parentId: input.parentId ?? null, ...place, sortOrder: (last?.sortOrder ?? -1) + 1, seoId } });
      await writeRelations(tx, c.id, input);
      await audit({ actorId: user.id, action: "category.create", entityType: "category", entityId: c.id, summary: `Created category ${c.name}` }, tx);
      return c;
    });
    revalidate();
    return created;
  } catch (e) {
    slugConflict(e);
  }
}

export async function updateCategory(user: Principal, id: string, input: CategoryInput) {
  assertCan(user, "categories.manage");
  const existing = await db.category.findUnique({ where: { id }, select: { parentId: true, seoId: true, slug: true } });
  if (!existing) throw notFound("Category");
  try {
    const updated = await db.$transaction(async (tx) => {
      const parentChanged = (input.parentId ?? null) !== existing.parentId;
      const place = parentChanged ? await placement(tx, id, input.parentId ?? null) : {};
      const seoId = await upsertSeo(tx, existing.seoId, input.seo);
      const c = await tx.category.update({ where: { id }, data: { ...baseData(input), parentId: input.parentId ?? null, ...place, seoId } });
      if (parentChanged) await rebuildDescendants(tx, id);
      await writeRelations(tx, id, input);
      await audit({ actorId: user.id, action: "category.update", entityType: "category", entityId: id, summary: `Updated category ${c.name}${parentChanged ? " (moved)" : ""}` }, tx);
      return c;
    });
    if (existing.slug !== updated.slug) await addSlugRedirect(`/categories/${existing.slug}`, `/categories/${updated.slug}`);
    revalidate();
    return updated;
  } catch (e) {
    slugConflict(e);
  }
}

/** Drag-and-drop: re-parent and reorder siblings atomically. */
export async function moveCategory(user: Principal, id: string, parentId: string | null, orderedSiblingIds: string[]) {
  assertCan(user, "categories.manage");
  if (!orderedSiblingIds.includes(id)) throw new AppError("Invalid ordering.");
  await db.$transaction(async (tx) => {
    const place = await placement(tx, id, parentId);
    await tx.category.update({ where: { id }, data: { parentId, ...place } });
    await rebuildDescendants(tx, id);
    const siblings = await tx.category.findMany({ where: { id: { in: orderedSiblingIds }, parentId }, select: { id: true } });
    const valid = new Set(siblings.map((s) => s.id));
    let order = 0;
    for (const sid of orderedSiblingIds) if (valid.has(sid)) await tx.category.update({ where: { id: sid }, data: { sortOrder: order++ } });
    await audit({ actorId: user.id, action: "category.move", entityType: "category", entityId: id, summary: "Reordered category tree", diff: { parentId, orderedSiblingIds } }, tx);
  });
  revalidate();
}

export async function deleteCategory(user: Principal, id: string) {
  await guardDelete(user, "category", { id });
  const c = await db.category.findUnique({ where: { id }, include: { _count: { select: { children: true, software: true } } } });
  if (!c) throw notFound("Category");
  if (c._count.children > 0) throw new AppError("Move or delete the subcategories first.", "CONFLICT");
  await db.$transaction(async (tx) => {
    await moveToBin(tx, user, "Category", [id]);
    await tx.software.updateMany({ where: { primaryCategoryId: id }, data: { primaryCategoryId: null } });
    await tx.category.delete({ where: { id } });
    if (c.seoId) await tx.seoMeta.delete({ where: { id: c.seoId } }).catch(() => undefined);
    await audit({ actorId: user.id, action: "category.delete", entityType: "category", entityId: id, summary: `Deleted category ${c.name} (${c._count.software} listing links removed)` }, tx);
  }, { timeout: 60_000, maxWait: 10_000 });
  revalidate();
}

/** All descendant ids including self (for "this category and its subcategories" queries). */
export async function categorySubtreeIds(id: string): Promise<string[]> {
  const rows = await db.category.findMany({ where: { OR: [{ id }, { path: { contains: `/${id}/` } }], isActive: true }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Breadcrumb trail from root to the category. */
export async function categoryTrail(category: { id: string; path: string; name: string; slug: string }) {
  const ancestorIds = category.path.split("/").filter(Boolean);
  const ancestors = ancestorIds.length
    ? await db.category.findMany({ where: { id: { in: ancestorIds } }, select: { id: true, name: true, slug: true } })
    : [];
  const byId = new Map(ancestors.map((a) => [a.id, a]));
  return [...ancestorIds.map((aid) => byId.get(aid)).filter((a): a is NonNullable<typeof a> => Boolean(a)), { id: category.id, name: category.name, slug: category.slug }];
}
