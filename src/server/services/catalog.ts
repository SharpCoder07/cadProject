import "server-only";
import type { CompareProduct } from "@/lib/compare";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { CATALOG_TAG, softwareTag } from "./software";
import { categorySubtreeIds } from "./categories";
import { groupOptionIds, searchProvider, type SearchParams, type SortKey } from "./search";

/** Fields needed to render a product row/card anywhere on the public site. */
export const softwareCardSelect = {
  id: true,
  name: true,
  slug: true,
  tagline: true,
  shortDescription: true,
  pricingModel: true,
  startingPrice: true,
  currency: true,
  priceUnit: true,
  hasFreeTrial: true,
  hasFreeVersion: true,
  deployment: true,
  isSponsored: true,
  isTrending: true,
  ratingAvg: true,
  ratingCount: true,
  logo: { select: { url: true, alt: true } },
  vendor: { select: { name: true, slug: true, verification: true } },
  primaryCategory: { select: { name: true, slug: true } },
} satisfies Prisma.SoftwareSelect;

export type SoftwareCard = Prisma.SoftwareGetPayload<{ select: typeof softwareCardSelect }>;

/** Loads cards for ids and preserves the given order. */
export async function cardsByIds(ids: string[]): Promise<SoftwareCard[]> {
  if (!ids.length) return [];
  const rows = await db.software.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, select: softwareCardSelect });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is SoftwareCard => Boolean(r));
}

export type ListSource = "featured" | "popular" | "trending" | "recommended" | "sponsored" | "newest";

export const listSoftware = unstable_cache(
  async (source: ListSource, limit: number, categoryId?: string | null): Promise<SoftwareCard[]> => {
    const categoryIds = categoryId ? await categorySubtreeIds(categoryId) : null;
    const where: Prisma.SoftwareWhereInput = {
      status: "PUBLISHED",
      ...(categoryIds ? { categories: { some: { categoryId: { in: categoryIds } } } } : {}),
      ...(source === "featured" ? { isFeatured: true } : {}),
      ...(source === "trending" ? { isTrending: true } : {}),
      ...(source === "recommended" ? { isRecommended: true } : {}),
      ...(source === "sponsored" ? { isSponsored: true } : {}),
      ...(source === "popular" && !categoryIds ? { isPopular: true } : {}),
    };
    const orderBy: Prisma.SoftwareOrderByWithRelationInput[] =
      source === "newest" ? [{ publishedAt: "desc" }] : source === "sponsored" ? [{ sponsoredRank: "asc" }, { popularityScore: "desc" }] : [{ popularityScore: "desc" }];
    const rows = await db.software.findMany({ where, orderBy, take: limit, select: softwareCardSelect });
    // "popular" with no flagged items falls back to popularity ranking.
    if (source === "popular" && !categoryIds && rows.length === 0) {
      return db.software.findMany({ where: { status: "PUBLISHED" }, orderBy: { popularityScore: "desc" }, take: limit, select: softwareCardSelect });
    }
    return rows;
  },
  ["catalog:list"],
  { tags: [CATALOG_TAG], revalidate: 900 },
);

// ─── Listing / search pages ──────────────────────────────────────────────────

export interface ListingScope {
  categoryId?: string;
  industryId?: string;
  vendorId?: string;
  brandId?: string;
}

