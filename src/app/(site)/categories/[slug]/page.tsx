import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, ChevronDown, Headset, Minus, Plus, Star } from "lucide-react";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { cardsByIds, categoryInsights, categoryPriceRows, runListing, type SoftwareCard } from "@/server/services/catalog";
import { categoryTrail, getCategoryTree } from "@/server/services/categories";
import { getBanners } from "@/server/services/navigation";
import { listPublishedPosts } from "@/server/services/blog";
import { searchParamsSchema } from "@/server/services/search";
import { buildMetadata, listingIndexing } from "@/server/seo/metadata";
import { faqLd, collectionPageLd } from "@/server/seo/jsonld";
import { categoryLayout } from "@/lib/validation/taxonomy";
import { normaliseParams, type RawParams } from "@/lib/search-params";
import { formatDate, formatPrice, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { activeFilterCount } from "@/components/site/listing";
import { SoftwareLogo } from "@/components/site/software-card";
import { CompareCheckbox } from "@/components/site/compare-controls";
import { EnquireButton } from "@/components/site/lead-dialog";
import { JsonLd } from "@/components/site/json-ld";
import { Stars } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { ArticleSlider, CategoryTabs, FilterChip, FilterToggle, FlipList, ListFilterForm, SortPills } from "@/components/site/category-client";
import { ListSearch } from "@/components/site/list-search";
import { makeT, type T } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { Fragment } from "react";
import { pageLayout, layoutForEdit } from "@/lib/layouts";
import { pricingLabel, pricingOptions as pricingChoices } from "@/lib/enum-labels";
import { EditRegion, PageEditActions } from "@/components/site/edit-mode";
import { categoryRegion } from "@/lib/edit-regions";

/**
 * Category page, laid out like cadgram.com/category/…: gradient hero with a featured product,
 * section tabs, popular products, product directory with filters and a sidebar, guidance banner,
 * buyer guide, price comparison table, article slider, FAQs and related categories.
 */

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<RawParams> };

const loadCategory = (slug: string) =>
  db.category.findFirst({
    where: { slug, isActive: true },
    include: {
      seo: { include: { ogImage: true } },
      banner: true,
      image: true,
      children: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true } },
      featured: { orderBy: { sortOrder: "asc" }, select: { softwareId: true } },
    },
  });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const c = await loadCategory(slug);
  if (!c) return {};
  // Page 2+ keeps its own canonical; filtered/sorted variants are noindex.
  const idx = listingIndexing(`/categories/${c.slug}`, sp);
  const t = await getT();
  return buildMetadata({
    path: idx.path,
    title: `${t("category.seoTitle", { name: /software/i.test(c.name) ? c.name : `${c.name} Software`, year: new Date().getFullYear() })}${idx.page > 1 ? ` — Page ${idx.page}` : ""}`,
    description: c.description ?? t("category.seoDescription", { name: c.name }),
    image: c.image?.url,
    seo: idx.page > 1 ? (c.seo ? { ...c.seo, canonicalUrl: null } : null) : c.seo,
    noIndex: idx.noIndex,
  });
}

// ─── Small building blocks (same look as the homepage blocks; colours come from the theme) ───

const CARD = "rounded-panel border border-line bg-surface";
/** Main call to action — the homepage's accent button. */
const BUTTON = "inline-flex items-center justify-center rounded-control bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition hover:brightness-95";
/** Secondary action — the homepage's outlined primary button. */
const OUTLINE = "inline-flex items-center justify-center rounded-control border border-primary px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-primary-fg";

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-xs font-bold uppercase tracking-[0.1em] text-primary", className)}>{children}</p>;
}

function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <>
      <h2 id={id} className="mt-1 text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.85rem]">
        {children}
      </h2>
      <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
    </>
  );
}

const nameWithSoftware = (name: string) => (/software$/i.test(name.trim()) ? name.trim() : `${name.trim()} Software`);

function priceText(sw: { startingPrice: unknown; currency: string; priceUnit: string | null; pricingModel: string }, t: T) {
  const n = toNumber(sw.startingPrice as never);
  if (n && n > 0) return `${formatPrice(n, sw.currency)}${sw.priceUnit ? ` ${sw.priceUnit}` : ""}`;
  if (sw.pricingModel === "FREE") return t("product.free");
  return t("product.priceOnRequest");
}

