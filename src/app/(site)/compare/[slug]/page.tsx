import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { compareProducts } from "@/server/services/catalog";
import { readSections } from "@/lib/comparison-sections";
import { getPublishedComparison } from "@/server/services/comparisons";
import { curatedComparisonFor, resolveCompareSlug } from "@/server/services/compare-urls";
import { buildMetadata } from "@/server/seo/metadata";
import { getT } from "@/server/texts";
import { CompareTool } from "../compare-tool";

/**
 * /compare/{slug}:
 * 1. A published curated comparison with this slug (Admin › Comparisons) — indexable, in the sitemap.
 * 2. Otherwise product slugs joined by "-vs-" (/compare/alibre-design-vs-altair-inspire) — the compare
 *    tool with those products. Shareable and indexable-looking, but noindex unless an admin publishes
 *    a curated comparison for the same products (then this URL redirects there), so not every
 *    combination becomes a page in Google.
 * Wrong order, renamed products or upper case → permanent redirect to the one URL. Unknown products → 404.
 */
type Props = { params: Promise<{ slug: string }> };

const load = cache(async (slug: string) => {
  const curated = await getPublishedComparison(slug);
  if (curated) return { kind: "curated" as const, curated };
  const r = await resolveCompareSlug(slug);
  if (r.kind !== "ok") return r;
  // One product picked so far: the compare tool with it in the first slot (not a page for Google).
  if (r.slugs.length < 2) return { ...r, single: true as const };
  const owner = await curatedComparisonFor(r.slugs);
  if (owner) return { kind: "redirect" as const, to: `/compare/${owner.slug}` };
  return r;
});

const settle = (r: Awaited<ReturnType<typeof load>>) => {
  if (r.kind === "not-found") notFound();
  if (r.kind === "redirect") permanentRedirect(r.to);
  return r;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = settle(await load((await params).slug));
  if (r.kind === "curated") {
    const c = r.curated;
    return buildMetadata({ path: `/compare/${c.slug}`, title: c.title, description: c.intro?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160), seo: c.seo });
  }
  if ("single" in r) {
    const t = await getT();
    return buildMetadata({ path: "/compare", title: t("compare.metaTitle"), description: t("compare.metaDescription"), noIndex: true });
  }
  const [products, t] = await Promise.all([compareProducts(r.slugs), getT()]);
  const names = products.map((p) => p.name).join(` ${t("compare.vs")} `);
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  return buildMetadata({
    path: r.path,
    title: t("compare.metaTitlePicked", { names, year: String(new Date().getFullYear()) }),
    description: t("compare.metaDescriptionPicked", { names, category: categories.length === 1 ? ` for ${categories[0]}` : "" }),
    // Self-referencing canonical, but not indexed: only curated comparisons are pages for Google.
    noIndex: true,
  });
}

export default async function ComparisonPage({ params }: Props) {
  const r = settle(await load((await params).slug));
  if (r.kind === "ok") return <CompareTool slugs={r.slugs} />;

  const c = r.curated;
  return (
    <CompareTool
      slugs={c.items.map((i) => i.software.slug)}
      curated={{ id: c.id, title: c.title, path: `/compare/${c.slug}`, intro: c.intro, verdict: c.verdict, sections: readSections(c.sections) }}
    />
  );
}
