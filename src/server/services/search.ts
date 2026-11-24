import "server-only";
import { taxonomyDef, termHeadline, type TaxonomyKind } from "@/lib/taxonomies";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";

/**
 * Catalogue search on PostgreSQL.
 *
 * Matching uses the weighted `searchVector` (tsvector, GIN-indexed) with a
 * prefix query built from the user's words, OR'd with trigram similarity on
 * the name so typos ("tallly") still match. Filters compile to EXISTS joins on
 * indexed tables. The SearchProvider interface lets a dedicated engine
 * (Meilisearch, Typesense, OpenSearch) replace this later without UI changes.
 */

export const SORTS = ["relevance", "popular", "rating", "price_asc", "price_desc", "name", "newest"] as const;
export type SortKey = (typeof SORTS)[number];

const list = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (v === undefined || v === "" ? [] : Array.isArray(v) ? v : String(v).split(",")), z.array(item).max(50));

/** Parses URL search params into a validated search request. Unknown/invalid values are dropped. */
export const searchParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().max(80).optional().catch(undefined), // slug
  industry: z.string().max(80).optional().catch(undefined), // slug
  vendor: z.string().max(80).optional().catch(undefined), // slug
  pricing: list(z.enum(["FREE", "FREEMIUM", "SUBSCRIPTION", "ONE_TIME", "USAGE_BASED", "QUOTE_BASED"])).catch([]),
  deployment: list(z.enum(["CLOUD", "ON_PREMISE", "HYBRID", "MOBILE", "DESKTOP"])).catch([]),
  trial: z.enum(["1"]).optional().catch(undefined),
  free: z.enum(["1"]).optional().catch(undefined),
  minPrice: z.coerce.number().min(0).optional().catch(undefined),
  maxPrice: z.coerce.number().min(0).optional().catch(undefined),
  rating: z.coerce.number().min(1).max(5).optional().catch(undefined),
  /** Attribute option filters: opt=<optionId>,<optionId> (OR within an attribute, AND across attributes). */
  opt: list(z.string().cuid()).catch([]),
  /** Classification filters (platform, deployment model, licence…): every selected term must match. */
  term: list(z.string().cuid()).catch([]),
  sort: z.enum(SORTS).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).default(1).catch(1),
});
export type SearchParams = z.infer<typeof searchParamsSchema>;

export interface SearchRequest {
  q?: string;
  categoryIds?: string[];
  industryId?: string;
  vendorId?: string;
  brandId?: string;
  pricing?: string[];
  deployment?: string[];
  freeTrial?: boolean;
  freeVersion?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  /** optionIds grouped by attribute id */
  options?: Record<string, string[]>;
  termIds?: string[];
  sort: SortKey;
  page: number;
  perPage: number;
  sponsoredFirst: boolean;
  /** Ranking numbers from Website settings › Business rules. */
  tuning?: { typoStrictness: number; nameWeight: number; classificationBoost: number; popularityWeight: number };
}

const DEFAULT_TUNING = { typoStrictness: 3, nameWeight: 2, classificationBoost: 0.6, popularityWeight: 0.05 };

export interface SearchResult {
  ids: string[];
  total: number;
  facets: { pricing: Record<string, number>; deployment: Record<string, number>; options: Record<string, number> };
}

export interface SearchProvider {
  search(req: SearchRequest): Promise<SearchResult>;
  suggest(q: string, limit?: number): Promise<Suggestion[]>;
}

export interface Suggestion {
  type: "software" | "category" | "vendor" | "term";
  label: string;
  href: string;
  meta?: string | null;
  logoUrl?: string | null;
}

/** Turns free text into a safe prefix tsquery string: "zoho book" → "zoho:* & book:*". */
export function toPrefixTsQuery(q: string): string | null {
  const words = q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(" & ") : null;
}

/** Words people add to searches that never appear in a classification name ("2d drafting software"). */
const FILLER = new Set(["software", "softwares", "app", "apps", "application", "applications", "tool", "tools", "program", "programs", "best", "top", "free", "online", "for", "in", "india", "the", "a", "an", "and", "of", "with", "solution", "solutions", "system", "systems", "platform"]);