function RatingLine({ sw, label, t }: { sw: Pick<SoftwareCard, "ratingAvg" | "ratingCount">; label?: string; t: T }) {
  const r = toNumber(sw.ratingAvg) ?? 0;
  if (!sw.ratingCount) {
    return (
      <span className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <Stars value={0} /> {t("category.notRated")}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted">
      <span className="inline-flex items-center gap-0.5 rounded bg-success px-1.5 py-0.5 text-xs font-bold text-white">
        {r.toFixed(1)} <Star className="h-3 w-3" fill="currentColor" strokeWidth={0} aria-hidden />
      </span>
      <Stars value={r} /> {label ?? `(${sw.ratingCount})`}
    </span>
  );
}

const BILLING_KEYS = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME", "CUSTOM"];

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const raw = await searchParams;
  const category = await loadCategory(slug);
  if (!category) notFound();

  const layout = categoryLayout.parse(category.layout ?? {});
  const sp = searchParamsSchema.parse(normaliseParams(raw));
  const settings = await getSettings();
  const t = makeT(settings.texts);
  const basePath = `/categories/${category.slug}`;
  const label = nameWithSoftware(category.name);
  const lower = label.toLowerCase();

  const [listing, trail, insights, featuredCards, banners, priceRows, tree] = await Promise.all([
    runListing(sp, { categoryId: category.id }, layout.defaultSort),
    categoryTrail(category),
    categoryInsights(category.id, category.parentId),
    cardsByIds(category.featured.map((f) => f.softwareId)),
    getBanners(layout.bannerPlacement || `category.${category.slug}`),
    categoryPriceRows(category.id),
    getCategoryTree(),
  ]);
  const posts = insights.top.length ? await listPublishedPosts({ softwareIds: insights.top.map((p) => p.id), perPage: 8 }) : null;

  const featured = featuredCards[0] ?? insights.top[0] ?? null;
  const popular = insights.top.filter((p) => p.id !== featured?.id).slice(0, 4);
  const totalInCategory = insights.total;

  // Sidebar + related: subcategories when there are any, otherwise sibling categories.
  const flat = tree.flatMap((c) => [c, ...c.children]);
  const node = flat.find((c) => c.id === category.id);
  const parentNode = category.parentId ? flat.find((c) => c.id === category.parentId) : null;
  const sideCategories = (node?.children.length ? node.children : (parentNode?.children ?? tree).filter((c) => c.id !== category.id))
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, count: c.softwareCount + c.children.reduce((n, x) => n + x.softwareCount, 0) }))
    .slice(0, 14);

  // Filters (cadgram.com style dropdowns): classification terms that have products here.
  const termOptions = (kind: string) => insights.terms.filter((t) => t.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
  const filterSelects = [
    { label: t("category.filterPlatform"), kind: "PLATFORM" },
    { label: t("category.filterDeployment"), kind: "DEPLOYMENT_MODEL" },
    { label: t("category.filterLicence"), kind: "LICENSING_MODEL" },
  ]
    .map((f) => ({ ...f, options: termOptions(f.kind) }))
    .filter((f) => f.options.length > 0);
  const selectedTerm = (kind: string) => termOptions(kind).find((t) => sp.term.includes(t.id))?.id ?? "";
  const pricingOptions = pricingChoices(t).filter(([k]) => (listing.facets.pricing[k] ?? 0) > 0 || sp.pricing.includes(k as never));
  const filterCount = activeFilterCount(sp);

  // Live sort shuffle (design concept 03): sort pills, applied-filter chips and price bars.
  const currentSort = typeof raw.sort === "string" ? raw.sort : "";
  const sortPills = [
    { value: "", label: t("category.sortRecommended") },
    { value: "price_asc", label: t("category.sortPriceAsc") },
    { value: "rating", label: t("category.sortRating") },
    { value: "newest", label: t("category.sortNewest") },
  ];
  for (const [value, key] of [["price_desc", "category.sortPriceDesc"], ["name", "category.sortName"]] as const) {
    if (currentSort === value) sortPills.push({ value, label: t(key) });
  }
  const without = (key: string, value?: string) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(raw)) {
      if (k === "page") continue;
      for (const x of ([] as string[]).concat(v ?? [])) if (!(k === key && (value === undefined || x === value))) u.append(k, x);
    }
    return `${basePath}${u.size ? `?${u.toString()}` : ""}`;
  };
  const chips = [
    ...(sp.q ? [{ key: "q", label: `“${sp.q}”`, href: without("q") }] : []),
    ...sp.term.map((id) => ({ key: `t-${id}`, label: insights.terms.find((x) => x.id === id)?.name ?? id, href: without("term", id) })),
    ...sp.pricing.map((k) => ({ key: `p-${k}`, label: pricingChoices(t).find(([x]) => x === k)?.[1] ?? k, href: without("pricing", k) })),
    ...(sp.trial === "1" ? [{ key: "trial", label: t("category.trialFilter"), href: without("trial") }] : []),
  ];
  const maxPrice = Math.max(0, ...listing.items.map((sw) => toNumber(sw.startingPrice) ?? 0));

  // Price comparison intro, from live data.
  const published = priceRows.map((r) => toNumber(r.startingPrice)).filter((n): n is number => n !== null && n > 0);
  const quoteOnly = priceRows.filter((r) => !(toNumber(r.startingPrice) ?? 0) && r.pricingModel !== "FREE").length;
  const currency = priceRows.find((r) => (toNumber(r.startingPrice) ?? 0) > 0)?.currency ?? "INR";
  const tableRows = priceRows
    .flatMap((p) =>
      p.plans.length
        ? p.plans.map((pl) => ({
            key: pl.id,
            name: p.name,
            plan: p.plans.length > 1 ? pl.name : null,
            slug: p.slug,
            price: toNumber(pl.price) ? `${formatPrice(toNumber(pl.price), pl.currency)}${pl.priceUnit ? ` ${pl.priceUnit}` : ""}` : toNumber(pl.price) === 0 ? t("product.free") : t("product.priceOnRequest"),
            billing: toNumber(pl.price) === null ? t("product.priceOnRequest") : (BILLING_KEYS.includes(pl.billingPeriod) ? t(`category.billing${pl.billingPeriod}`) : "—"),
            bestFor: pl.description || p.bestFor,
          }))
        : [{ key: p.id, name: p.name, plan: null, slug: p.slug, price: priceText(p, t), billing: pricingLabel(t, p.pricingModel) || "—", bestFor: p.bestFor }],
    )
    .slice(0, 120);

  // FAQs generated from live listing data (always accurate as the catalogue changes).
  const top = insights.top;
  const cheapest = top.filter((p) => (toNumber(p.startingPrice) ?? 0) > 0).sort((a, b) => toNumber(a.startingPrice)! - toNumber(b.startingPrice)!)[0];
  const trials = top.filter((p) => p.hasFreeTrial);
  const faqs = [
    top.length > 0 && {
      question: t("category.faq1Q", { name: lower }),
      answer: t("category.faq1A", { products: top.slice(0, 5).map((p) => p.name).join(", ") }),
    },
    cheapest && {
      question: t("category.faq2Q", { name: lower }),
      answer: `${t("category.faq2A", { product: cheapest.name, price: priceText(cheapest, t) })} ${quoteOnly ? t(quoteOnly === 1 ? "category.quoteOne" : "category.quoteMany", { count: quoteOnly }) : ""}`.trim(),
    },
    {
      question: t("category.faq3Q", { name: lower }),
      answer: trials.length
        ? t(trials.length === 1 ? "category.faq3AOne" : "category.faq3A", { products: trials.slice(0, 4).map((p) => p.name).join(", ") })
        : t("category.faq3ANone", { button: settings.labels.demoCta }),
    },
    {
      question: t("category.faq4Q", { name: lower }),
      answer: t("category.faq4A", { name: lower }),
    },
  ].filter(Boolean) as { question: string; answer: string }[];

  const pl = pageLayout("category", settings.layouts.category);
  const tabs = [
    { id: "products", section: "directory", label: t("category.tabProducts") },
    ...(category.content ? [{ id: "guidance", section: "guidance", label: t("category.tabGuide") }] : []),
    ...(tableRows.length ? [{ id: "comparison", section: "comparison", label: t("category.tabPrices") }] : []),
    ...(posts?.items.length ? [{ id: "articles", section: "articles", label: t("category.tabArticles") }] : []),
    { id: "faqs", section: "faqs", label: t("category.tabFaqs") },
  ]
    .filter((x) => pl.show(x.section))
    .sort((a, b) => pl.rank(a.section) - pl.rank(b.section))
    .map(({ id, label }) => ({ id, label }));

  const ad = banners[0];

  // Sections in the order set in Pages › Page layouts.
  const sideBlocks = {
    helpBox: (
      <>
            <section className="rounded-panel border border-line border-t-4 border-t-accent bg-surface p-5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><Headset className="h-5 w-5" aria-hidden /></span>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.08em] text-primary">{t("category.fitEyebrow")}</p>
              <h2 className="mt-1 font-display text-base font-bold">{t("category.fitTitle")}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{t("category.fitText")}</p>
              <EnquireButton type="QUOTE" source="CATEGORY_PAGE" title={t("category.helpTitle", { name: lower })} className={cn(BUTTON, "mt-4 w-full")}>
                {settings.labels.enquireCta}
              </EnquireButton>
            </section>
      </>
    ),
    sideCategories: (
      <>
            {sideCategories.length > 0 && (
              <section className="rounded-panel border border-line bg-surface p-5">
                <h2 className="font-display text-base font-bold">{t("category.sideCategories")}</h2>
                <ul className="mt-3">
                  {sideCategories.map((c) => (
                    <li key={c.id} className="border-b border-line last:border-b-0">
                      <Link href={`/categories/${c.slug}`} className="flex items-center justify-between gap-2 py-2.5 text-[13px] text-ink hover:text-primary">
                        <span>{c.name}</span>
                        <span className="rounded-full bg-bg px-2 py-0.5 text-xs text-muted">{c.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
      </>
    ),
  };  const blocks: Record<string, React.ReactNode> = {
    popular: (
      <>
            {popular.length > 0 && (
              <section className={cn(CARD, "p-5")} aria-labelledby="popular-heading">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <Eyebrow>{t("category.popularEyebrow")}</Eyebrow>
                    <h2 id="popular-heading" className="mt-1 text-[1.3rem] font-bold sm:text-[1.5rem]">{t("category.popularTitle", { name: label })}</h2>
                  </div>
                  <a href="#products" className="inline-flex h-9 items-center gap-1 rounded-control border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-fg">View complete list ↓</a>
                </div>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {popular.map((sw) => (
                    <li key={sw.id} className="card-lift relative flex gap-3 rounded-panel border border-line bg-surface p-3 transition hover:border-primary/50 hover:shadow-[0_12px_32px_-18px_rgb(var(--color-ink)/0.35)]">
                      <SoftwareLogo logo={sw.logo} name={sw.name} size={64} />
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-[15px] font-bold">{sw.name}</h3>
                        <div className="mt-1"><RatingLine t={t} sw={sw} /></div>
                        <Link href={`/software/${sw.slug}`} className="mt-2 inline-block text-[13px] font-semibold text-primary after:absolute after:inset-0">
                          View profile →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
      </>
    ),
    directory: (
      <>
            <div className="grid gap-5 lg:grid-cols-[1fr_17rem]">
              {/* Product directory */}
              <section id="products" className="min-w-0 scroll-mt-48" aria-labelledby="directory-heading">
                <div className={cn(CARD, "overflow-hidden")}>
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-5">
                    <div>
                      <Eyebrow>{t("category.directoryEyebrow")}</Eyebrow>
                      <SectionHeading id="directory-heading">
                        {listing.total} {listing.total === 1 ? "product" : "products"} for {label}
                      </SectionHeading>
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                      <ListSearch placeholder={t("category.searchIn", { name: label })} basePath={basePath} params={raw} scopeLabel={label} anchor="products" className="w-full sm:w-64" />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-line px-5 py-3">
                    <SortPills value={currentSort} options={sortPills} label={t("category.sortBy")} />
                    {chips.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {chips.map((c, i) => <FilterChip key={c.key} href={c.href} label={c.label} index={i} removeLabel={t("category.removeFilter", { name: c.label })} />)}
                        {chips.length > 1 && <Link href={basePath} scroll={false} className="text-[12.5px] font-semibold text-muted hover:text-ink">{t("category.clear")}</Link>}
                      </div>
                    )}
                    <FilterToggle count={filterCount} buttonClassName="ml-auto">
                      <ListFilterForm key={without("")} action={basePath} className="mt-1 grid gap-3 rounded-panel border border-line bg-bg p-4 sm:grid-cols-2 lg:grid-cols-3">
                        {sp.q && <input type="hidden" name="q" value={sp.q} />}
                        {filterSelects.map((f) => (
                          <label key={f.kind} className="grid gap-1 text-xs font-bold text-ink">
                            {f.label}
                            <span className="relative">
                              <select name="term" defaultValue={selectedTerm(f.kind)} className="h-10 w-full appearance-none rounded-control border border-line bg-surface pl-3 pr-8 text-sm font-normal">
                                <option value="">{t("category.filterAll", { name: f.label.toLowerCase() })}</option>
                                {f.options.map((o) => (
                                  <option key={o.id} value={o.id}>{o.name}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-muted" aria-hidden />
                            </span>
                          </label>
                        ))}
                        {pricingOptions.length > 0 && (
                          <label className="grid gap-1 text-xs font-bold text-ink">
                            {t("product.pricingModel")}
                            <span className="relative">
                              <select name="pricing" defaultValue={sp.pricing[0] ?? ""} className="h-10 w-full appearance-none rounded-control border border-line bg-surface pl-3 pr-8 text-sm font-normal">
                                <option value="">{t("category.allPricing")}</option>
                                {pricingOptions.map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-muted" aria-hidden />
                            </span>
                          </label>
                        )}
                        <label className="grid gap-1 text-xs font-bold text-ink">
                          {t("category.sortBy")}
                          <span className="relative">
                            <select name="sort" defaultValue={sp.sort ?? ""} className="h-10 w-full appearance-none rounded-control border border-line bg-surface pl-3 pr-8 text-sm font-normal">
                              <option value="">{t("category.sortRecommended")}</option>
                              <option value="name">{t("category.sortName")}</option>
                              <option value="rating">{t("category.sortRating")}</option>
                              <option value="price_asc">{t("category.sortPriceAsc")}</option>
                              <option value="price_desc">{t("category.sortPriceDesc")}</option>
                              <option value="newest">{t("category.sortNewest")}</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-muted" aria-hidden />
                          </span>
                        </label>
                        <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 lg:col-span-3">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input type="checkbox" name="trial" value="1" defaultChecked={sp.trial === "1"} className="h-4 w-4 rounded border-line text-primary" />
                            {t("category.trialFilter")}
                          </label>
                          <span className="flex items-center gap-3">
                            {filterCount > 0 && <Link href={basePath} className="text-sm font-semibold text-muted hover:text-ink">{t("category.clear")}</Link>}
                            <button type="submit" className={BUTTON}>{t("category.apply")}</button>
                          </span>
                        </div>
                      </ListFilterForm>
                    </FilterToggle>
                  </div>

                  {listing.items.length === 0 ? (
                    <div className="px-5 py-14 text-center">
                      <p className="font-bold">{sp.q ? t("category.noMatchSearch", { query: sp.q }) : t("category.noMatch")}</p>
                      <Link href={basePath} className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">{t("category.clearAll")}</Link>
                    </div>
                  ) : (
                    <FlipList>
                      {listing.items.map((sw, i) => (
                        <li key={sw.id} data-flip-key={sw.id} className="bg-surface">
                          <article className="grid grid-cols-[5rem_1fr] gap-x-4 gap-y-3 border-b border-line px-5 pb-6 pt-5 last:border-b-0 sm:grid-cols-[5rem_1fr_auto]">
                            <div className="row-span-2 flex flex-col items-start justify-between gap-3 sm:row-span-1">
                              <SoftwareLogo logo={sw.logo} name={sw.name} size={80} />
                              {settings.listing.showCompareCheckbox && (
                                <span className="text-xs">
                                  <CompareCheckbox item={{ slug: sw.slug, name: sw.name, logoUrl: sw.logo?.url ?? null }} label={settings.labels.compareCta} />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-display text-lg font-bold leading-snug">
                                <Link href={`/software/${sw.slug}`} className="hover:text-primary">{sw.name}</Link>
                              </h3>
                              <p className="mt-0.5 text-[11.5px] text-muted">
                                {sw.vendor ? `${t("product.by")} ${sw.vendor.name}${sw.vendor.verification === "VERIFIED" ? ` · ${t("product.trust1Verified")}` : ""}` : t("category.noVendor")}
                              </p>
                              {sw.ratingCount > 0 && <div className="mt-1.5"><RatingLine t={t} sw={sw} /></div>}
                              {(sw.shortDescription || sw.tagline) && <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink/75">{sw.shortDescription ?? sw.tagline}</p>}
                              <Link href={`/software/${sw.slug}`} className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-primary hover:underline">
                                {t("category.viewDetails")}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                              </Link>
                            </div>
                            <div className="col-start-2 flex items-center justify-between gap-4 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:justify-between">
                              <p className="leading-tight sm:text-right">
                                <span className="block text-[11px] font-medium text-muted">{t("product.startingFrom")}</span>
                                <span className="font-display text-[15px] font-bold text-ink">{priceText(sw, t)}</span>
                                {maxPrice > 0 && (toNumber(sw.startingPrice) ?? 0) > 0 && (
                                  <span aria-hidden className="cg-pbar mt-1.5 block h-1.5 w-28 overflow-hidden rounded-full bg-line/70 sm:ml-auto">
                                    <span className="block h-full rounded-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${Math.max(8, Math.round(((toNumber(sw.startingPrice) ?? 0) / maxPrice) * 100))}%` }} />
                                  </span>
                                )}
                              </p>
                              <span className="flex flex-col gap-2">
                                <Link href={`/software/${sw.slug}`} className={BUTTON}>{t("category.viewProduct")}</Link>
                                <EnquireButton type="DEMO" softwareSlugs={[sw.slug]} productName={sw.name} source="CATEGORY_PAGE" title={settings.labels.demoCta} className={OUTLINE}>
                                  {settings.labels.demoCta}
                                </EnquireButton>
                              </span>
                            </div>
                          </article>
                          {i === 1 && ad && (
                            <div className="border-b border-line px-3 py-3">
                              <div className="grid overflow-hidden rounded-panel border border-line bg-surface shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
                                <div className="relative min-h-[11rem] bg-primary">
                                  {ad.image && <Image src={ad.image.url} alt={ad.image.alt ?? ""} fill className="object-cover" sizes="(min-width: 1024px) 380px, 100vw" />}
                                </div>
                                <div className="relative p-6">
                                  <p className="absolute right-4 top-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">{t("category.ad")}</p>
                                  <p className="mt-3 font-display text-[1.35rem] font-bold leading-snug">{ad.title}</p>
                                  {ad.subtitle && <p className="mt-2 text-sm text-muted">{ad.subtitle}</p>}
                                  {ad.ctaUrl && (
                                    <Link href={ad.ctaUrl} className={cn(BUTTON, "mt-4")}>
                                      {ad.ctaLabel || t("category.adCta")}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </FlipList>
                  )}
                </div>
                <div className="mt-5">
                  <Pagination boxed page={listing.page} pages={listing.pages} basePath={basePath} params={raw} anchor="products" />
                </div>
              </section>

              {/* Sidebar */}
              <aside className="space-y-4 lg:sticky lg:top-[11.5rem] lg:self-start">
                {pl.order("sidebar").map((id) => <EditRegion key={id} {...categoryRegion(id, { id: category.id })}>{id === "helpBox" ? sideBlocks.helpBox : sideBlocks.sideCategories}</EditRegion>)}
              </aside>
            </div>
      </>
    ),
    banner: (
      <>
            <section className="relative grid gap-8 overflow-hidden rounded-panel bg-primary p-8 text-primary-fg sm:p-12 lg:grid-cols-[1fr_auto] lg:items-center">
              <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[40px] border-white/10" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-80">{t("category.bannerEyebrow")}</p>
                <h2 className="mt-2 max-w-2xl text-[1.8rem] font-bold leading-[1.15] text-primary-fg sm:text-[2.3rem]">{t("category.bannerTitle")}</h2>
                <p className="mt-3 max-w-xl text-[15px] opacity-85">{t("category.bannerText")}</p>
                <EnquireButton type="QUOTE" source="CATEGORY_PAGE" title={t("category.helpTitle", { name: lower })} className={cn(BUTTON, "mt-5 h-11")}>
                  {settings.labels.enquireCta}
                </EnquireButton>
              </div>
              <dl className="relative grid grid-cols-3 overflow-hidden rounded-panel border border-white/25 bg-white/10 text-center">
                {[
                  [totalInCategory, t("category.statProducts")],
                  [posts?.total ?? 0, t("category.statGuides")],
                  [faqs.length, t("category.statFaqs")],
                ].map(([n, l], i) => (
                  <div key={String(l)} className={cn("flex min-w-[6.5rem] flex-col-reverse px-4 py-5", i > 0 && "border-l border-white/25")}>
                    <dt className="mt-1 text-xs opacity-80">{l}</dt>
                    <dd className="font-display text-3xl font-extrabold">{n}</dd>
                  </div>
                ))}
              </dl>
            </section>
      </>
    ),
    guidance: (
      <>
            {category.content && (
              <section id="guidance" className={cn(CARD, "scroll-mt-48 p-6 sm:p-8")} aria-labelledby="guide-heading">
                <Eyebrow>{t("category.guideEyebrow")}</Eyebrow>
                <div className={cn("mt-6 grid gap-8", category.image && "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center")}>
                  {category.image && (
                    <div className="relative aspect-[3/2] overflow-hidden rounded-panel bg-line">
                      <Image src={category.image.url} alt={category.image.alt ?? ""} fill className="object-cover" sizes="(min-width: 1024px) 480px, 100vw" />
                    </div>
                  )}
                  <div>
                    <h2 id="guide-heading" className="text-[1.5rem] font-bold leading-tight sm:text-[1.85rem]">{t("category.guideTitle", { name: label })}</h2>
                    <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
                    <div className="prose-content mt-4 text-[15px] text-muted" dangerouslySetInnerHTML={{ __html: category.content }} />
                  </div>
                </div>
              </section>
            )}
      </>
    ),
    cta: (
      <>
            <section className="flex flex-col gap-4 rounded-panel border border-primary/20 bg-primary-soft p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
              <div>
                <h2 className="font-display text-[1.4rem] font-bold">{t("category.ctaTitle", { name: lower })}</h2>
                <p className="mt-1 text-sm text-muted">{t("category.ctaText")}</p>
              </div>
              <EnquireButton type="QUOTE" source="CATEGORY_PAGE" title={t("category.helpTitle", { name: lower })} className={BUTTON}>
                {settings.labels.enquireCta}
              </EnquireButton>
            </section>
      </>
    ),
    comparison: (
      <>
            {tableRows.length > 0 && (
              <section id="comparison" className={cn(CARD, "scroll-mt-48 p-6 sm:p-8")} aria-labelledby="price-heading">
                <SectionHeading id="price-heading">{t("category.priceTitle", { name: label })}</SectionHeading>
                <p className="mt-4 text-sm leading-relaxed text-ink/80">
                  {t("category.priceIntro", { count: priceRows.length, name: label, examples: priceRows.slice(0, 3).map((p) => p.name).join(", ") })}
                  {published.length > 0 && <> {published.length > 1 ? t("category.priceRange", { name: label, min: formatPrice(Math.min(...published), currency), max: formatPrice(Math.max(...published), currency) }) : t("category.priceFrom", { name: label, min: formatPrice(Math.min(...published), currency) })}</>}
                  {quoteOnly > 0 && <> {t(quoteOnly === 1 ? "category.quoteOne" : "category.quoteMany", { count: quoteOnly })}</>}
                </p>
                <div className="mt-6 overflow-x-auto rounded-panel border border-line">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead className="bg-primary text-left text-[13px] uppercase tracking-[0.04em] text-primary-fg">
                      <tr>
                        <th scope="col" className="p-4 font-bold">{t("category.colProduct")}</th>
                        <th scope="col" className="p-4 font-bold">{t("category.colPrice")}</th>
                        <th scope="col" className="p-4 font-bold">{t("category.colBilling")}</th>
                        <th scope="col" className="p-4 font-bold">{t("category.colBestFor")}</th>
                        <th scope="col" className="p-4 font-bold">{t("category.colAction")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((r) => (
                        <tr key={r.key} className="border-t border-line align-top even:bg-bg/60">
                          <td className="p-4 font-semibold">
                            <Link href={`/software/${r.slug}`} className="text-primary hover:underline">{r.name}</Link>
                            {r.plan && <span className="block text-xs font-medium text-muted">{r.plan}</span>}
                          </td>
                          <td className="w-32 p-4">{r.price}</td>
                          <td className="w-32 p-4">{r.billing}</td>
                          <td className="p-4 text-ink/80">{r.bestFor ?? "—"}</td>
                          <td className="w-36 p-4">
                            <Link href={`/software/${r.slug}#pricing`} className={cn(OUTLINE, "whitespace-nowrap px-3 py-1.5 text-[13px]")}>{t("category.tableLink")}</Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted">{settings.theme.footerNote}</p>
              </section>
            )}
      </>
    ),
    articles: (
      <>
            {posts && posts.items.length > 0 && (
              <section id="articles" className={cn(CARD, "scroll-mt-48 p-6 sm:p-8")} aria-labelledby="articles-heading">
                <Eyebrow>{t("category.articlesEyebrow")}</Eyebrow>
                <SectionHeading id="articles-heading">{t("category.articlesTitle", { name: label })}</SectionHeading>
                <div className="mt-6">
                  <ArticleSlider>
                    {posts.items.map((p) => (
                      <article key={p.id} className="relative flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-panel border border-line bg-surface card-lift sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)]">
                        <div className="relative aspect-[1200/630] bg-[linear-gradient(135deg,rgb(var(--color-primary))_0%,rgb(var(--color-primary)/0.65)_100%)]">
                          {p.cover ? (
                            <Image src={p.cover.url} alt={p.cover.alt ?? ""} fill className="object-cover" sizes="(min-width: 1024px) 33vw, 85vw" />
                          ) : (
                            <span className="absolute inset-0 grid place-items-center text-2xl font-extrabold text-primary-fg/80" aria-hidden>
                              {settings.site.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <h3 className="font-display text-[15px] font-bold leading-snug">
                            <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0 hover:text-primary">{p.title}</Link>
                          </h3>
                          {p.excerpt && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{p.excerpt}</p>}
                          <p className="mt-auto pt-5 text-xs text-muted">{formatDate(p.publishedAt)}</p>
                        </div>
                      </article>
                    ))}
                  </ArticleSlider>
                </div>
              </section>
            )}
      </>
    ),
    faqs: (
      <>
            <section id="faqs" className={cn(CARD, "scroll-mt-48 p-6 sm:p-8")} aria-labelledby="faq-heading">
              <Eyebrow>{t("category.faqEyebrow")}</Eyebrow>
              <SectionHeading id="faq-heading">{t("category.faqTitle", { name: label })}</SectionHeading>
              <div className="mt-6 space-y-3">
                {faqs.map((f) => (
                  <details key={f.question} className="group rounded-panel border border-line bg-surface open:border-primary/30 open:shadow-[0_8px_24px_-16px_rgb(var(--color-ink)/0.35)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
                      {f.question}
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary" aria-hidden>
                        <Plus className="h-4 w-4 group-open:hidden" />
                        <Minus className="hidden h-4 w-4 group-open:block" />
                      </span>
                    </summary>
                    <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
      </>
    ),
    related: (
      <>
            {sideCategories.length > 0 && (
              <section className={cn(CARD, "p-6 sm:p-8")} aria-labelledby="related-heading">
                <Eyebrow>{t("category.relatedEyebrow")}</Eyebrow>
                <SectionHeading id="related-heading">{t("category.relatedTitle", { name: label })}</SectionHeading>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {sideCategories.map((c) => (
                    <li key={c.id}>
                      <Link href={`/categories/${c.slug}`} className="inline-flex h-9 items-center rounded-full border border-line bg-bg px-4 text-sm font-medium text-ink hover:border-primary hover:text-primary">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
      </>
    ),
  };


  return (
    <div>
      <PageEditActions actions={[{ label: "Edit category", href: `/admin/categories/${category.id}`, primary: true }, { label: "Category page texts", href: "/admin/cms/texts?group=category" }]} layout={layoutForEdit("category", settings.layouts.category)} />
      {pl.show("faqs") && <JsonLd data={faqLd(faqs)} />}
      <JsonLd data={collectionPageLd({ name: `${category.name} software`, path: basePath, description: category.description, items: listing.items.map((x) => ({ name: x.name, path: `/software/${x.slug}` })), offset: (listing.page - 1) * listing.perPage })} />

      {/* Hero */}
      <EditRegion {...categoryRegion("hero", { id: category.id })}>
      <section className="relative overflow-hidden border-b border-line bg-[linear-gradient(180deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-surface))_100%)]">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="container relative grid gap-10 py-10 lg:grid-cols-[1fr_24rem] lg:items-center lg:py-14">
          <div>
            <Breadcrumbs items={[{ name: t("category.breadcrumbRoot"), path: "/categories" }, ...trail.slice(0, -1).map((t) => ({ name: t.name, path: `/categories/${t.slug}` })), { name: t("category.heading", { name: label }), path: basePath }]} />
            <Eyebrow className="mt-5">{t("category.eyebrow")}</Eyebrow>
            <h1 className="mt-2 max-w-[850px] text-[clamp(1.9rem,4.4vw,3.2rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">{t("category.heading", { name: label })}</h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              {category.description || t("category.descriptionFallback")}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {[t("category.chip1", { count: totalInCategory }), t("category.chip2"), t("category.chip3")].filter(Boolean).map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-medium text-ink">
                  <Check className="h-4 w-4 text-success" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>

          {featured && (
            <aside className="relative rounded-panel border border-line border-t-4 border-t-primary bg-surface px-6 pb-6 pt-14 text-ink shadow-[0_20px_48px_-28px_rgb(var(--color-ink)/0.45)]">
              <span className="absolute -left-2 top-5 rounded-l-sm bg-accent py-1.5 pl-3.5 pr-5 text-[11px] font-bold uppercase tracking-[0.06em] text-accent-fg shadow-sm [clip-path:polygon(0_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,0_100%)]">
                {t("category.featured")}
              </span>
              <div className="flex items-center gap-4">
                <SoftwareLogo logo={featured.logo} name={featured.name} size={72} />
                <div className="min-w-0">
                  <h2 className="truncate font-display text-[1.3rem] font-bold">
                    <Link href={`/software/${featured.slug}`} className="hover:text-primary">{featured.name}</Link>
                  </h2>
                  {featured.vendor && <p className="truncate text-xs text-muted">{t("product.by")} {featured.vendor.name}</p>}
                  <div className="mt-1.5"><RatingLine t={t} sw={featured} /></div>
                </div>
              </div>
              {(featured.shortDescription || featured.tagline) && <p className="mt-5 line-clamp-3 text-sm leading-relaxed text-muted">{featured.shortDescription ?? featured.tagline}</p>}
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-dashed border-line pt-4">
                <p className="leading-tight">
                  <span className="block text-[11px] font-medium text-muted">{t("product.startingFrom")}</span>
                  <span className="font-display font-bold text-ink">{priceText(featured, t)}</span>
                </p>
                {featured.hasFreeTrial && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                    <Check className="h-3.5 w-3.5" aria-hidden /> Free trial
                  </span>
                )}
              </div>
              <Link href={`/software/${featured.slug}`} className={cn(BUTTON, "mt-4 w-full")}>{t("category.viewProduct")}</Link>
            </aside>
          )}
        </div>
      </section>
      </EditRegion>

      <div className="container py-8">
        <CategoryTabs items={tabs} />

        <div className="space-y-8">
          {pl.order("main").map((id) => <EditRegion key={id} {...categoryRegion(id, { id: category.id })}>{blocks[id]}</EditRegion>)}
        </div>
      </div>
    </div>
  );
}
