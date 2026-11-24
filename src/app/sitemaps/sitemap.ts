import type { MetadataRoute } from "next";
import { db } from "@/server/db";
import { absoluteUrl } from "@/server/seo/metadata";
import { HOME_SLUG, listPublishedPageSlugs } from "@/server/services/cms";
import { getSettings } from "@/server/settings";
import { geoPagePath } from "@/server/services/geo";
import { taxonomyDefs } from "@/lib/taxonomies";

export const dynamic = "force-dynamic";

const PER_SITEMAP = 10_000;

const indexable = { OR: [{ seoId: null }, { seo: { noIndex: false } }] };

/** Sitemap index: id 0 = static/taxonomy/pages/blog, 1..n = software chunks. */
export async function generateSitemaps() {
  const count = await db.software.count({ where: { status: "PUBLISHED", ...indexable } });
  return [{ id: 0 }, ...Array.from({ length: Math.max(1, Math.ceil(count / PER_SITEMAP)) }, (_, i) => ({ id: i + 1 }))];
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  if (Number(id) > 0) {
    const rows = await db.software.findMany({
      where: { status: "PUBLISHED", ...indexable },
      orderBy: { id: "asc" },
      skip: (Number(id) - 1) * PER_SITEMAP,
      take: PER_SITEMAP,
      select: { slug: true, updatedAt: true, logo: { select: { url: true } } },
    });
    // Product logos go in as image-sitemap entries so they can appear in image search.
    return rows.map((r) => ({ url: absoluteUrl(`/software/${r.slug}`), lastModified: r.updatedAt, changeFrequency: "weekly", priority: 0.8, ...(r.logo ? { images: [absoluteUrl(r.logo.url)] } : {}) }));
  }
  const settings = await getSettings();
  // Lists switched off in Website settings › Classification lists have no pages.
  const lists = taxonomyDefs(settings.taxonomies).filter((t) => t.enabled);
  const listPath = new Map(lists.map((t) => [t.kind as string, t.path]));
  const [categories, industries, vendors, brands, pages, posts, comparisons, terms, geoPages, authors, resellers] = await Promise.all([
    db.category.findMany({ where: { isActive: true, ...indexable }, select: { slug: true, updatedAt: true } }),
    db.industry.findMany({ where: { isActive: true, ...indexable }, select: { slug: true, updatedAt: true } }),
    db.vendor.findMany({ where: { isActive: true, software: { some: { status: "PUBLISHED" } }, ...indexable }, select: { slug: true, updatedAt: true } }),
    db.brand.findMany({ where: { isActive: true, software: { some: { status: "PUBLISHED" } }, ...indexable }, select: { slug: true, updatedAt: true } }),
    listPublishedPageSlugs(),
    db.post.findMany({ where: { status: "PUBLISHED", ...indexable }, select: { slug: true, updatedAt: true } }),
    db.comparisonPage.findMany({ where: { status: "PUBLISHED", ...indexable }, select: { slug: true, updatedAt: true } }),
    db.taxonomyTerm.findMany({ where: { isActive: true, noIndex: false, software: { some: { software: { status: "PUBLISHED" } } } }, select: { kind: true, slug: true, updatedAt: true } }),
    settings.geo.enabled
      ? db.geoPage.findMany({
          where: { isPublished: true, noIndex: false, location: { isPublished: true }, OR: [{ software: { status: "PUBLISHED" } }, { vendor: { isActive: true } }] },
          select: { updatedAt: true, location: { select: { slug: true } }, software: { select: { slug: true } }, vendor: { select: { slug: true } } },
        })
      : Promise.resolve([]),
    db.author.findMany({ where: { posts: { some: { status: "PUBLISHED" } } }, select: { slug: true } }),
    db.vendor.findMany({ where: { kind: "RESELLER", isActive: true, authorisedProducts: { some: { software: { status: "PUBLISHED" } } }, ...indexable }, select: { slug: true, updatedAt: true } }),
  ]);
  return [
    { url: absoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/categories"), changeFrequency: "weekly", priority: 0.7 },
    { url: absoluteUrl("/industries"), changeFrequency: "weekly", priority: 0.5 },
    { url: absoluteUrl("/vendors"), changeFrequency: "weekly", priority: 0.5 },
    { url: absoluteUrl("/list-your-software"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/become-a-reseller"), changeFrequency: "monthly", priority: 0.4 },
    { url: absoluteUrl("/brands"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/blog"), changeFrequency: "daily", priority: 0.6 },
    ...categories.map((c) => ({ url: absoluteUrl(`/categories/${c.slug}`), lastModified: c.updatedAt, changeFrequency: "daily" as const, priority: 0.9 })),
    ...industries.map((c) => ({ url: absoluteUrl(`/industries/${c.slug}`), lastModified: c.updatedAt, priority: 0.6 })),
    ...vendors.map((c) => ({ url: absoluteUrl(`/vendors/${c.slug}`), lastModified: c.updatedAt, priority: 0.5 })),
    ...resellers.map((c) => ({ url: absoluteUrl(`/resellers/${c.slug}`), lastModified: c.updatedAt, priority: 0.4 })),
    ...brands.map((c) => ({ url: absoluteUrl(`/brands/${c.slug}`), lastModified: c.updatedAt, priority: 0.6 })),
    ...pages.filter((p) => p.slug !== HOME_SLUG).map((p) => ({ url: absoluteUrl(`/${p.slug}`), lastModified: p.updatedAt, priority: 0.4 })),
    ...posts.map((p) => ({ url: absoluteUrl(`/blog/${p.slug}`), lastModified: p.updatedAt, priority: 0.6 })),
    ...authors.map((a) => ({ url: absoluteUrl(`/blog/author/${a.slug}`), priority: 0.3 })),
    ...comparisons.map((p) => ({ url: absoluteUrl(`/compare/${p.slug}`), lastModified: p.updatedAt, priority: 0.6 })),
    ...lists.map((t) => ({ url: absoluteUrl(`/${t.path}`), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...terms.filter((t) => listPath.has(t.kind)).map((t) => ({ url: absoluteUrl(`/${listPath.get(t.kind)}/${t.slug}`), lastModified: t.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...geoPages.flatMap((g) => {
      const path = geoPagePath(settings.geo.productRouteBase, g.location.slug, g);
      return path ? [{ url: absoluteUrl(path), lastModified: g.updatedAt, priority: 0.5 }] : [];
    }),
  ];
}
