import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { filterAttributes, runListing } from "@/server/services/catalog";
import { searchParamsSchema } from "@/server/services/search";
import { buildMetadata, listingIndexing } from "@/server/seo/metadata";
import { collectionPageLd } from "@/server/seo/jsonld";
import { JsonLd } from "@/components/site/json-ld";

import { normaliseParams, type RawParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ListingFilters, ListingLayout, ListingResults, activeFilterCount } from "@/components/site/listing";
import { makeT } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };
const load = (slug: string) => db.industry.findFirst({ where: { slug, isActive: true }, include: { seo: { include: { ogImage: true } }, image: true } });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const ind = await load((await params).slug);
  if (!ind) return {};
  const idx = listingIndexing(`/industries/${ind.slug}`, await searchParams);
  const t = await getT();
  return buildMetadata({ path: idx.path, title: `${t("industry.heading", { name: ind.name })}${idx.page > 1 ? ` — Page ${idx.page}` : ""}`, description: ind.description ?? t("industry.seoDescription", { name: ind.name.toLowerCase() }), image: ind.image?.url, seo: idx.page > 1 ? null : ind.seo, noIndex: idx.noIndex });
}

export default async function IndustryPage({ params, searchParams }: Props) {
  const industry = await load((await params).slug);
  if (!industry) notFound();
  const raw = await searchParams;
  const sp = searchParamsSchema.parse(normaliseParams(raw));
  const [settings, listing, attributes] = await Promise.all([getSettings(), runListing(sp, { industryId: industry.id }), filterAttributes()]);
  const t = makeT(settings.texts);
  const basePath = `/industries/${industry.slug}`;
  return (
    <EditRegion label="Industry page" live={{ kind: "industries", id: "all", section: "all", title: "Industries" }} actions={[{ label: "Open in admin", href: "/admin/industries" }, { label: "Products", href: "/admin/software" }, { label: "Wording", href: "/admin/cms/texts?group=industry" }]}>
    <div className="container py-8">
      <JsonLd data={collectionPageLd({ name: t("industry.heading", { name: industry.name }), path: basePath, description: industry.description, items: listing.items.map((x) => ({ name: x.name, path: `/software/${x.slug}` })), offset: (listing.page - 1) * listing.perPage })} />
      <Breadcrumbs items={[{ name: t("industries.breadcrumb"), path: "/industries" }, { name: industry.name, path: basePath }]} />
      <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{t("industry.heading", { name: industry.name })}</h1>
      {industry.description && <p className="mt-2 max-w-3xl text-muted">{industry.description}</p>}
      <div className="mt-8">
        <ListingLayout
          filterCount={activeFilterCount(sp)}
          filters={<ListingFilters params={sp} listing={listing} settings={settings} attributes={attributes} action={basePath} />}
          results={<ListingResults listing={listing} params={sp} settings={settings} basePath={basePath} rawParams={raw} clearHref={basePath} />}
        />
      </div>
      {industry.content && <div className="prose-content mt-16" dangerouslySetInnerHTML={{ __html: industry.content }} />}
    </div>
    </EditRegion>
  );
}
