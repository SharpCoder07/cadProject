import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BadgeCheck, Globe, MapPin } from "lucide-react";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { runListing } from "@/server/services/catalog";
import { searchParamsSchema } from "@/server/services/search";
import { buildMetadata, listingIndexing } from "@/server/seo/metadata";
import { collectionPageLd, vendorLd } from "@/server/seo/jsonld";
import { JsonLd } from "@/components/site/json-ld";

import { normaliseParams, type RawParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ListingResults } from "@/components/site/listing";
import { makeT } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { pageLayout, layoutForEdit } from "@/lib/layouts";
import { EditRegion, PageEditActions } from "@/components/site/edit-mode";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };
const load = (slug: string) => db.vendor.findFirst({ where: { slug, isActive: true, kind: "VENDOR" }, include: { logo: true, seo: { include: { ogImage: true } } } });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const v = await load((await params).slug);
  if (!v) return {};
  const idx = listingIndexing(`/vendors/${v.slug}`, await searchParams);
  const live = await db.software.count({ where: { vendorId: v.id, status: "PUBLISHED" } });
  const t = await getT();
  return buildMetadata({ path: idx.path, noIndex: idx.noIndex || live === 0, title: `${t("vendor.seoTitle", { name: v.name })}${idx.page > 1 ? ` — Page ${idx.page}` : ""}`, description: v.description?.slice(0, 160), seo: v.seo });
}

export default async function VendorPage({ params, searchParams }: Props) {
  const vendor = await load((await params).slug);
  if (!vendor) notFound();
  const raw = await searchParams;
  const sp = searchParamsSchema.parse(normaliseParams(raw));
  const [settings, listing] = await Promise.all([getSettings(), runListing(sp, { vendorId: vendor.id }, "popular")]);
  const t = makeT(settings.texts);
  const basePath = `/vendors/${vendor.slug}`;
  const pl = pageLayout("vendor", settings.layouts.vendor);
  return (
    <div className="container py-8">
      <PageEditActions actions={[{ label: "Edit vendor", href: `/admin/vendors/${vendor.id}`, primary: true }]} layout={layoutForEdit("vendor", settings.layouts.vendor)} />
      <JsonLd data={[vendorLd(vendor), collectionPageLd({ name: `${vendor.name} products`, path: basePath, description: vendor.description, items: listing.items.map((x) => ({ name: x.name, path: `/software/${x.slug}` })), offset: (listing.page - 1) * listing.perPage })]} />
      <Breadcrumbs items={[{ name: t("vendors.heading"), path: "/vendors" }, { name: vendor.name, path: basePath }]} />
      <EditRegion label="Vendor header" live={{ kind: "vendor", id: vendor.id, section: "header", title: "Vendor details" }} actions={[{ label: "Open in admin", href: `/admin/vendors/${vendor.id}` }, { label: "Show / hide / order", href: "/admin/cms/layouts?page=vendor" }]}>
      <header className="mt-4 flex flex-col gap-5 rounded-panel border border-line bg-surface p-6 sm:flex-row sm:items-center">
        {pl.show("logo") && vendor.logo && <Image src={vendor.logo.url} alt={`${vendor.name} logo`} width={88} height={88} className="h-20 w-20 rounded-control border border-line object-contain p-2" />}
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            {vendor.name}
            {pl.show("verified") && vendor.verification === "VERIFIED" && <BadgeCheck className="h-6 w-6 text-primary" aria-label={settings.labels.verifiedLabel} />}
          </h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {pl.show("location") && (vendor.city || vendor.country) && (
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {[vendor.city, vendor.country].filter(Boolean).join(", ")}</span>
            )}
            {pl.show("founded") && vendor.foundedYear && <span>{t("vendor.founded", { year: vendor.foundedYear })}</span>}
            {pl.show("employees") && vendor.employeeRange && <span>{t("product.employees", { range: vendor.employeeRange })}</span>}
            {pl.show("website") && vendor.website && (
              <a href={vendor.website} target="_blank" rel="noopener nofollow" className="flex items-center gap-1 text-primary hover:underline">
                <Globe className="h-4 w-4" aria-hidden /> {t("brand.website")}
              </a>
            )}
          </p>
        </div>
      </header>
      </EditRegion>
      <EditRegion label="Description" live={{ kind: "vendor", id: vendor.id, section: "description", title: "Vendor description" }} actions={[{ label: "Open in admin", href: `/admin/vendors/${vendor.id}` }]}>
        {pl.show("description") && vendor.description && <p className="mt-6 max-w-3xl whitespace-pre-line text-muted">{vendor.description}</p>}
      </EditRegion>
      {pl.show("productsTitle") ? <h2 className="mb-4 mt-10 text-2xl font-semibold">{t("vendor.productsTitle", { name: vendor.name })}</h2> : <div className="mt-8" />}
      <EditRegion label="Products" actions={[{ label: "Products", href: "/admin/software" }, { label: "Listing settings", href: "/admin/settings?tab=listing" }]}>
        <ListingResults listing={listing} params={sp} settings={settings} basePath={basePath} rawParams={raw} clearHref={basePath} />
      </EditRegion>
    </div>
  );
}
