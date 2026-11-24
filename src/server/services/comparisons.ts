import "server-only";
import { z } from "zod";
import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, isUniqueViolation, notFound } from "@/server/errors";
import { sanitizeRichText } from "@/server/sanitize";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { optionalText, requiredText, seoInput, slug } from "@/lib/validation/common";
import { upsertSeo } from "./seo";
import { withBin } from "@/server/system/trash";
import { compareUrl } from "@/lib/compare";
import { comparisonSections, type ComparisonSection } from "@/lib/comparison-sections";
import { embedUrl } from "@/lib/video";
import { sanitizePlain } from "@/server/sanitize";
import type { Prisma } from "@prisma/client";
import { resolveCompareSlug } from "./compare-urls";
import { compareShowcase, type CompareGroup } from "./catalog";
import { getSetting, updateSetting } from "@/server/settings";
import { guardDelete, guardRemovals } from "@/server/rbac/deletion";

export const comparisonInput = z.object({
  title: requiredText(160),
  /** Empty → the products' slugs joined by "-vs-" (the same URL as the automatic comparison). */
  slug: z.union([slug, z.literal("")]).optional(),
  intro: z.string().max(20_000).nullish(),
  verdict: z.string().max(20_000).nullish(),
  /** Content blocks below the comparison table. */
  sections: comparisonSections,
  softwareIds: z.array(z.string().cuid()).min(2, "Pick at least two products").max(4),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  seo: seoInput.default({ noIndex: false }),
  note: optionalText(10),
});
export type ComparisonInput = z.infer<typeof comparisonInput>;

const TAG = "comparisons";

export const listPublishedComparisons = (limit: number) =>
  unstable_cache(
    () =>
      db.comparisonPage.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: limit,
        select: { slug: true, title: true, items: { orderBy: { sortOrder: "asc" }, select: { software: { select: { name: true, logo: { select: { url: true } } } } } } },
      }),
    ["comparisons", String(limit)],
    { tags: [TAG], revalidate: 3600 },
  )();

export const getPublishedComparison = (s: string) =>
  db.comparisonPage.findFirst({
    where: { slug: s, status: "PUBLISHED" },
    include: { seo: true, items: { orderBy: { sortOrder: "asc" }, select: { software: { select: { slug: true } } } } },
  });

/** Cleans section content on save: safe HTML, images from the media library only, YouTube/Vimeo videos only. */
async function cleanSections(list: ComparisonSection[]): Promise<ComparisonSection[]> {
  const imageIds = list.flatMap((x) => ("imageId" in x && x.imageId ? [x.imageId] : []));
  const media = imageIds.length ? await db.mediaAsset.findMany({ where: { id: { in: imageIds } }, select: { id: true, url: true, alt: true } }) : [];
  const out: ComparisonSection[] = [];
  list.forEach((x, n) => {
    const where = `sections.${n}`;
    switch (x.type) {
      case "TEXT":
        out.push({ ...x, html: sanitizeRichText(x.html) ?? "" });
        return;
      case "IMAGE":
      case "IMAGE_TEXT": {
        const m = media.find((a) => a.id === x.imageId);
        if (!m && x.type === "IMAGE") throw new AppError(`Section ${n + 1}: choose an image.`, "BAD_REQUEST", { [where]: ["Choose an image"] });
        const img = { imageId: m?.id ?? null, imageUrl: m?.url ?? null, alt: sanitizePlain(x.alt || m?.alt || "") };
        out.push(x.type === "IMAGE_TEXT" ? { ...x, ...img, html: sanitizeRichText(x.html) ?? "" } : { ...x, ...img, caption: sanitizePlain(x.caption) });
        return;
      }
      case "VIDEO":
        if (!embedUrl(x.url)) throw new AppError(`Section ${n + 1}: use a YouTube or Vimeo link.`, "BAD_REQUEST", { [where]: ["Use a YouTube or Vimeo link"] });
        out.push(x);
        return;
      case "FAQ":
        out.push({ ...x, items: x.items.filter((it) => it.q.trim() && it.a.trim()).map((it) => ({ q: sanitizePlain(it.q), a: sanitizePlain(it.a) })) });
        return;
      default:
        out.push(x);
    }
  });
  return out;
}