export async function runListing(params: SearchParams, scope: ListingScope = {}, defaultSort?: SortKey) {
  const settings = await getSettings();
  const perPage = settings.listing.perPage;
  const sort: SortKey = params.sort ?? (params.q ? "relevance" : defaultSort ?? settings.listing.defaultSort);

  let categoryIds: string[] | undefined;
  const categorySlug = params.category;
  if (scope.categoryId) categoryIds = await categorySubtreeIds(scope.categoryId);
  else if (categorySlug) {
    const c = await db.category.findUnique({ where: { slug: categorySlug }, select: { id: true } });
    categoryIds = c ? await categorySubtreeIds(c.id) : ["__none__"];
  }
  let industryId = scope.industryId;
  if (!industryId && params.industry) {
    industryId = (await db.industry.findUnique({ where: { slug: params.industry }, select: { id: true } }))?.id ?? "__none__";
  }
  let vendorId = scope.vendorId;
  if (!vendorId && params.vendor) {
    vendorId = (await db.vendor.findUnique({ where: { slug: params.vendor }, select: { id: true } }))?.id ?? "__none__";
  }

  const result = await searchProvider.search({
    q: params.q,
    categoryIds,
    industryId,
    vendorId,
    brandId: scope.brandId,
    pricing: params.pricing,
    deployment: params.deployment,
    freeTrial: params.trial === "1",
    freeVersion: params.free === "1",
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    minRating: params.rating,
    options: await groupOptionIds(params.opt),
    termIds: params.term,
    sort,
    page: params.page,
    perPage,
    sponsoredFirst: settings.listing.sponsoredFirst && sort !== "price_asc" && sort !== "price_desc" && sort !== "name",
    tuning: settings.rules.search,
  });

  return {
    items: await cardsByIds(result.ids),
    total: result.total,
    page: params.page,
    perPage,
    pages: Math.max(1, Math.ceil(result.total / perPage)),
    sort,
    facets: result.facets,
  };
}

/** Filterable attributes for a category page (from category config) or all filterable attributes. */
export async function filterAttributes(categoryId?: string) {
  if (categoryId) {
    const rows = await db.categoryAttribute.findMany({
      where: { categoryId, isFilter: true, attribute: { isFilterable: true, type: { in: ["SELECT", "MULTISELECT", "BOOLEAN"] } } },
      orderBy: { sortOrder: "asc" },
      include: { attribute: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
    });
    return rows.map((r) => r.attribute).filter((a) => a.type !== "BOOLEAN");
  }
  return db.attribute.findMany({
    where: { isFilterable: true, type: { in: ["SELECT", "MULTISELECT"] } },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    include: { options: { orderBy: { sortOrder: "asc" } } },
    take: 6,
  });
}

// ─── Product detail ──────────────────────────────────────────────────────────

const detailInclude = {
  seo: { include: { ogImage: true } },
  logo: true,
  vendor: { include: { logo: true } },
  brand: true,
  primaryCategory: { select: { id: true, name: true, slug: true, path: true } },
  categories: { include: { category: { select: { id: true, name: true, slug: true, isActive: true } } } },
  industries: { include: { industry: { select: { name: true, slug: true } } } },
  tags: { include: { tag: true } },
  features: { orderBy: { sortOrder: "asc" } },
  plans: { orderBy: { sortOrder: "asc" } },
  faqs: { orderBy: { sortOrder: "asc" } },
  media: { orderBy: { sortOrder: "asc" }, include: { media: true } },
  attributes: { include: { attribute: true, option: true } },
  releases: { orderBy: { releasedAt: "desc" }, take: 5 },
} satisfies Prisma.SoftwareInclude;

export type SoftwareDetail = Prisma.SoftwareGetPayload<{ include: typeof detailInclude }>;

export const getPublishedSoftware = cache((slug: string) =>
  unstable_cache(
    () => db.software.findFirst({ where: { slug, status: "PUBLISHED" }, include: detailInclude }),
    ["software:detail", slug],
    { tags: [CATALOG_TAG, softwareTag(slug)], revalidate: 3600 },
  )(),
);

/** Draft preview for signed-in staff. Not cached. */
export const getSoftwareForPreview = (slug: string) => db.software.findUnique({ where: { slug }, include: detailInclude });

/** Groups attribute values into display rows: { group, label, value }. */
export function specRows(sw: SoftwareDetail) {
  const byAttr = new Map<string, { group: string; label: string; sortOrder: number; values: string[]; unit: string | null }>();
  for (const v of sw.attributes) {
    if (!v.attribute.showOnDetail) continue;
    const entry = byAttr.get(v.attributeId) ?? { group: v.attribute.group, label: v.attribute.label, sortOrder: v.attribute.sortOrder, values: [], unit: v.attribute.unit };
    if (v.option) entry.values.push(v.option.label);
    else if (v.valueBool !== null) entry.values.push(v.valueBool ? "Yes" : "No");
    else if (v.valueNumber !== null) entry.values.push(`${Number(v.valueNumber).toLocaleString("en-IN")}${entry.unit ? ` ${entry.unit}` : ""}`);
    else if (v.valueText) entry.values.push(v.valueText);
    byAttr.set(v.attributeId, entry);
  }
  const groups = new Map<string, { label: string; value: string }[]>();
  for (const e of [...byAttr.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))) {
    const rows = groups.get(e.group) ?? [];
    rows.push({ label: e.label, value: e.values.join(", ") });
    groups.set(e.group, rows);
  }
  return [...groups.entries()].map(([group, rows]) => ({ group, rows }));
}

