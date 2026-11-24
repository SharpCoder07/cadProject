import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe } from "lucide-react";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { runListing } from "@/server/services/catalog";
import { searchParamsSchema } from "@/server/services/search";
import { buildMetadata, listingIndexing } from "@/server/seo/metadata";
import { collectionPageLd } from "@/server/seo/jsonld";
import { JsonLd } from "@/components/site/json-ld";

import { normaliseParams, type RawParams } from "@/lib/search-params";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ListingResults } from "@/components/site/listing";
import { EnquireButton } from "@/components/site/lead-dialog";
import { makeT } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { pageLayout, layoutForEdit } from "@/lib/layouts";
import { EditRegion, PageEditActions } from "@/components/site/edit-mode";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };
const load = (slug: string) => db.brand.findFirst({ where: { slug, isActive: true }, include: { logo: true, seo: { include: { ogImage: true } }, vendor: { select: { name: true, slug: true, isActive: true } } } });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const b = await load((await params).slug);
  if (!b) return {};
  const idx = listingIndexing(`/brands/${b.slug}`, await searchParams);
  // A brand with no live products is thin content: keep it out of search results.
  const live = await db.software.count({ where: { brandId: b.id, status: "PUBLISHED" } });
  const t = await getT();
  return buildMetadata({ path: idx.path, noIndex: idx.noIndex || live === 0, title: `${t("brand.seoTitle", { name: b.name })}${idx.page > 1 ? ` — Page ${idx.page}` : ""}`, description: b.description?.slice(0, 160) ?? t("brand.seoDescription", { name: b.name }), seo: idx.page > 1 ? null : b.seo });
}