export async function saveComparison(user: Principal, id: string | null, input: ComparisonInput) {
  assertCan(user, id ? "comparisons.manage" : "comparisons.create");
  const products = await db.software.findMany({ where: { id: { in: input.softwareIds } }, select: { id: true, slug: true } });
  const productSlugs = products.map((p) => p.slug);
  const auto = compareUrl(productSlugs).slice("/compare/".length);
  const finalSlug = input.slug || auto;
  // A slug that reads as other products would show different products from what its URL says.
  if (finalSlug !== auto) {
    const reading = await resolveCompareSlug(finalSlug);
    if (reading.kind === "ok" && reading.slugs.join() !== [...productSlugs].sort().join()) {
      throw new AppError(`This URL reads as a comparison of other products. Leave the slug empty to use “${auto}”.`, "BAD_REQUEST", { slug: ["Names other products"] });
    }
  }
  input = { ...input, slug: finalSlug };
  const sections = await cleanSections(input.sections);
  if (id) {
    const cur = await db.comparisonPage.findUnique({ where: { id }, select: { title: true, sections: true } });
    if (cur) await guardRemovals(user, { kind: "comparison.save", args: { id, input }, label: `Comparison “${cur.title}”`, before: { sections: cur.sections ?? [] }, after: { sections }, root: "the comparison" });
  }
  try {
    const page = await db.$transaction(async (tx) => {
      const existing = id ? await tx.comparisonPage.findUnique({ where: { id } }) : null;
      if (id && !existing) throw notFound("Comparison");
      const seoId = await upsertSeo(tx, existing?.seoId ?? null, input.seo);
      const data = {
        title: input.title, slug: finalSlug, intro: sanitizeRichText(input.intro), verdict: sanitizeRichText(input.verdict), status: input.status, seoId, sections: sections as unknown as Prisma.InputJsonValue,
        ...(input.status === "PUBLISHED" && !existing?.publishedAt ? { publishedAt: new Date() } : {}),
      };
      const c = id ? await tx.comparisonPage.update({ where: { id }, data }) : await tx.comparisonPage.create({ data });
      await tx.comparisonItem.deleteMany({ where: { comparisonId: c.id } });
      await tx.comparisonItem.createMany({ data: input.softwareIds.map((softwareId, i) => ({ comparisonId: c.id, softwareId, sortOrder: i })) });
      await audit({ actorId: user.id, action: id ? "comparison.update" : "comparison.create", entityType: "comparison", entityId: c.id, summary: c.title }, tx);
      return c;
    });
    revalidateTag(TAG);
    return page;
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new AppError("Another comparison uses that URL.", "CONFLICT", { slug: ["Already in use"] });
    throw e;
  }
}

export async function deleteComparison(user: Principal, id: string) {
  await guardDelete(user, "comparison", { id });
  const c = await withBin(user, "ComparisonPage", [id], (tx) => tx.comparisonPage.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "comparison.delete", entityType: "comparison", entityId: id, summary: c.title });
  revalidateTag(TAG);
}

// ─── Compare page lists (Admin › Comparisons › Compare page) ─────────────────

/**
 * The "Trending product comparisons" and "Popular comparisons by category" lists: automatic from
 * popularity, or the published comparisons picked in admin (their own pages, with their content).
 */
export async function getCompareShowcase(): Promise<{ trending: CompareGroup[]; byCategory: CompareGroup[] }> {
  const [settings, auto] = await Promise.all([getSetting("compareShowcase"), compareShowcase()]);
  const lists = { trending: settings.trending, byCategory: settings.byCategory };
  const manualIds = [...lists.trending.items, ...lists.byCategory.items].map((i) => i.comparisonId);
  const pages = (lists.trending.mode === "manual" || lists.byCategory.mode === "manual") && manualIds.length
    ? await db.comparisonPage.findMany({
        where: { id: { in: manualIds }, status: "PUBLISHED" },
        select: {
          id: true, slug: true, title: true,
          items: { orderBy: { sortOrder: "asc" }, select: { software: { select: { slug: true, name: true, status: true, logo: { select: { url: true } }, primaryCategory: { select: { name: true, slug: true } } } } } },
        },
      })
    : [];
  const pick = (list: (typeof lists)["trending"], fallback: CompareGroup[]): CompareGroup[] => {
    if (list.hidden) return [];
    if (list.mode === "auto") return fallback.slice(0, list.limit);
    return list.items
      .flatMap((it) => {
        const p = pages.find((x) => x.id === it.comparisonId);
        if (!p) return [];
        const products = p.items.filter((i) => i.software.status === "PUBLISHED").map((i) => ({ slug: i.software.slug, name: i.software.name, logoUrl: i.software.logo?.url ?? null }));
        if (products.length < 2) return [];
        const cat = p.items.find((i) => i.software.primaryCategory)?.software.primaryCategory;
        return [{ category: { name: it.label || cat?.name || p.title, slug: cat?.slug ?? "" }, products, href: `/compare/${p.slug}` }];
      })
      .slice(0, list.limit);
  };
  return { trending: pick(lists.trending, auto.trending), byCategory: pick(lists.byCategory, auto.byCategory) };
}

/** Admin › Comparisons › Compare page: published comparisons that can be picked, and what "automatic" shows now. */
export async function compareShowcaseAdmin(user: Principal) {
  assertCan(user, "comparisons.view");
  const [settings, auto, comparisons] = await Promise.all([
    getSetting("compareShowcase"),
    compareShowcase(),
    db.comparisonPage.findMany({
      orderBy: { title: "asc" },
      select: { id: true, slug: true, title: true, status: true, items: { orderBy: { sortOrder: "asc" }, select: { software: { select: { name: true } } } } },
    }),
  ]);
  return {
    settings,
    auto: { trending: auto.trending.map((g) => g.products.map((p) => p.name).join(" vs ")), byCategory: auto.byCategory.map((g) => `${g.category.name}: ${g.products.map((p) => p.name).join(", ")}`) },
    comparisons: comparisons.map((c) => ({ id: c.id, slug: c.slug, title: c.title, status: c.status, products: c.items.map((i) => i.software.name) })),
  };
}

export async function saveCompareShowcase(user: Principal, value: unknown) {
  assertCan(user, "comparisons.manage");
  return updateSetting(user, "compareShowcase", value);
}