/** Hand-picked related/alternatives first, then same-primary-category by popularity. */
export async function relatedSoftware(sw: { id: string; primaryCategoryId: string | null }, kind: "RELATED" | "ALTERNATIVE", limit = 6) {
  const picked = await db.relatedSoftware.findMany({ where: { softwareId: sw.id, kind }, orderBy: { sortOrder: "asc" }, select: { relatedId: true }, take: limit });
  const ids = picked.map((p) => p.relatedId);
  if (ids.length < limit && sw.primaryCategoryId) {
    const fill = await db.software.findMany({
      where: { status: "PUBLISHED", id: { notIn: [sw.id, ...ids] }, categories: { some: { categoryId: sw.primaryCategoryId } } },
      orderBy: { popularityScore: "desc" },
      take: limit - ids.length,
      select: { id: true },
    });
    ids.push(...fill.map((f) => f.id));
  }
  return cardsByIds(ids);
}

export async function approvedReviews(softwareId: string, page = 1, perPage = 10) {
  const [items, total, distribution] = await Promise.all([
    db.review.findMany({
      where: { softwareId, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: { id: true, authorName: true, authorRole: true, companyName: true, companySize: true, rating: true, title: true, pros: true, cons: true, body: true, createdAt: true, ratingEase: true, ratingValue: true, ratingSupport: true, ratingFeatures: true, vendorReply: true, vendorReplyAt: true },
    }),
    db.review.count({ where: { softwareId, status: "APPROVED" } }),
    db.review.groupBy({ by: ["rating"], where: { softwareId, status: "APPROVED" }, _count: { _all: true }, orderBy: { rating: "desc" } }),
  ]);
  const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const d of distribution) dist[d.rating] = typeof d._count === "object" ? d._count._all ?? 0 : 0;
  return { items, total, distribution: dist };
}

/** Increments view counters (fire-and-forget from the detail page). */
export async function recordView(softwareId: string) {
  const today = new Date(new Date().toISOString().slice(0, 10));
  await db.$transaction([
    db.software.update({ where: { id: softwareId }, data: { viewCount: { increment: 1 } } }),
    db.softwareDailyStat.upsert({
      where: { softwareId_date: { softwareId, date: today } },
      create: { softwareId, date: today, views: 1 },
      update: { views: { increment: 1 } },
    }),
  ]);
}

// ─── Comparison ──────────────────────────────────────────────────────────────

export const MAX_COMPARE = 4;

