import "server-only";
import { z } from "zod";
import type { Prisma, TaxonomyKind } from "@prisma/client";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { sanitizePlain, sanitizeRichText } from "@/server/sanitize";
import { STARTER_TERMS, TAXONOMY_BY_KIND, TAXONOMY_KINDS, slugifyTerm } from "@/lib/taxonomies";
import { cardsByIds, softwareCardSelect } from "./catalog";
import { CATALOG_TAG } from "./software";
import { moveToBin } from "@/server/system/trash";
import { guardDelete } from "@/server/rbac/deletion";

/** Professions, use cases, features, platforms, … — see src/lib/taxonomies.ts for the list. */

export const TERMS_TAG = "terms";
const termTag = (kind: TaxonomyKind) => `terms:${kind}`;

const faq = z.object({ question: z.string().trim().min(1).max(300), answer: z.string().trim().min(1).max(3000) });

export const termInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  slug: z
    .string()
    .trim()
    .max(80)
    .transform((s) => s.toLowerCase())
    .refine((s) => !s || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s), "Lowercase letters, numbers and hyphens only")
    .optional()
    .default(""),
  parentId: z.string().cuid().nullable().optional().default(null),
  description: z.string().max(600).optional().nullable(),
  headline: z.string().max(120).optional().nullable(),
  content: z.string().max(60_000).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
  promotedSoftwareId: z.string().cuid().nullable().optional().default(null),
  promotedBadge: z.string().max(40).optional().nullable(),
  faqs: z.array(faq).max(30).default([]),
  seoTitle: z.string().max(120).optional().nullable(),
  seoDescription: z.string().max(300).optional().nullable(),
  noIndex: z.boolean().default(false),
});
export type TermInput = z.infer<typeof termInput>;

const blank = (s: string | null | undefined) => (s && s.trim() ? sanitizePlain(s.trim()) : null);

