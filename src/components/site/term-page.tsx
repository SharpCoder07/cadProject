import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BadgeCheck, BookOpen, CircleHelp, LayoutList, ShieldCheck, Sparkles, Tags } from "lucide-react";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { absoluteUrl, buildMetadata } from "@/server/seo/metadata";
import { faqLd } from "@/server/seo/jsonld";
import { listPublishedPosts } from "@/server/services/blog";
import { getPublicTerm, parseFaqs, termIndex, termProducts } from "@/server/services/taxonomies";
import { fillName, taxonomyDef, termHeadline, type TaxonomyKind } from "@/lib/taxonomies";
import { formatDate, formatPrice, toNumber } from "@/lib/format";
import { Badge, Stars } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { Breadcrumbs } from "./breadcrumbs";
import { JsonLd } from "./json-ld";
import { EnquireButton } from "./lead-dialog";
import { SoftwareLogo, SoftwareRow } from "./software-card";
import { makeT } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { pricingLabel } from "@/lib/enum-labels";
import { EditRegion } from "@/components/site/edit-mode";

const PER_PAGE = 10;

type TermProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

function Section({ id, title, children, action }: { id?: string; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-48">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[1.45rem] font-bold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Term page (/use-case/2d-drafting) ───────────────────────────────────────

export async function termMetadata(kind: TaxonomyKind, { params, searchParams }: TermProps): Promise<Metadata> {
  const { slug } = await params;
  const term = await getPublicTerm(kind, slug);
  if (!term) return {};
  const def = taxonomyDef(kind, (await getSettings()).taxonomies);
  if (!def.enabled) return {};
  const page = Number((await searchParams).page) || 1;
  const count = (await termIndex(kind)).find((t) => t.id === term.id)?.count ?? 0;
  const headline = termHeadline(kind, term, def);
  return buildMetadata({
    path: `/${def.path}/${term.slug}${page > 1 ? `?page=${page}` : ""}`,
    title: term.seoTitle || `${headline}${page > 1 ? ` — page ${page}` : ""}`,
    description: term.seoDescription || term.description || fillName(def.metaDescription, { name: term.name, count }),
    // Terms with no live products are thin content.
    noIndex: term.noIndex || count === 0,
  });
}

export async function TermPage({ kind, params, searchParams }: TermProps & { kind: TaxonomyKind }) {
  const { slug } = await params;
  const term = await getPublicTerm(kind, slug);
  if (!term) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const [settings, products, siblings] = await Promise.all([getSettings(), termProducts(term.id, page, PER_PAGE), termIndex(kind)]);
  // Wording and on/off: Website settings › Classification lists.
  const def = taxonomyDef(kind, settings.taxonomies);
  if (!def.enabled) notFound();
  const basePath = `/${def.path}/${term.slug}`;
  if (page > products.pages && products.total > 0) notFound();
  const promotedOk =
    term.promotedSoftware && term.promotedSoftware.status === "PUBLISHED"
      ? Boolean(await db.softwareTerm.findFirst({ where: { softwareId: term.promotedSoftware.id, OR: [{ termId: term.id }, { term: { parentId: term.id } }] }, select: { termId: true } }))
      : false;
  const [posts, crossTerms] = await Promise.all([
    products.productIds.length ? listPublishedPosts({ softwareIds: products.productIds, perPage: 3 }) : Promise.resolve(null),
    // Chip river, second row: topics from the other lists that these products also have (platforms, deployment, use cases…).
    products.productIds.length
      ? db.taxonomyTerm.findMany({
          where: { kind: { not: kind }, isActive: true, software: { some: { softwareId: { in: products.productIds } } } },
          select: { id: true, name: true, slug: true, kind: true, _count: { select: { software: { where: { softwareId: { in: products.productIds } } } } } },
          take: 40,
        })
      : Promise.resolve([]),
  ]);
  const faqs = parseFaqs(term.faqs);
  const headline = termHeadline(kind, term, def);
  const { labels } = settings;
  const t = makeT(settings.texts);
  const listingOpts = { showVendorName: settings.listing.showVendorName, showStartingPrice: settings.listing.showStartingPrice, showRating: settings.listing.showRating, showCompareCheckbox: settings.listing.showCompareCheckbox };

  // Price comparison summary
  const withPrice = products.priced.filter((p) => (toNumber(p.startingPrice) ?? 0) > 0);
  const prices = withPrice.map((p) => toNumber(p.startingPrice)!);
  const quoteOnly = products.priced.length - withPrice.length;
  // Budget pages: price ladder (design concept 15). Up to 8 products from cheapest to dearest, and the budget's
  // upper limit read from the range name ("Under ₹10,000", "₹10,000 – ₹50,000") as a dashed line.
  const ladder = (() => {
    if (kind !== "BUDGET_RANGE" || withPrice.length < 2) return null;
    const sorted = [...withPrice].sort((a, b) => toNumber(a.startingPrice)! - toNumber(b.startingPrice)!);
    const pick = sorted.length <= 8 ? sorted : Array.from({ length: 8 }, (_, i) => sorted[Math.round((i * (sorted.length - 1)) / 7)]!);
    const nums = (term.name.match(/\d[\d,]*(?:\.\d+)?\s*(?:k|K|L|lakh)?/g) ?? []).map((n) => {
      const v = parseFloat(n.replace(/,/g, ""));
      return /k/i.test(n) ? v * 1000 : /L|lakh/.test(n) ? v * 100000 : v;
    });
    const limit = nums.length ? Math.max(...nums) : null;
    const top = Math.max(toNumber(pick.at(-1)!.startingPrice)!, limit ?? 0) * 1.12;
    // Square-root scale, so a ₹25 plan still shows next to a ₹9,999 one.
    const h = (v: number) => Math.max(6, (Math.sqrt(v) / Math.sqrt(top)) * 100);
    return { h, bars: pick.map((p) => ({ id: p.id, name: p.name, slug: p.slug, price: toNumber(p.startingPrice)!, currency: p.currency, unit: p.priceUnit })), limit, top };
  })();

  const related = siblings.filter((t) => t.id !== term.id && t.count > 0).sort((a, b) => b.count - a.count);
  const riverOwn = related.slice(0, 14).map((r) => ({ key: r.id, name: r.name, href: `/${def.path}/${r.slug}`, other: false }));
  const riverOther = crossTerms
    .map((c) => ({ c, d: taxonomyDef(c.kind, settings.taxonomies) }))
    .filter(({ d }) => d.enabled)
    .sort((a, b) => b.c._count.software - a.c._count.software)
    .slice(0, 14)
    .map(({ c, d }) => ({ key: c.id, name: c.name, href: `/${d.path}/${c.slug}`, other: true }));
  const children = siblings.filter((t) => t.parentId === term.id);
  const anchors = [
    { href: "#products", label: t("term.tabProducts") },
    ...(products.priced.length ? [{ href: "#prices", label: t("term.tabPrices") }] : []),
    ...(posts?.items.length ? [{ href: "#articles", label: t("term.tabArticles") }] : []),
    ...(faqs.length ? [{ href: "#faqs", label: "FAQs" }] : []),
  ];

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqLd(faqs)} />}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: headline,
          numberOfItems: products.total,
          itemListElement: products.items.map((p, i) => ({ "@type": "ListItem", position: (page - 1) * PER_PAGE + i + 1, url: absoluteUrl(`/software/${p.slug}`), name: p.name })),
        }}
      />

      {/* Hero */}
      <EditRegion label={`${def.singular} header`} actions={[{ label: `Edit ${def.plural.toLowerCase()}`, href: `/admin/taxonomies/${def.key}` }, { label: "Headline & wording", href: "/admin/settings?tab=taxonomies" }]}>
      <div className="relative overflow-hidden border-b border-line bg-surface">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-[90px]" />
        <div className="container relative py-7 sm:py-10">
          <Breadcrumbs items={[{ name: def.plural, path: `/${def.path}` }, ...(term.parent ? [{ name: term.parent.name, path: `/${def.path}/${term.parent.slug}` }] : []), { name: headline, path: basePath }]} />
          <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">{def.singular}</p>
              <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-[-0.02em] sm:text-[2.6rem]">{headline}</h1>
              <p className="mt-3 max-w-2xl text-lg text-muted">
                {term.description || t("term.descriptionFallback", { name: term.name.toLowerCase() })}
              </p>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink">
                <li className="inline-flex items-center gap-1.5"><LayoutList className="h-4 w-4 text-primary" aria-hidden /><strong data-countup className="text-primary">{products.total}</strong> products listed</li>
                <li className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden />{t("term.point1")}</li>
                <li className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-primary" aria-hidden />{t("term.point2")}</li>
              </ul>
              {anchors.length > 1 && (
                <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2">
                  {anchors.map((a) => <a key={a.href} href={a.href} className="rounded-full border border-line bg-bg px-3.5 py-1.5 text-sm font-medium text-ink hover:border-primary hover:text-primary">{a.label}</a>)}
                </nav>
              )}
            </div>
            {promotedOk && term.promotedSoftware ? (
              <aside className="relative rounded-panel border border-primary/25 bg-surface p-5 shadow-[0_20px_48px_-28px_rgb(var(--color-ink)/0.45)]">
                <span className="absolute -top-3 left-5 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-fg"><Sparkles className="h-3 w-3" aria-hidden />{term.promotedBadge || t("term.promotedBadge")}</span>
                <div className="flex items-center gap-3">
                  <SoftwareLogo logo={term.promotedSoftware.logo} name={term.promotedSoftware.name} size={56} />
                  <div className="min-w-0">
                    <Link href={`/software/${term.promotedSoftware.slug}`} className="block truncate text-lg font-semibold hover:text-primary">{term.promotedSoftware.name}</Link>
                    {term.promotedSoftware.vendor && <p className="truncate text-xs text-muted">by {term.promotedSoftware.vendor.name}</p>}
                  </div>
                </div>
                {term.promotedSoftware.tagline && <p className="mt-3 line-clamp-3 text-sm text-muted">{term.promotedSoftware.tagline}</p>}
                <p className="mt-3 text-sm">
                  {(toNumber(term.promotedSoftware.startingPrice) ?? 0) > 0 ? <>{t("product.startingFrom")} <strong>{formatPrice(toNumber(term.promotedSoftware.startingPrice)!, term.promotedSoftware.currency)}</strong></> : <span className="text-muted">{t("product.priceOnRequest")}</span>}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Link href={`/software/${term.promotedSoftware.slug}`} className="inline-flex h-10 items-center justify-center rounded-full border border-line text-sm font-semibold hover:border-ink/30">{t("term.viewProfile")}</Link>
                  <EnquireButton type="QUOTE" softwareSlugs={[term.promotedSoftware.slug]} productName={term.promotedSoftware.name} source="CATEGORY_PAGE" className="h-10 rounded-full bg-accent text-sm font-semibold text-accent-fg hover:brightness-95">{labels.enquireCta}</EnquireButton>
                </div>
              </aside>
            ) : (
              <aside className="hidden rounded-panel border border-line bg-bg p-5 lg:block">
                <p className="font-semibold">{t("term.adviceTitle")}</p>
                <p className="mt-1 text-sm text-muted">{t("term.adviceText", { name: term.name.toLowerCase() })}</p>
                <EnquireButton source="GET_ADVICE" title={t("term.adviceFormTitle", { name: headline })} className="mt-4 h-10 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg hover:brightness-95">{t("term.adviceCta")}</EnquireButton>
              </aside>
            )}
          </div>
        </div>
        {/* Chip river (design concept 14): related topics in two rows moving opposite ways; pauses on hover. Without motion the chips simply wrap. */}
        {riverOwn.length + riverOther.length > 0 && (
          <div className="relative border-t border-line/70 pb-6 pt-5">
            <p className="container mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{t("term.riverTitle")}</p>
            {[riverOwn, riverOther].filter((row) => row.length > 0).map((row, ri) => (
              <div key={ri} className={`cg-marquee cg-river ${ri ? "mt-2.5" : ""}`} data-reverse={ri ? "1" : undefined}>
                <ul className="container flex flex-wrap gap-2.5">
                  {row.map((c) => (
                    <li key={c.key}>
                      <Link href={c.href} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-[13.5px] font-bold text-ink transition hover:border-primary hover:text-primary">
                        <span aria-hidden className={`h-2 w-2 rounded-full ${c.other ? "bg-accent" : "bg-primary"}`} />
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
      </EditRegion>

      <EditRegion label="Products, content & FAQs" actions={[{ label: `Edit ${def.plural.toLowerCase()}`, href: `/admin/taxonomies/${def.key}` }, { label: "Products", href: "/admin/software" }, { label: "Wording", href: "/admin/cms/texts?group=listing" }]}>
      <div className="container grid gap-10 py-10 lg:grid-cols-[1fr_17rem]">
        <div className="min-w-0 space-y-14">
          {/* Popular choices */}
          {page === 1 && products.popular.length >= 2 && (
            <Section title={t("term.popularTitle")}>
              <ul data-play className="cg-springs grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {products.popular.map((p, pi) => {
                  const rating = toNumber(p.ratingAvg) ?? 0;
                  return (
                    <li key={p.id} className="cg-spring card-lift relative flex flex-col rounded-panel border border-line bg-surface p-4" style={{ ["--i" as string]: pi }}>
                      <span className="cg-spring-icon inline-block self-start"><SoftwareLogo logo={p.logo} name={p.name} size={44} /></span>
                      <Link href={`/software/${p.slug}`} className="mt-3 font-semibold leading-snug after:absolute after:inset-0 hover:text-primary">{p.name}</Link>
                      <span className="mt-1 inline-flex items-center gap-1.5 text-sm">
                        {p.ratingCount > 0 ? <><Stars value={rating} /><span className="font-semibold">{rating.toFixed(1)}</span></> : <span className="text-xs text-muted">{t("term.notRated")}</span>}
                      </span>
                      <span className="mt-auto pt-3 text-sm font-medium text-primary">{t("term.viewProfile")} <ArrowRight className="inline h-3.5 w-3.5" aria-hidden /></span>
                    </li>
                  );
                })}
              </ul>
            </Section>
          )}

          {/* Product directory */}
          <Section id="products" title={t(products.total === 1 ? "term.productsTitleOne" : "term.productsTitle", { count: products.total, name: term.name })}>
            {products.items.length === 0 ? (
              <div className="rounded-panel border border-dashed border-line p-8 text-center text-muted">{t("term.emptyBefore")} <EnquireButton source="GET_ADVICE" title={t("term.adviceFormTitle", { name: headline })} className="font-semibold text-primary hover:underline">{t("term.emptyLink")}</EnquireButton> {t("term.emptyAfter")}</div>
            ) : (
              <div className="space-y-3">
                {products.items.map((sw) => <SoftwareRow key={sw.id} sw={sw} labels={labels} opts={listingOpts} />)}
              </div>
            )}
            <div className="mt-6"><Pagination page={products.page} pages={products.pages} basePath={basePath} params={{}} /></div>
          </Section>

          {/* Guidance */}
          <section className="flex flex-col items-start gap-4 rounded-panel bg-band p-6 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">{t("term.fitTitle")}</h2>
              <p className="mt-1 text-sm text-surface/75">{t("term.fitText")}</p>
            </div>
            <EnquireButton source="GET_ADVICE" title={t("term.adviceFormTitle", { name: headline })} className="h-11 shrink-0 rounded-full bg-accent px-6 text-sm font-semibold text-accent-fg hover:brightness-95">{t("term.adviceCta")}</EnquireButton>
          </section>

          {/* Price comparison */}
          {products.priced.length > 0 && (
            <Section id="prices" title={t("term.priceTitle", { name: term.name })}>
              <p className="mb-4 max-w-3xl text-muted">
                {prices.length
                  ? t(prices.length === 1 ? "term.priceRangeOne" : "term.priceRange", { min: formatPrice(Math.min(...prices)), max: formatPrice(Math.max(...prices)), count: prices.length })
                  : t("term.noPrices")}
                {quoteOnly > 0 && ` ${t(quoteOnly === 1 ? "term.quoteOne" : "term.quoteMany", { count: quoteOnly })}`}
              </p>
              {ladder && (
                <div data-play data-no-motion className="cg-ladder mb-5 rounded-panel border border-line bg-surface p-5">
                  <div className="relative grid h-56 items-end gap-3 border-b-2 border-line px-1" style={{ gridTemplateColumns: `repeat(${ladder.bars.length}, minmax(0, 1fr))` }}>
                    {ladder.limit && (
                      <span aria-hidden className="cg-ladder-line absolute inset-x-0 border-t-2 border-dashed border-accent" style={{ bottom: `${ladder.h(ladder.limit)}%` }}>
                        <span className="absolute -top-7 right-0 rounded-full bg-accent/20 px-2.5 py-0.5 text-[12px] font-extrabold text-ink">{t("term.budgetLine", { price: formatPrice(ladder.limit) })}</span>
                      </span>
                    )}
                    {ladder.bars.map((b, i) => (
                      <Link key={b.id} href={`/software/${b.slug}`} title={`${b.name}: ${formatPrice(b.price, b.currency)}${b.unit ? ` ${b.unit}` : ""}`} className={`cg-ladder-col group flex h-full flex-col items-center justify-end ${ladder.limit && b.price > ladder.limit ? "is-over" : ""}`} style={{ ["--i" as string]: i }}>
                        <span className="mb-1 text-[11px] font-extrabold text-ink opacity-0 transition group-hover:opacity-100">{formatPrice(b.price, b.currency)}</span>
                        <span className="cg-ladder-bar block w-full max-w-[56px] rounded-t-[10px] rounded-b-[4px] bg-[linear-gradient(180deg,rgb(var(--color-primary)/0.75),rgb(var(--color-primary)))] transition group-hover:brightness-110" style={{ height: `${ladder.h(b.price)}%` }} />
                      </Link>
                    ))}
                  </div>
                  <div className="mt-2 grid gap-3 px-1" style={{ gridTemplateColumns: `repeat(${ladder.bars.length}, minmax(0, 1fr))` }}>
                    {ladder.bars.map((b) => (
                      <span key={b.id} className="min-w-0 text-center">
                        <span className="block truncate text-[12px] font-bold text-ink">{formatPrice(b.price, b.currency)}</span>
                        <span className="block truncate text-[11px] text-muted">{b.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="overflow-x-auto rounded-panel border border-line">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-bg text-xs uppercase tracking-[0.05em] text-muted">
                    <tr><th className="px-4 py-3">{t("term.colProduct")}</th><th className="px-4 py-3">{t("term.colPrice")}</th><th className="px-4 py-3">{t("term.colPricing")}</th><th className="px-4 py-3">{t("term.colBestFor")}</th><th className="px-4 py-3" /></tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {products.priced.slice(0, 20).map((p) => {
                      const price = toNumber(p.startingPrice);
                      return (
                        <tr key={p.id}>
                          <td className="px-4 py-3 font-medium"><Link href={`/software/${p.slug}`} className="hover:text-primary">{p.name}</Link></td>
                          <td className="whitespace-nowrap px-4 py-3">{price && price > 0 ? <>{formatPrice(price, p.currency)}{p.priceUnit && <span className="text-xs text-muted"> {p.priceUnit}</span>}</> : p.pricingModel === "FREE" ? t("product.free") : t("product.priceOnRequest")}</td>
                          <td className="px-4 py-3 text-muted">{pricingLabel(t, p.pricingModel)}</td>
                          <td className="px-4 py-3 text-muted">{p.terms.map((t) => t.term.name).join(", ") || "—"}</td>
                          <td className="px-4 py-3 text-right"><Link href={`/software/${p.slug}`} className="whitespace-nowrap font-medium text-primary hover:underline">{t("term.tableLink")}</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {term.content && <div className="prose-content" dangerouslySetInnerHTML={{ __html: term.content }} />}

          {/* Articles */}
          {posts && posts.items.length > 0 && (
            <Section id="articles" title={t("term.articlesTitle")} action={<Link href="/blog" className="text-sm font-medium text-primary hover:underline">{t("term.articlesLink")}</Link>}>
              <ul className="grid gap-4 md:grid-cols-3">
                {posts.items.map((p) => (
                  <li key={p.id} className="card-lift relative overflow-hidden rounded-panel border border-line bg-surface">
                    {p.cover && <Image src={p.cover.url} alt={p.cover.alt ?? ""} width={480} height={252} className="aspect-[1200/630] w-full object-cover" />}
                    <div className="p-4">
                      <Link href={`/blog/${p.slug}`} className="font-semibold leading-snug after:absolute after:inset-0 hover:text-primary">{p.title}</Link>
                      {p.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.excerpt}</p>}
                      {p.publishedAt && <p className="mt-2 text-xs text-muted">{formatDate(p.publishedAt)}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
            <Section id="faqs" title={t("term.faqTitle")}>
              <div className="divide-y divide-line rounded-panel border border-line bg-surface">
                {faqs.map((f) => (
                  <details key={f.question} className="group px-5 py-4">
                    <summary className="cursor-pointer list-none font-medium marker:hidden">{f.question}</summary>
                    <p className="mt-2 whitespace-pre-line text-muted">{f.answer}</p>
                  </details>
                ))}
              </div>
            </Section>
          )}

          {/* Continue exploring */}
          {related.length > 0 && (
            <Section title={t("term.relatedTitle")}>
              <ul className="flex flex-wrap gap-2">
                {related.slice(0, 12).map((t) => (
                  <li key={t.id}><Link href={`/${def.path}/${t.slug}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm hover:border-primary hover:text-primary">{t.name}<span className="text-xs text-muted">{t.count}</span></Link></li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-panel border border-line bg-surface p-4">
            <p className="mb-3 text-sm font-semibold">{t("term.glanceTitle")}</p>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[[products.total, t("term.glanceProducts"), LayoutList], [posts?.total ?? 0, t("term.glanceGuides"), BookOpen], [faqs.length, t("term.glanceFaqs"), CircleHelp]].map(([n, l, Icon]) => {
                const I = Icon as typeof LayoutList;
                return (
                  <div key={l as string} className="rounded-xl bg-bg px-2 py-3">
                    <I className="mx-auto h-4 w-4 text-primary" aria-hidden />
                    <dd className="mt-1 text-lg font-bold">{n as number}</dd>
                    <dt className="text-[11px] text-muted">{l as string}</dt>
                  </div>
                );
              })}
            </dl>
          </div>
          {children.length > 0 && (
            <nav aria-label={`More specific ${def.plural.toLowerCase()}`} className="rounded-panel border border-line bg-surface p-4">
              <p className="mb-2 text-sm font-semibold">{t("term.narrowTitle")}</p>
              <ul className="space-y-1 text-sm">
                {children.map((c) => <li key={c.id}><Link href={`/${def.path}/${c.slug}`} className="flex justify-between rounded-md px-2 py-1 hover:bg-bg hover:text-primary"><span>{c.name}</span><span className="text-xs text-muted">{c.count}</span></Link></li>)}
              </ul>
            </nav>
          )}
          <nav aria-label={def.plural} className="rounded-panel border border-line bg-surface p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Tags className="h-4 w-4 text-primary" aria-hidden />{def.plural}</p>
            <ul className="space-y-0.5 text-sm">
              {related.slice(0, 15).map((t) => <li key={t.id}><Link href={`/${def.path}/${t.slug}`} className="flex justify-between rounded-md px-2 py-1 hover:bg-bg hover:text-primary"><span className="truncate">{t.name}</span><span className="text-xs text-muted">{t.count}</span></Link></li>)}
            </ul>
            <Link href={`/${def.path}`} className="mt-2 inline-block px-2 text-xs font-medium text-primary hover:underline">{t("term.seeAll", { list: def.plural.toLowerCase() })}</Link>
          </nav>
        </aside>
      </div>
      </EditRegion>
    </>
  );
}

// ─── Index page (/use-case) ──────────────────────────────────────────────────

export async function termIndexMetadata(kind: TaxonomyKind): Promise<Metadata> {
  const def = taxonomyDef(kind, (await getSettings()).taxonomies);
  if (!def.enabled) return {};
  const t = await getT();
  return buildMetadata({ path: `/${def.path}`, title: t("termIndex.seoTitle", { list: def.singular.toLowerCase() }), description: t("termIndex.seoDescription", { list: def.singular.toLowerCase(), help: def.help }) });
}

export async function TermIndexPage({ kind }: { kind: TaxonomyKind }) {
  const def = taxonomyDef(kind, (await getSettings()).taxonomies);
  if (!def.enabled) notFound();
  const [terms, tr] = await Promise.all([termIndex(kind), getT()]);
  const roots = terms.filter((t) => !t.parentId || !terms.some((p) => p.id === t.parentId));
  const childrenOf = (id: string) => terms.filter((t) => t.parentId === id);
  return (
    <EditRegion label={def.plural} actions={[{ label: `Edit ${def.plural.toLowerCase()}`, href: `/admin/taxonomies/${def.key}` }, { label: "List names & wording", href: "/admin/settings?tab=taxonomies" }]}>
    <div className="container py-8">
      <Breadcrumbs items={[{ name: def.plural, path: `/${def.path}` }]} />
      <h1 className="mt-4 text-3xl font-bold sm:text-4xl">{tr("termIndex.heading", { list: def.singular.toLowerCase() })}</h1>
      <p className="mt-2 max-w-2xl text-muted">{def.help}</p>
      {terms.length === 0 ? (
        <p className="mt-10 text-muted">{tr("termIndex.empty")}</p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roots.map((t) => (
            <li key={t.id} className="card-lift relative rounded-panel border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/${def.path}/${t.slug}`} className="font-semibold after:absolute after:inset-0 hover:text-primary">{t.name}</Link>
                <Badge tone="neutral">{t.count} {t.count === 1 ? tr("termIndex.product") : tr("termIndex.products")}</Badge>
              </div>
              {t.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{t.description}</p>}
              {childrenOf(t.id).length > 0 && (
                <ul className="relative z-10 mt-3 flex flex-wrap gap-1.5">
                  {childrenOf(t.id).map((c) => <li key={c.id}><Link href={`/${def.path}/${c.slug}`} className="rounded-full bg-bg px-2.5 py-0.5 text-xs hover:text-primary">{c.name}</Link></li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
    </EditRegion>
  );
}