export async function comparisonData(slugs: string[]) {
  const unique = [...new Set(slugs)].slice(0, MAX_COMPARE);
  const rows = await db.software.findMany({
    where: { slug: { in: unique }, status: "PUBLISHED" },
    include: {
      logo: true,
      vendor: { select: { name: true, slug: true, verification: true } },
      plans: { orderBy: { sortOrder: "asc" } },
      features: { orderBy: { sortOrder: "asc" }, take: 12 },
      attributes: { include: { attribute: true, option: true } },
      primaryCategory: { select: { name: true, slug: true } },
    },
  });
  const ordered = unique.map((s) => rows.find((r) => r.slug === s)).filter((r): r is (typeof rows)[number] => Boolean(r));

  // Comparable attributes present on any of the products, grouped.
  const attrs = new Map<string, { id: string; label: string; group: string; sortOrder: number; unit: string | null }>();
  for (const sw of ordered) for (const v of sw.attributes) if (v.attribute.isComparable) attrs.set(v.attributeId, v.attribute);
  const attrRows = [...attrs.values()]
    .sort((a, b) => a.group.localeCompare(b.group) || a.sortOrder - b.sortOrder)
    .map((a) => ({
      id: a.id,
      group: a.group,
      label: a.label,
      values: ordered.map((sw) => {
        const vals = sw.attributes.filter((v) => v.attributeId === a.id);
        if (!vals.length) return null;
        return vals
          .map((v) => v.option?.label ?? (v.valueBool !== null ? (v.valueBool ? "Yes" : "No") : v.valueNumber !== null ? `${Number(v.valueNumber).toLocaleString("en-IN")}${a.unit ? ` ${a.unit}` : ""}` : v.valueText ?? ""))
          .join(", ");
      }),
    }));
  return { products: ordered, attrRows };
}

const compareProductSelect = {
  slug: true,
  name: true,
  ratingAvg: true,
  ratingCount: true,
  logo: { select: { url: true } },
  brand: { select: { name: true } },
  vendor: { select: { name: true } },
  primaryCategory: { select: { name: true } },
} satisfies Prisma.SoftwareSelect;

function toCompareProduct(s: Prisma.SoftwareGetPayload<{ select: typeof compareProductSelect }>): CompareProduct {
  return {
    slug: s.slug,
    name: s.name,
    logoUrl: s.logo?.url ?? null,
    maker: s.brand?.name ?? s.vendor?.name ?? null,
    category: s.primaryCategory?.name ?? null,
    rating: Number(s.ratingAvg) || 0,
    ratingCount: s.ratingCount,
  };
}

/** "Choose product" list on the compare page: published products matching a name, brand, vendor or category. */
export async function compareCatalog(q: string, take = 60): Promise<{ total: number; items: CompareProduct[] }> {
  const term = q.trim().slice(0, 60);
  const where: Prisma.SoftwareWhereInput = {
    status: "PUBLISHED",
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode: "insensitive" } },
            { brand: { name: { contains: term, mode: "insensitive" } } },
            { vendor: { name: { contains: term, mode: "insensitive" } } },
            { primaryCategory: { name: { contains: term, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.software.count({ where }),
    db.software.findMany({ where, orderBy: [{ popularityScore: "desc" }, { name: "asc" }], take, select: compareProductSelect }),
  ]);
  return { total, items: rows.map(toCompareProduct) };
}

/** Slot cards on the compare page, in the order of the URL. */
export async function compareProducts(slugs: string[]): Promise<CompareProduct[]> {
  if (!slugs.length) return [];
  const rows = await db.software.findMany({ where: { slug: { in: slugs }, status: "PUBLISHED" }, select: compareProductSelect });
  return slugs.map((s) => rows.find((r) => r.slug === s)).filter((r): r is (typeof rows)[number] => Boolean(r)).map(toCompareProduct);
}

export interface CompareGroup {
  /** Category the products share (or a hand-picked comparison's label, with its category slug). */
  category: { name: string; slug: string };
  /** A hand-picked published comparison: its own address (otherwise /compare/a-vs-b). */
  href?: string;
  products: { slug: string; name: string; logoUrl: string | null }[];
}