/** The meaningful part of a query, for matching classification names: "best 2d drafting software" → "2d drafting". */
export function termQueryText(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    // Plural → singular, so "architects" finds "Architect" (prefix matching keeps "sales" → "sale:*" working).
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w))
    .join(" ")
    .trim();
}

/** Products tagged with a classification (use case, profession, platform…) whose name matches the query. */
function termMatchSql(q: string | undefined): Prisma.Sql | null {
  const text = q ? termQueryText(q) : "";
  const ts = text ? toPrefixTsQuery(text) : null;
  if (!ts) return null;
  return Prisma.sql`EXISTS (
    SELECT 1 FROM "SoftwareTerm" stm JOIN "TaxonomyTerm" tt ON tt."id" = stm."termId"
    LEFT JOIN "TaxonomyTerm" tp ON tp."id" = tt."parentId"
    WHERE stm."softwareId" = s."id" AND tt."isActive"
      AND (to_tsvector('simple', unaccent(tt."name")) @@ to_tsquery('simple', ${ts})
        OR (tp."id" IS NOT NULL AND tp."isActive" AND to_tsvector('simple', unaccent(tp."name")) @@ to_tsquery('simple', ${ts}))))`;
}

function whereClause(req: SearchRequest): Prisma.Sql {
  const parts: Prisma.Sql[] = [Prisma.sql`s."status" = 'PUBLISHED'`];
  const ts = req.q ? toPrefixTsQuery(req.q) : null;
  if (ts) {
    const terms = termMatchSql(req.q);
    const fuzzy = (req.tuning ?? DEFAULT_TUNING).typoStrictness / 10;
    parts.push(
      terms
        ? Prisma.sql`(s."searchVector" @@ to_tsquery('simple', ${ts}) OR similarity(s."name", ${req.q}) > ${fuzzy} OR ${terms})`
        : Prisma.sql`(s."searchVector" @@ to_tsquery('simple', ${ts}) OR similarity(s."name", ${req.q}) > ${fuzzy})`,
    );
  }
  if (req.categoryIds?.length) {
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "SoftwareCategory" sc WHERE sc."softwareId" = s."id" AND sc."categoryId" IN (${Prisma.join(req.categoryIds)}))`);
  }
  if (req.industryId) {
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "SoftwareIndustry" si WHERE si."softwareId" = s."id" AND si."industryId" = ${req.industryId})`);
  }
  if (req.vendorId) parts.push(Prisma.sql`s."vendorId" = ${req.vendorId}`);
  if (req.brandId) parts.push(Prisma.sql`s."brandId" = ${req.brandId}`);
  if (req.pricing?.length) parts.push(Prisma.sql`s."pricingModel"::text IN (${Prisma.join(req.pricing)})`);
  if (req.deployment?.length) parts.push(Prisma.sql`s."deployment" && ARRAY[${Prisma.join(req.deployment)}]::"DeploymentType"[]`);
  if (req.freeTrial) parts.push(Prisma.sql`s."hasFreeTrial" = true`);
  if (req.freeVersion) parts.push(Prisma.sql`s."hasFreeVersion" = true`);
  if (req.minPrice !== undefined) parts.push(Prisma.sql`s."startingPrice" >= ${req.minPrice}`);
  if (req.maxPrice !== undefined) parts.push(Prisma.sql`s."startingPrice" <= ${req.maxPrice}`);
  if (req.minRating !== undefined) parts.push(Prisma.sql`s."ratingAvg" >= ${req.minRating}`);
  for (const optionIds of Object.values(req.options ?? {})) {
    if (!optionIds.length) continue;
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "SoftwareAttributeValue" av WHERE av."softwareId" = s."id" AND av."optionId" IN (${Prisma.join(optionIds)}))`);
  }
  for (const termId of req.termIds ?? []) {
    parts.push(Prisma.sql`EXISTS (SELECT 1 FROM "SoftwareTerm" st WHERE st."softwareId" = s."id" AND st."termId" = ${termId})`);
  }
  return Prisma.join(parts, " AND ");
}

function orderClause(req: SearchRequest): Prisma.Sql {
  const sponsored = req.sponsoredFirst ? Prisma.sql`(CASE WHEN s."isSponsored" THEN 0 ELSE 1 END), COALESCE(s."sponsoredRank", 999), ` : Prisma.empty;
  const ts = req.q ? toPrefixTsQuery(req.q) : null;
  switch (req.sort) {
    case "relevance": {
      const terms = termMatchSql(req.q);
      // Products tagged with a matching classification get a boost, so "2d drafting" ranks tagged products first.
      const w = req.tuning ?? DEFAULT_TUNING;
      const termBoost = terms ? Prisma.sql` + (CASE WHEN ${terms} THEN ${w.classificationBoost} ELSE 0 END)` : Prisma.empty;
      return ts
        ? Prisma.sql`${sponsored}(ts_rank_cd(s."searchVector", to_tsquery('simple', ${ts})) + similarity(s."name", ${req.q}) * ${w.nameWeight}${termBoost} + ln(1 + s."popularityScore") * ${w.popularityWeight}) DESC, s."id"`
        : Prisma.sql`${sponsored}s."popularityScore" DESC, s."id"`;
    }
    case "popular":
      return Prisma.sql`${sponsored}s."popularityScore" DESC, s."id"`;
    case "rating":
      return Prisma.sql`${sponsored}s."ratingAvg" DESC, s."ratingCount" DESC, s."id"`;
    case "price_asc":
      return Prisma.sql`s."startingPrice" ASC NULLS LAST, s."id"`;
    case "price_desc":
      return Prisma.sql`s."startingPrice" DESC NULLS LAST, s."id"`;
    case "name":
      return Prisma.sql`s."name" ASC, s."id"`;
    case "newest":
      return Prisma.sql`s."publishedAt" DESC NULLS LAST, s."id"`;
  }
}

export const postgresSearch: SearchProvider = {
  async search(req) {
    const where = whereClause(req);
    const offset = (req.page - 1) * req.perPage;

    const [rows, countRows, pricingRows, deploymentRows, optionRows] = await Promise.all([
      db.$queryRaw<{ id: string }[]>`SELECT s."id" FROM "Software" s WHERE ${where} ORDER BY ${orderClause(req)} LIMIT ${req.perPage} OFFSET ${offset}`,
      db.$queryRaw<{ count: bigint }[]>`SELECT count(*)::bigint AS count FROM "Software" s WHERE ${where}`,
      db.$queryRaw<{ key: string; count: bigint }[]>`SELECT s."pricingModel"::text AS key, count(*)::bigint AS count FROM "Software" s WHERE ${where} GROUP BY 1`,
      db.$queryRaw<{ key: string; count: bigint }[]>`SELECT d::text AS key, count(*)::bigint AS count FROM "Software" s, unnest(s."deployment") d WHERE ${where} GROUP BY 1`,
      db.$queryRaw<{ key: string; count: bigint }[]>`
        SELECT av."optionId" AS key, count(DISTINCT s."id")::bigint AS count
        FROM "Software" s JOIN "SoftwareAttributeValue" av ON av."softwareId" = s."id"
        WHERE ${where} AND av."optionId" IS NOT NULL GROUP BY 1`,
    ]);
    const toMap = (r: { key: string; count: bigint }[]) => Object.fromEntries(r.map((x) => [x.key, Number(x.count)]));
    return {
      ids: rows.map((r) => r.id),
      total: Number(countRows[0]?.count ?? 0),
      facets: { pricing: toMap(pricingRows), deployment: toMap(deploymentRows), options: toMap(optionRows) },
    };
  },

  async suggest(q, limit = 8) {
    const term = q.trim().slice(0, 60);
    if (term.length < 2) return [];
    const ts = toPrefixTsQuery(term);
    const like = `${term.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const termsWhere = termMatchSql(term);
    const termText = termQueryText(term);
    const [software, categories, vendors, terms] = await Promise.all([
      db.$queryRaw<{ name: string; slug: string; tagline: string | null; logo: string | null }[]>`
        SELECT s."name", s."slug", s."tagline", m."url" AS logo
        FROM "Software" s LEFT JOIN "MediaAsset" m ON m."id" = s."logoId"
        WHERE s."status" = 'PUBLISHED' AND (s."name" ILIKE ${like} OR s."searchVector" @@ to_tsquery('simple', ${ts ?? ""}) OR similarity(s."name", ${term}) > 0.35${termsWhere ? Prisma.sql` OR ${termsWhere}` : Prisma.empty})
        ORDER BY (s."name" ILIKE ${like}) DESC, similarity(s."name", ${term}) DESC, s."popularityScore" DESC
        LIMIT ${limit}`,
      db.$queryRaw<{ name: string; slug: string }[]>`
        SELECT c."name", c."slug" FROM "Category" c
        WHERE c."isActive" AND (c."name" ILIKE ${`%${term.replace(/[%_\\]/g, (ch) => `\\${ch}`)}%`} OR similarity(c."name", ${term}) > 0.35)
        ORDER BY similarity(c."name", ${term}) DESC LIMIT 4`,
      db.$queryRaw<{ name: string; slug: string }[]>`
        SELECT v."name", v."slug" FROM "Vendor" v
        WHERE v."isActive" AND v."name" ILIKE ${like} ORDER BY v."name" LIMIT 3`,
      termText.length >= 2 ? matchingTerms(termText, 4) : Promise.resolve([]),
    ]);
    return [
      ...categories.map((c) => ({ type: "category" as const, label: c.name, href: `/categories/${c.slug}`, meta: "Category" })),
      ...terms.map((t) => ({ type: "term" as const, label: t.label, href: t.href, meta: t.meta })),
      ...software.map((s) => ({ type: "software" as const, label: s.name, href: `/software/${s.slug}`, meta: s.tagline, logoUrl: s.logo })),
      ...vendors.map((v) => ({ type: "vendor" as const, label: v.name, href: `/vendors/${v.slug}`, meta: "Vendor" })),
    ];
  },
};