/** A brand's page: logo, about, and its published products as a filterable listing. */
export default async function BrandPage({ params, searchParams }: Props) {
  const brand = await load((await params).slug);
  if (!brand) notFound();
  const raw = await searchParams;
  const sp = searchParamsSchema.parse(normaliseParams(raw));
  const [settings, listing, orbit, rated] = await Promise.all([
    getSettings(),
    runListing(sp, { brandId: brand.id }, "popular"),
    db.software.findMany({ where: { brandId: brand.id, status: "PUBLISHED" }, orderBy: { popularityScore: "desc" }, take: 6, select: { name: true, slug: true, logo: { select: { url: true } } } }),
    db.software.findMany({ where: { brandId: brand.id, status: "PUBLISHED", ratingCount: { gt: 0 } }, select: { ratingAvg: true, ratingCount: true } }),
  ]);
  // Reviews across the brand's live products, and the review-weighted average rating.
  const reviews = rated.reduce((n, r) => n + r.ratingCount, 0);
  const stats = { reviews, rating: reviews ? rated.reduce((n, r) => n + Number(r.ratingAvg) * r.ratingCount, 0) / reviews : 0 };
  const t = makeT(settings.texts);
  const basePath = `/brands/${brand.slug}`;
  const pl = pageLayout("brand", settings.layouts.brand);
  return (
    <>
      <PageEditActions actions={[{ label: "Edit brand", href: "/admin/brands", primary: true }, { label: "Brand page texts", href: "/admin/cms/texts?group=brand" }]} layout={layoutForEdit("brand", settings.layouts.brand)} />
      <JsonLd data={collectionPageLd({ name: `${brand.name} software`, path: basePath, description: brand.description, items: listing.items.map((x) => ({ name: x.name, path: `/software/${x.slug}` })), offset: (listing.page - 1) * listing.perPage })} />
      <EditRegion label="Brand header" live={{ kind: "brands", id: "all", section: "all", title: "Brands" }} actions={[{ label: "Open in admin", href: "/admin/brands" }, { label: "Show / hide / order", href: "/admin/cms/layouts?page=brand" }, { label: "Wording", href: "/admin/cms/texts?group=brand" }]}>
      {/* Brand header, design concept 06 "Orbit spotlight": the brand's products orbit its logo (hover pauses), ripples pulse, stats count up. */}
      <div className="cg-brandhero relative overflow-hidden border-b border-line bg-[linear-gradient(115deg,rgb(var(--color-primary)/0.07),rgb(var(--color-bg))_45%,rgb(var(--color-primary)/0.13))]">
        <div className="container py-8 sm:py-10">
          <Breadcrumbs items={[{ name: t("brands.heading"), path: "/brands" }, { name: brand.name, path: basePath }]} />
          <div className="mt-6 grid items-center gap-8 lg:grid-cols-[440px_minmax(0,1fr)] lg:gap-14">
            <div data-play className="cg-orbit relative mx-auto h-[var(--s)] w-[var(--s)] shrink-0 [--s:300px] sm:[--s:400px] lg:[--s:440px]">
              <span aria-hidden className="absolute inset-[11%] rounded-full border-[1.5px] border-dashed border-primary/35" />
              <span aria-hidden className="absolute inset-[27%] rounded-full bg-[radial-gradient(circle,rgb(var(--color-primary)/0.16),rgb(var(--color-primary)/0)_70%)]" />
              <span aria-hidden className="cg-ripple absolute left-1/2 top-1/2 h-[32%] w-[32%] [translate:-50%_-50%] rounded-full border-2 border-primary/40" />
              <span aria-hidden className="cg-ripple cg-ripple-2 absolute left-1/2 top-1/2 h-[32%] w-[32%] [translate:-50%_-50%] rounded-full border-2 border-primary/40" />
              <div className="cg-orbit-core absolute left-1/2 top-1/2 z-10 flex h-[31%] w-[31%] [translate:-50%_-50%] flex-col items-center justify-center gap-2 rounded-[28px] border border-line bg-surface p-3 shadow-[0_30px_60px_-30px_rgb(var(--color-primary)/0.6)]">
                {pl.show("logo") && brand.logo ? (
                  <Image src={brand.logo.url} alt={`${brand.name} logo`} width={120} height={60} className="max-h-[46%] w-auto max-w-[80%] object-contain" />
                ) : (
                  <span className="grid aspect-square w-[42%] place-items-center rounded-2xl bg-primary font-display text-xl font-extrabold text-primary-fg sm:text-2xl" aria-hidden>{brand.name.slice(0, 2).toUpperCase()}</span>
                )}
                <span className="line-clamp-2 max-w-full text-center max-sm:hidden text-[12px] font-extrabold leading-tight text-ink sm:text-[13.5px]">{brand.name}</span>
              </div>
              {orbit.length > 0 && (
                <ul className="cg-orbit-ring absolute inset-0" aria-label={t("brand.productsTitle", { name: brand.name })}>
                  {orbit.map((p, i) => {
                    const a = Math.round((360 / orbit.length) * i - 90);
                    return (
                      <li key={p.slug} className="cg-sat absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${a}deg) translate(calc(var(--s) * 0.39)) rotate(${-a}deg)`, ["--i" as string]: i }}>
                        <Link href={`/software/${p.slug}`} className="cg-sat-pill absolute left-0 top-0 inline-flex max-w-[128px] [translate:-50%_-50%] items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-3.5 text-[12px] font-bold text-ink shadow-[0_14px_28px_-18px_rgb(var(--color-primary)/0.65)] transition hover:border-primary hover:text-primary sm:max-w-[170px] sm:text-[13px]">
                          {p.logo ? (
                            <Image src={p.logo.url} alt="" width={22} height={22} className="h-[22px] w-[22px] shrink-0 rounded-full object-contain" />
                          ) : (
                            <span aria-hidden className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-primary-soft text-[10px] font-extrabold text-primary">{p.name.slice(0, 1)}</span>
                          )}
                          <span className="truncate">{p.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t("brand.eyebrow")}</p>
              <h1 className="mt-2 text-[1.8rem] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[2.4rem]">{t("brand.heading", { name: brand.name })}</h1>
              {(pl.show("company") && brand.vendor?.isActive) || (pl.show("website") && brand.website) ? (
                <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                  {pl.show("company") && brand.vendor?.isActive && (
                    <span>
                      {t("product.by")} <Link href={`/vendors/${brand.vendor.slug}`} className="font-semibold text-ink hover:text-primary">{brand.vendor.name}</Link>
                    </span>
                  )}
                  {pl.show("website") && brand.website && (
                    <a href={brand.website} target="_blank" rel="noopener nofollow" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                      <Globe className="h-4 w-4" aria-hidden /> {t("brand.website")}
                    </a>
                  )}
                </p>
              ) : null}
              {pl.show("description") && brand.description && <p className="mt-4 max-w-2xl whitespace-pre-line text-[15px] leading-relaxed text-muted">{brand.description}</p>}
              {pl.show("count") && (
                <dl className="mt-6 grid max-w-xl grid-cols-3 gap-3">
                  {[
                    { label: t("brand.statProducts"), value: String(listing.total) },
                    { label: t("brand.statReviews"), value: String(stats.reviews) },
                    { label: t("brand.statRating"), value: stats.rating ? stats.rating.toFixed(1) : "–" },
                  ].map((st) => (
                    <div key={st.label} className="flex flex-col-reverse gap-0.5 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-[0_10px_24px_-22px_rgb(var(--color-ink)/0.5)]">
                      <dt className="text-[12px] text-muted">{st.label}</dt>
                      <dd data-countup className="font-display text-[1.6rem] font-extrabold leading-none text-ink">{st.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {pl.show("enquire") && <EnquireButton type="QUOTE" source="GET_ADVICE" title={t("brand.formTitle", { name: brand.name })} className="mt-6 inline-flex h-11 items-center rounded-control bg-accent px-5 text-sm font-bold text-accent-fg hover:brightness-95">
                {settings.labels.enquireCta}
              </EnquireButton>}
            </div>
          </div>
        </div>
      </div>
      </EditRegion>
      <EditRegion label="Products" actions={[{ label: "Products", href: "/admin/software" }, { label: "Listing settings", href: "/admin/settings?tab=listing" }, { label: "Wording", href: "/admin/cms/texts?group=brand" }]}>
      <div className="container py-10">
        {pl.show("productsTitle") && (
          <>
            <h2 className="text-[1.5rem] font-bold text-ink sm:text-[1.85rem]">{t("brand.productsTitle", { name: brand.name })}</h2>
            <span aria-hidden className="mb-6 mt-2.5 block h-1 w-12 rounded-full bg-accent" />
          </>
        )}
        <ListingResults listing={listing} params={sp} settings={settings} basePath={basePath} rawParams={raw} clearHref={basePath} />
      </div>
      </EditRegion>
    </>
  );
}