/**
 * Ready-made product groups for the compare page, worked out from what's popular:
 * - trending: the most popular products of the busiest categories, three at a time;
 * - byCategory: the top three products of each main (top-level) category.
 * Cached; refreshed when the catalogue changes.
 */
export const compareShowcase = unstable_cache(
  async (): Promise<{ trending: CompareGroup[]; byCategory: CompareGroup[] }> => {
    const [products, categories] = await Promise.all([
      db.software.findMany({
        where: { status: "PUBLISHED", primaryCategoryId: { not: null } },
        orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
        take: 400,
        select: { slug: true, name: true, primaryCategoryId: true, logo: { select: { url: true } } },
      }),
      db.category.findMany({ where: { isActive: true }, select: { id: true, name: true, slug: true, parentId: true } }),
    ]);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const rootOf = (id: string) => {
      let c = byId.get(id);
      for (let i = 0; c?.parentId && i < 10; i++) c = byId.get(c.parentId) ?? c;
      return c;
    };
    const card = (p: (typeof products)[number]) => ({ slug: p.slug, name: p.name, logoUrl: p.logo?.url ?? null });
    const group = (key: (p: (typeof products)[number]) => string | undefined) => {
      const map = new Map<string, (typeof products)[number][]>();
      for (const p of products) {
        const k = key(p);
        if (!k || !byId.has(k)) continue;
        const list = map.get(k) ?? [];
        if (list.length < 3) list.push(p);
        map.set(k, list);
      }
      // Products are already in popularity order, so map order = categories ranked by their top product.
      return [...map.entries()]
        .filter(([, list]) => list.length >= 2)
        .map(([id, list]) => ({ category: { name: byId.get(id)!.name, slug: byId.get(id)!.slug }, products: list.map(card) }));
    };
    const trending = group((p) => p.primaryCategoryId ?? undefined).slice(0, 4);
    const byCategory = group((p) => (p.primaryCategoryId ? rootOf(p.primaryCategoryId)?.id : undefined)).slice(0, 6);
    return { trending, byCategory };
  },
  ["catalog:compare-showcase"],
  { tags: [CATALOG_TAG], revalidate: 1800 },
);

/** Live catalogue figures for the homepage hero (cached 30 minutes). */
export const siteStats = unstable_cache(
  async () => {
    const [products, categories, vendors, brands, reviews] = await Promise.all([
      db.software.count({ where: { status: "PUBLISHED" } }),
      db.category.count({ where: { isActive: true } }),
      db.vendor.count({ where: { isActive: true, kind: "VENDOR" } }),
      db.brand.count({ where: { isActive: true, software: { some: { status: "PUBLISHED" } } } }),
      db.review.count({ where: { status: "APPROVED" } }),
    ]);
    // "Software brands" counts brands once any are set up, otherwise the companies listing products.
    return { products, categories, vendors: brands || vendors, reviews };
  },
  ["catalog:stats"],
  { tags: [CATALOG_TAG], revalidate: 1800 },
);

/** Average sub-ratings from approved reviews, per product (null where nobody rated that aspect). */
export async function subRatings(softwareIds: string[]) {
  if (!softwareIds.length) return new Map<string, { ease: number | null; value: number | null; features: number | null; support: number | null }>();
  const rows = await db.review.groupBy({
    by: ["softwareId"],
    where: { softwareId: { in: softwareIds }, status: "APPROVED" },
    _avg: { ratingEase: true, ratingValue: true, ratingFeatures: true, ratingSupport: true },
  });
  return new Map(rows.map((r) => [r.softwareId, { ease: r._avg.ratingEase, value: r._avg.ratingValue, features: r._avg.ratingFeatures, support: r._avg.ratingSupport }]));
}

/**
 * Extra data for the category page: top products for the "Top N" list and price table,
 * classification terms that have products in this category ("Find by…" tiles), curated
 * comparisons involving these products, and sibling categories. Cached 15 minutes.
 */