/** Active provider. Swap here (or via env) when adding a dedicated search engine. */
export const searchProvider: SearchProvider = postgresSearch;

/** Groups selected option ids by their attribute so filters AND across attributes. */
export async function groupOptionIds(optionIds: string[]): Promise<Record<string, string[]>> {
  if (!optionIds.length) return {};
  const options = await db.attributeOption.findMany({ where: { id: { in: optionIds } }, select: { id: true, attributeId: true } });
  const grouped: Record<string, string[]> = {};
  for (const o of options) (grouped[o.attributeId] ??= []).push(o.id);
  return grouped;
}

export async function logSearch(query: string, resultCount: number) {
  const q = query.trim().toLowerCase().slice(0, 100);
  if (q.length < 2) return;
  await db.searchQueryLog.create({ data: { query: q, resultCount } }).catch(() => undefined);
}

/**
 * Classification pages (use cases, professions, platforms…) whose name matches the text, with their
 * published-product counts. Used by search suggestions and the search results page.
 */
export async function matchingTerms(text: string, limit = 4): Promise<{ label: string; href: string; meta: string; count: number }[]> {
  const clean = termQueryText(text);
  if (clean.length < 2) return [];
  const contains = `%${clean.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const rows = await db.$queryRaw<{ kind: TaxonomyKind; name: string; slug: string; count: bigint }[]>`
    SELECT t."kind"::text AS kind, t."name", t."slug", count(sw."id")::bigint AS count
    FROM "TaxonomyTerm" t
    LEFT JOIN "SoftwareTerm" st ON st."termId" = t."id"
    LEFT JOIN "Software" sw ON sw."id" = st."softwareId" AND sw."status" = 'PUBLISHED'
    WHERE t."isActive" AND (unaccent(t."name") ILIKE unaccent(${contains}) OR similarity(t."name", ${clean}) > 0.4)
    GROUP BY t."kind", t."name", t."slug"
    -- Pages with products first; empty ones still show (their page offers free advice instead of a list).
    ORDER BY (count(sw."id") > 0) DESC, similarity(t."name", ${clean}) DESC, count(sw."id") DESC
    LIMIT ${limit}`;
  const { taxonomies } = await getSettings();
  return rows.flatMap((r) => {
    const def = taxonomyDef(r.kind, taxonomies);
    if (!def.enabled) return [];
    const n = Number(r.count);
    return { label: termHeadline(r.kind, { name: r.name }, def), href: `/${def.path}/${r.slug}`, meta: `${def.singular} · ${n ? `${n} ${n === 1 ? "product" : "products"}` : "no products yet"}`, count: n };
  });
}