function refresh(kind: TaxonomyKind) {
  revalidateTag(TERMS_TAG);
  revalidateTag(termTag(kind));
  revalidateTag(CATALOG_TAG);
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function listTermsAdmin(user: Principal, kind: TaxonomyKind, q: { search?: string; page?: number; perPage?: number }) {
  assertCan(user, "taxonomy.view");
  const perPage = q.perPage ?? 25;
  const page = Math.max(1, q.page ?? 1);
  const where: Prisma.TaxonomyTermWhereInput = { kind, ...(q.search ? { OR: [{ name: { contains: q.search, mode: "insensitive" } }, { slug: { contains: q.search.toLowerCase() } }] } : {}) };
  const [items, total, all] = await Promise.all([
    db.taxonomyTerm.findMany({
      where,
      orderBy: [{ name: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      include: { parent: { select: { name: true } }, promotedSoftware: { select: { id: true, name: true } }, _count: { select: { software: true, children: true } } },
    }),
    db.taxonomyTerm.count({ where }),
    db.taxonomyTerm.findMany({ where: { kind }, orderBy: { name: "asc" }, select: { id: true, name: true, parentId: true } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)), all };
}

async function assertParent(kind: TaxonomyKind, id: string | null, parentId: string | null) {
  if (!parentId) return;
  if (!TAXONOMY_BY_KIND[kind].hierarchical) throw new AppError(`${TAXONOMY_BY_KIND[kind].plural} don't have parents.`, "BAD_REQUEST", { parentId: ["Not allowed here"] });
  if (parentId === id) throw new AppError("A term can't be its own parent.", "BAD_REQUEST", { parentId: ["Choose another parent"] });
  // Walk up from the proposed parent: it must be the same taxonomy and must not be a descendant of this term.
  let cursor: string | null = parentId;
  for (let i = 0; cursor && i < 20; i++) {
    const node: { id: string; kind: TaxonomyKind; parentId: string | null } | null = await db.taxonomyTerm.findUnique({ where: { id: cursor }, select: { id: true, kind: true, parentId: true } });
    if (!node || node.kind !== kind) throw new AppError("Choose a parent from the same list.", "BAD_REQUEST", { parentId: ["Invalid parent"] });
    if (id && node.parentId === id) throw new AppError("That would put the term inside itself.", "BAD_REQUEST", { parentId: ["Choose another parent"] });
    cursor = node.parentId;
  }
}

export async function saveTerm(user: Principal, kind: TaxonomyKind, id: string | null, raw: unknown) {
  assertCan(user, id ? "taxonomy.manage" : "taxonomy.create");
  const i = termInput.parse(raw);
  const slug = i.slug || slugifyTerm(i.name);
  await assertParent(kind, id, i.parentId);
  const clash = await db.taxonomyTerm.findFirst({ where: { kind, slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new AppError("Another term already uses this slug.", "CONFLICT", { slug: ["Already in use"] });
  if (i.promotedSoftwareId) {
    const ok = await db.software.findFirst({ where: { id: i.promotedSoftwareId }, select: { id: true } });
    if (!ok) throw new AppError("Choose an existing product to promote.", "BAD_REQUEST", { promotedSoftwareId: ["Not found"] });
  }
  const data = {
    name: sanitizePlain(i.name),
    slug,
    parentId: i.parentId,
    description: blank(i.description),
    headline: blank(i.headline),
    content: i.content ? sanitizeRichText(i.content) : null,
    sortOrder: i.sortOrder,
    isActive: i.isActive,
    promotedSoftwareId: i.promotedSoftwareId,
    promotedBadge: blank(i.promotedBadge),
    faqs: i.faqs.length ? (i.faqs.map((f) => ({ question: sanitizePlain(f.question), answer: sanitizePlain(f.answer) })) as Prisma.InputJsonValue) : undefined,
    seoTitle: blank(i.seoTitle),
    seoDescription: blank(i.seoDescription),
    noIndex: i.noIndex,
  };
  const term = id
    ? await db.taxonomyTerm.update({ where: { id }, data: { ...data, faqs: data.faqs ?? [] } })
    : await db.taxonomyTerm.create({ data: { ...data, kind } });
  await audit({ actorId: user.id, action: id ? "term.update" : "term.create", entityType: "term", entityId: term.id, summary: `${TAXONOMY_BY_KIND[kind].singular}: ${term.name}` });
  refresh(kind);
  return term;
}

/** Deletes terms; their children move up to the deleted term's parent (like WordPress). */
export async function deleteTerms(user: Principal, kind: TaxonomyKind, ids: string[]) {
  await guardDelete(user, "terms", { kind, ids });
  const terms = await db.taxonomyTerm.findMany({ where: { id: { in: ids }, kind }, select: { id: true, name: true, parentId: true } });
  if (!terms.length) throw notFound("Term");
  await db.$transaction(async (tx) => {
    await moveToBin(tx, user, "TaxonomyTerm", terms.map((t) => t.id));
    for (const t of terms) await tx.taxonomyTerm.updateMany({ where: { parentId: t.id }, data: { parentId: t.parentId && !ids.includes(t.parentId) ? t.parentId : null } });
    await tx.taxonomyTerm.deleteMany({ where: { id: { in: terms.map((t) => t.id) } } });
    await audit({ actorId: user.id, action: "term.delete", entityType: "term", summary: `${TAXONOMY_BY_KIND[kind].plural}: deleted ${terms.map((t) => t.name).join(", ")}` }, tx);
  }, { timeout: 60_000, maxWait: 10_000 });
  refresh(kind);
  return terms.length;
}

/** Adds any missing starter terms (never changes existing ones). */
export async function installStarterTerms(user: Principal, kind: TaxonomyKind) {
  assertCan(user, "taxonomy.create");
  const names = STARTER_TERMS[kind];
  const existing = new Set((await db.taxonomyTerm.findMany({ where: { kind }, select: { slug: true } })).map((t) => t.slug));
  const toAdd = names.map((name, i) => ({ kind, name, slug: slugifyTerm(name), sortOrder: i })).filter((t) => !existing.has(t.slug));
  if (toAdd.length) await db.taxonomyTerm.createMany({ data: toAdd, skipDuplicates: true });
  await audit({ actorId: user.id, action: "term.install", entityType: "term", summary: `${TAXONOMY_BY_KIND[kind].plural}: added ${toAdd.length} starter terms` });
  refresh(kind);
  return toAdd.length;
}

// ─── Public ──────────────────────────────────────────────────────────────────

const published = { status: "PUBLISHED" } as const;

/** All active terms of a taxonomy with their published-product counts (cached). */
export const termIndex = (kind: TaxonomyKind) =>
  unstable_cache(
    async () => {
      const rows = await db.taxonomyTerm.findMany({
        where: { kind, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, slug: true, description: true, parentId: true, _count: { select: { software: { where: { software: published } } } } },
      });
      return rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, description: r.description, parentId: r.parentId, count: r._count.software }));
    },
    ["terms:index", kind],
    { tags: [TERMS_TAG, termTag(kind), CATALOG_TAG], revalidate: 900 },
  )();

export async function getPublicTerm(kind: TaxonomyKind, slug: string) {
  return db.taxonomyTerm.findFirst({
    where: { kind, slug, isActive: true },
    include: {
      parent: { select: { name: true, slug: true } },
      children: { where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true, slug: true } },
      promotedSoftware: { select: { ...softwareCardSelect, status: true } },
    },
  });
}

/** Products for a term (including its child terms), most popular first, paginated. */
export async function termProducts(termId: string, page: number, perPage: number) {
  const childIds = (await db.taxonomyTerm.findMany({ where: { parentId: termId, isActive: true }, select: { id: true } })).map((c) => c.id);
  const where: Prisma.SoftwareWhereInput = { ...published, terms: { some: { termId: { in: [termId, ...childIds] } } } };
  const [ids, total, priced, popular] = await Promise.all([
    db.software.findMany({ where, orderBy: [{ isSponsored: "desc" }, { popularityScore: "desc" }, { name: "asc" }], skip: (page - 1) * perPage, take: perPage, select: { id: true } }),
    db.software.count({ where }),
    db.software.findMany({
      where,
      orderBy: [{ popularityScore: "desc" }],
      take: 40,
      select: {
        id: true, name: true, slug: true, pricingModel: true, startingPrice: true, currency: true, priceUnit: true,
        terms: { where: { term: { kind: "PROFESSION", isActive: true } }, select: { term: { select: { name: true } } }, take: 4 },
      },
    }),
    db.software.findMany({ where, orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { popularityScore: "desc" }], take: 4, select: { id: true } }),
  ]);
  const [items, popularCards] = await Promise.all([cardsByIds(ids.map((r) => r.id)), cardsByIds(popular.map((r) => r.id))]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)), priced, popular: popularCards, productIds: priced.map((p) => p.id) };
}

/** Terms assigned to a product, grouped for the product page. */
export async function productTerms(softwareId: string) {
  const rows = await db.softwareTerm.findMany({
    where: { softwareId, term: { isActive: true } },
    select: { term: { select: { kind: true, name: true, slug: true } } },
    orderBy: { term: { name: "asc" } },
  });
  const out = new Map<TaxonomyKind, { name: string; slug: string }[]>();
  for (const { term } of rows) out.set(term.kind, [...(out.get(term.kind) ?? []), { name: term.name, slug: term.slug }]);
  return TAXONOMY_KINDS.filter((k) => out.has(k)).map((k) => ({ kind: k, terms: out.get(k)! }));
}

export const parseFaqs = (v: Prisma.JsonValue | null | undefined): { question: string; answer: string }[] =>
  Array.isArray(v) ? v.flatMap((f) => (f && typeof f === "object" && "question" in f && "answer" in f ? [{ question: String(f.question), answer: String(f.answer) }] : [])) : [];