export const categoryInsights = unstable_cache(
  async (categoryId: string, parentId: string | null) => {
    const ids = await categorySubtreeIds(categoryId);
    const inCategory = { status: "PUBLISHED" as const, categories: { some: { categoryId: { in: ids } } } };
    const [total, top, terms, comparisons, related] = await Promise.all([
      db.software.count({ where: inCategory }),
      db.software.findMany({ where: inCategory, orderBy: [{ popularityScore: "desc" }, { ratingCount: "desc" }], take: 10, select: softwareCardSelect }),
      db.taxonomyTerm.findMany({
        where: { isActive: true, kind: { in: ["DEPLOYMENT_MODEL", "PLATFORM", "OPERATING_SYSTEM", "CUSTOMER_TYPE", "BUDGET_RANGE", "LICENSING_MODEL", "USE_CASE"] }, software: { some: { software: inCategory } } },
        select: { id: true, kind: true, name: true, slug: true, _count: { select: { software: { where: { software: inCategory } } } } },
        take: 60,
      }),
      db.comparisonPage.findMany({
        where: { status: "PUBLISHED", items: { some: { software: inCategory } } },
        orderBy: { publishedAt: "desc" },
        take: 6,
        select: { slug: true, title: true, items: { orderBy: { sortOrder: "asc" }, select: { software: { select: { name: true, logo: { select: { url: true } } } } } } },
      }),
      db.category.findMany({
        where: { isActive: true, id: { not: categoryId }, parentId: parentId ?? null },
        orderBy: { sortOrder: "asc" },
        take: 12,
        select: { id: true, name: true, slug: true, icon: true },
      }),
    ]);
    return {
      total,
      top,
      terms: terms.map((t) => ({ id: t.id, kind: t.kind, name: t.name, slug: t.slug, count: t._count.software })).filter((t) => t.count > 0).sort((a, b) => b.count - a.count),
      comparisons,
      related,
    };
  },
  ["catalog:category-insights"],
  { tags: [CATALOG_TAG], revalidate: 900 },
);

/**
 * Rows for the category "Price comparison" table: every plan of every product in the category
 * (one row per product when it has no plans), alphabetical, plus the professions and use cases
 * used for the "Best for" column. Cached 15 minutes.
 */
export const categoryPriceRows = unstable_cache(
  async (categoryId: string, limit = 80) => {
    const ids = await categorySubtreeIds(categoryId);
    const products = await db.software.findMany({
      where: { status: "PUBLISHED", categories: { some: { categoryId: { in: ids } } } },
      orderBy: { name: "asc" },
      take: limit,
      select: {
        id: true, name: true, slug: true, startingPrice: true, currency: true, priceUnit: true, pricingModel: true,
        plans: { orderBy: { sortOrder: "asc" }, select: { id: true, name: true, price: true, currency: true, billingPeriod: true, priceUnit: true, description: true } },
        terms: { where: { term: { kind: { in: ["PROFESSION", "USE_CASE"] }, isActive: true } }, select: { term: { select: { kind: true, name: true } } } },
      },
    });
    return products.map((p) => {
      const professions = p.terms.filter((t) => t.term.kind === "PROFESSION").map((t) => t.term.name).slice(0, 2);
      const useCases = p.terms.filter((t) => t.term.kind === "USE_CASE").map((t) => t.term.name.toLowerCase()).slice(0, 2);
      const bestFor = professions.length && useCases.length ? `${professions.join(", ")} evaluating ${useCases.join(", ")}.` : professions.length ? `${professions.join(", ")}.` : useCases.length ? `Teams evaluating ${useCases.join(", ")}.` : null;
      return { id: p.id, name: p.name, slug: p.slug, startingPrice: p.startingPrice, currency: p.currency, priceUnit: p.priceUnit, pricingModel: p.pricingModel, plans: p.plans, bestFor };
    });
  },
  ["catalog:category-prices"],
  { tags: [CATALOG_TAG], revalidate: 900 },
);
