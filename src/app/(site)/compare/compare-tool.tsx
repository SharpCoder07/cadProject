// Server component shared by /compare and /compare/[slug].
import Image from "next/image";
import Link from "next/link";
import { ComparisonCard } from "@/components/site/comparison-card";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Folder, GitCompareArrows, Shapes, Sparkles } from "lucide-react";
import { Fragment } from "react";
import { getSettings } from "@/server/settings";
import { compareProducts, comparisonData, type CompareGroup } from "@/server/services/catalog";
import { getCompareShowcase, listPublishedComparisons } from "@/server/services/comparisons";
import { COMPARE_SLOTS, compareUrl } from "@/lib/compare";
import { CompareTable } from "@/components/site/compare-table";
import { ComparisonSections } from "@/components/site/comparison-sections";
import type { ComparisonSection } from "@/lib/comparison-sections";
import { CompareBuilder } from "@/components/site/compare-picker";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { makeT } from "@/lib/site-texts";
import { EditRegion, PageEditActions } from "@/components/site/edit-mode";
import { COMPARE_REGIONS } from "@/lib/edit-regions";

const GUIDE_STEPS = [1, 2, 3];
const FAQ_ITEMS = [1, 2, 3, 4, 5];

function MiniLogo({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return url ? (
    <Image src={url} alt="" width={40} height={40} className={`h-10 w-10 rounded-full border-2 border-surface bg-surface object-contain shadow-sm ${className ?? ""}`} />
  ) : (
    <span className={`grid h-10 w-10 place-items-center rounded-full border-2 border-surface bg-primary-soft text-sm font-bold text-primary shadow-sm ${className ?? ""}`} aria-hidden>
      {name.slice(0, 1)}
    </span>
  );
}

const compareHref = (g: CompareGroup) => g.href ?? compareUrl(g.products.map((p) => p.slug));

function SectionTitle({ eyebrow, title, id, sub }: { eyebrow: string; title: string; id: string; sub?: string }) {
  return (
    <div className="mb-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      <h2 id={id} className="mt-1 text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.85rem]">{title}</h2>
      <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
      {sub && <p className="mt-3 max-w-2xl text-muted">{sub}</p>}
    </div>
  );
}

/**
 * The compare tool (hero, product picker, comparison table, ready-made comparisons, guide, FAQs).
 * Used by /compare (nothing picked yet) and /compare/a-vs-b (products from the URL).
 */
export interface CuratedContent {
  id: string;
  title: string;
  /** Its own address (/compare/<slug>). */
  path: string;
  intro: string | null;
  verdict: string | null;
  sections: ComparisonSection[];
}

export async function CompareTool({ slugs, curated }: { slugs: string[]; curated?: CuratedContent | null }) {
  const [settings, selected, data, popular, showcase] = await Promise.all([getSettings(), compareProducts(slugs), comparisonData(slugs), listPublishedComparisons(6), getCompareShowcase()]);
  const t = makeT(settings.texts);
  const vs = ` ${t("compare.vs")} `;

  return (
    <>
      <PageEditActions
        actions={[
          ...(curated ? [{ label: "Edit this comparison", href: `/admin/comparisons?edit=${curated.id}`, primary: true }] : [{ label: "Add content for these products", href: "/admin/comparisons", primary: true }]),
          { label: "Compare page lists", href: "/admin/comparisons/showcase" },
          { label: "Compare page texts", href: "/admin/cms/texts?group=compare" },
        ]}
      />
      {/* Hero */}
      <EditRegion {...COMPARE_REGIONS.hero}>
      <section className="relative overflow-hidden border-b border-line bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgb(var(--color-ink)/0.045)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--color-ink)/0.045)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]"
        />
        <div aria-hidden className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="container relative pb-14 pt-8 sm:pb-16">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Breadcrumbs items={[{ name: t("compare.breadcrumb"), path: "/compare" }, ...(curated ? [{ name: curated.title, path: curated.path }] : selected.length >= 2 ? [{ name: selected.map((p) => p.name).join(vs), path: compareUrl(selected.map((p) => p.slug)) }] : [])]} />
            <Link href="/categories" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-primary">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t("compare.browse")}
            </Link>
          </div>
          <div className="mx-auto mt-6 max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft/60 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t("compare.eyebrow")}
            </span>
            <span className="mx-auto mt-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-fg shadow-[0_16px_32px_-12px_rgb(var(--color-primary)/0.6)]">
              <GitCompareArrows className="h-6 w-6" aria-hidden />
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              {curated ? (
                curated.title
              ) : selected.length >= 2 ? (
                <>
                  {selected.map((p, i) => (
                    <span key={p.slug}>
                      {i > 0 && <span className="text-muted">{vs}</span>}
                      {p.name}
                    </span>
                  ))}
                </>
              ) : (
                <>
                  {t("compare.heading")} <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t("compare.headingAccent")}</span>
                </>
              )}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              {t("compare.lead", { count: COMPARE_SLOTS })}
            </p>
            <a href="#build" className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-fg shadow-[0_12px_28px_-12px_rgb(var(--color-primary)/0.7)] transition hover:bg-primary/90">
              {t("compare.build")} <ArrowDown className="h-4 w-4" aria-hidden />
            </a>
          </div>
        </div>
      </section>
      </EditRegion>

      <div className="bg-bg">
        <div className="container space-y-8 py-10 sm:py-14">
          <EditRegion {...COMPARE_REGIONS.builder}>
          <CompareBuilder selected={selected} />
          </EditRegion>

          <EditRegion {...COMPARE_REGIONS.table}>
          {data.products.length === 0 ? (
            <section className="flex flex-col items-center rounded-[1.75rem] border border-dashed border-line bg-surface px-6 py-16 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-bg text-muted">
                <GitCompareArrows className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-lg font-bold text-ink">{t("compare.emptyTitle")}</h2>
              <p className="mt-2 max-w-sm text-sm text-muted">{t("compare.emptyText")}</p>
            </section>
          ) : (
            <CompareTable data={data} labels={settings.labels} texts={settings.texts} editable />
          )}
          </EditRegion>

          {/* This comparison's own content (Admin › Comparisons), all below the table: introduction, sections, verdict. */}
          <EditRegion label="This comparison's content" live={curated ? { kind: "comparison", id: curated.id, section: "content", title: "Introduction, sections & verdict" } : null} actions={curated ? [{ label: "Open in admin", href: `/admin/comparisons?edit=${curated.id}` }] : []}>
          {curated?.intro && data.products.length > 0 && <section className="prose-content rounded-[1.75rem] border border-line bg-surface p-6 sm:p-10" dangerouslySetInnerHTML={{ __html: curated.intro }} />}
          {curated && data.products.length > 0 && <ComparisonSections sections={curated.sections} />}
          {curated?.verdict && (
            <section className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-10" aria-labelledby="comparison-verdict">
              <h2 id="comparison-verdict" className="text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.75rem]">{t("compare.verdict")}</h2>
              <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
              <div className="prose-content mt-4" dangerouslySetInnerHTML={{ __html: curated.verdict }} />
            </section>
          )}
          </EditRegion>

          <EditRegion {...COMPARE_REGIONS.trending}>
          {showcase.trending.length > 0 && (
            <section className="pt-6" aria-labelledby="trending-comparisons">
              <SectionTitle eyebrow={t("compare.trendingEyebrow")} title={t("compare.trendingTitle")} id="trending-comparisons" />
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {showcase.trending.map((g, gi) => (
                  <li key={g.href ?? `${g.category.slug}-${gi}`} className="cg-trend group relative flex flex-col overflow-hidden rounded-[18px] border border-line bg-surface py-4 pl-5 pr-4 shadow-[0_10px_28px_-24px_rgb(var(--color-ink)/0.45)] transition duration-300 has-[a:hover]:border-primary/40 has-[a:hover]:shadow-[0_22px_40px_-26px_rgb(var(--color-primary)/0.55)]">
                    {/* Accent bar on the left edge: grows and turns teal on hover. */}
                    <span aria-hidden className="absolute bottom-5 left-0 top-5 w-1 rounded-r-full bg-line transition-all duration-300 group-has-[a:hover]:bottom-0 group-has-[a:hover]:top-0 group-has-[a:hover]:bg-primary" />
                    {/* Face-off: the products side by side, split by a VS divider. */}
                    <h3 className="mb-4 mt-1">
                      <span className="flex items-stretch justify-center">
                        {g.products.map((p, pi) => (
                          <Fragment key={p.slug}>
                            {pi > 0 && (
                              <span aria-hidden className="flex shrink-0 flex-col items-center px-1.5 pt-2.5">
                                <span className="grid h-6 w-6 place-items-center rounded-full bg-bg text-[8.5px] font-extrabold tracking-wide text-muted ring-1 ring-line transition duration-500 group-has-[a:hover]:rotate-[360deg] group-has-[a:hover]:bg-primary-soft group-has-[a:hover]:text-primary group-has-[a:hover]:ring-primary/30">{t("compare.vs").toUpperCase()}</span>
                              </span>
                            )}
                            {pi > 0 && <span className="sr-only">{vs}</span>}
                            <span className={`flex min-w-0 flex-1 flex-col items-center gap-2 text-center transition duration-300 ${pi === 0 && g.products.length > 1 ? "group-has-[a:hover]:translate-x-1" : pi === g.products.length - 1 && g.products.length > 1 ? "group-has-[a:hover]:-translate-x-1" : ""}`}>
                              <span className="grid h-11 w-11 place-items-center rounded-xl bg-surface shadow-[0_6px_14px_-10px_rgb(var(--color-ink)/0.5)] ring-1 ring-line transition duration-300 group-has-[a:hover]:ring-primary/40">
                                <MiniLogo url={p.logoUrl} name={p.name} className="!h-7 !w-7 !rounded-md !border-0 !text-xs !shadow-none" />
                              </span>
                              <span className="line-clamp-2 text-[13px] font-bold leading-snug text-ink transition group-has-[a:hover]:text-primary">{p.name}</span>
                            </span>
                          </Fragment>
                        ))}
                      </span>
                    </h3>
                    {/* Footer: the category on the left, the compare button (teal pill, arrow bubble, light sweep on hover) on the right. */}
                    <span className="mt-auto flex items-center justify-between gap-3 border-t border-line/80 pt-3">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-[11.5px] font-semibold text-muted">
                        <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{g.category.name}</span>
                      </span>
                      <Link href={compareHref(g)} aria-label={`${t("compare.compareNow")}: ${g.products.map((p) => p.name).join(vs)}`} className="relative inline-flex h-9 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 items-center gap-2 overflow-hidden rounded-full bg-primary pl-4 pr-1.5 text-[12.5px] font-bold text-primary-fg shadow-[0_10px_20px_-10px_rgb(var(--color-primary)/0.8)] transition duration-300 group-has-[a:hover]:shadow-[0_14px_26px_-10px_rgb(var(--color-primary)/0.9)]">
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-has-[a:hover]:translate-x-[420%]" />
                        {t("compare.compareNow")}
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 transition duration-300 group-has-[a:hover]:translate-x-0.5 group-has-[a:hover]:bg-white group-has-[a:hover]:text-primary">
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </EditRegion>

          <EditRegion {...COMPARE_REGIONS.byCategory}>
          {showcase.byCategory.length > 0 && (
            <section className="pt-6" aria-labelledby="category-comparisons">
              <SectionTitle eyebrow={t("compare.byCategoryEyebrow")} title={t("compare.byCategoryTitle")} id="category-comparisons" />
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {showcase.byCategory.map((g, gi) => (
                  <li key={g.href ?? `${g.category.slug}-${gi}`} className="group flex flex-col rounded-[18px] border border-line bg-surface p-5 shadow-[0_10px_28px_-24px_rgb(var(--color-ink)/0.45)] transition duration-300 has-[.cg-cmp:hover]:border-primary/40 has-[.cg-cmp:hover]:shadow-[0_22px_40px_-26px_rgb(var(--color-primary)/0.55)]">
                    {/* Header: category icon, name, how many products, link to the category. */}
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                        <Shapes className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-display text-[15px] font-bold text-ink">{g.category.name}</h3>
                        <p className="text-xs text-muted">{t("compare.byCategoryCount", { count: g.products.length })}</p>
                      </div>
                      {g.category.slug && (
                        <Link href={`/categories/${g.category.slug}`} className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-muted transition hover:bg-primary-soft hover:text-primary">
                          {t("compare.viewCategory")} <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      )}
                    </div>
                    {/* The products, in a soft box; "vs" tags sit on the dividers between them. */}
                    <ul className="mt-4 rounded-xl bg-bg/60 ring-1 ring-line/80">
                      {g.products.map((p, pi) => (
                        <li key={p.slug} className={`relative flex items-center gap-3 px-3 py-2.5${pi > 0 ? " border-t border-line/80" : ""}`}>
                          {pi > 0 && (
                            <span aria-hidden className="absolute -top-2.5 right-4 rounded-full bg-surface px-1.5 py-px text-[9px] font-extrabold tracking-wide text-muted ring-1 ring-line transition group-has-[.cg-cmp:hover]:bg-primary-soft group-has-[.cg-cmp:hover]:text-primary">
                              {t("compare.vs").toUpperCase()}
                            </span>
                          )}
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface ring-1 ring-line">
                            <MiniLogo url={p.logoUrl} name={p.name} className="!h-5 !w-5 !rounded !border-0 !text-[9px] !shadow-none" />
                          </span>
                          <Link href={`/software/${p.slug}`} className="group/p flex min-w-0 flex-1 items-center justify-between gap-2 text-[13.5px] font-semibold text-ink hover:text-primary">
                            <span className="truncate">{p.name}</span>
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 -translate-x-1 text-primary opacity-0 transition group-hover/p:translate-x-0 group-hover/p:opacity-100" aria-hidden />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    {/* Footer: overlapping logos, then the compare button. */}
                    <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                      <span aria-hidden className="flex -space-x-2">
                        {g.products.slice(0, 4).map((p) => (
                          <span key={p.slug} className="grid h-7 w-7 place-items-center rounded-full bg-surface ring-2 ring-surface">
                            <MiniLogo url={p.logoUrl} name={p.name} className="!h-7 !w-7 !rounded-full !border !border-line !text-[9px] !shadow-none" />
                          </span>
                        ))}
                      </span>
                      <Link href={compareHref(g)} aria-label={`${t("compare.compareThese")}: ${g.products.map((p) => p.name).join(vs)}`} className="cg-cmp group/b relative inline-flex h-9 shrink-0 items-center gap-2 overflow-hidden rounded-full bg-primary pl-4 pr-1.5 text-[12.5px] font-bold text-primary-fg shadow-[0_10px_20px_-10px_rgb(var(--color-primary)/0.8)] outline-none transition duration-300 hover:shadow-[0_14px_26px_-10px_rgb(var(--color-primary)/0.9)] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2">
                        <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-700 group-hover/b:translate-x-[420%]" />
                        {t("compare.compareThese")}
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 transition duration-300 group-hover/b:translate-x-0.5 group-hover/b:bg-white group-hover/b:text-primary">
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </EditRegion>

          <EditRegion {...COMPARE_REGIONS.popular}>
          {popular.length > 0 && (
            <section className="pt-6" aria-labelledby="popular-comparisons">
              <div className="mb-7">
                <h2 id="popular-comparisons" className="text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.85rem]">{t("compare.popularTitle")}</h2>
                <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {popular.map((c) => (
                  <li key={c.slug}>
                    <ComparisonCard c={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          </EditRegion>

          <EditRegion {...COMPARE_REGIONS.guide}>
          {/* Buyer's guide: left-aligned heading like the other sections, then the timeline stepper. */}
          <section className="pt-10" aria-labelledby="compare-guide">
            {(() => {
              const title = t("compare.guideTitle");
              const words = title.split(" ");
              const head = words.slice(0, -2).join(" ");
              const tail = words.slice(-2).join(" ");
              return (
                <div className="mb-8 max-w-2xl">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{t("compare.guideEyebrow")}</p>
                  <h2 id="compare-guide" className="mt-1 text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.85rem]">
                    {head} <span className="text-primary">{tail}</span>
                  </h2>
                  <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
                  {t("compare.guideSub") && <p className="mt-3 max-w-2xl text-muted">{t("compare.guideSub")}</p>}
                </div>
              );
            })()}
            {/* Timeline stepper (design C): numbered nodes on a line that fills in view, short title, tag chips. Vertical on mobile. */}
            <div data-play className="cg-tl relative">
              <span aria-hidden className="cg-tl-line absolute left-[16.66%] right-[16.66%] top-[22px] hidden h-[3px] overflow-hidden rounded-full bg-line md:block"><span className="cg-tl-fill block h-full w-full origin-left rounded-full bg-[linear-gradient(90deg,rgb(var(--color-primary)),rgb(var(--color-accent)))]" /></span>
              <span aria-hidden className="absolute bottom-6 left-[21px] top-6 w-[3px] rounded-full bg-line md:hidden" />
              <ol className="relative grid gap-7 md:grid-cols-3 md:gap-6">
                {GUIDE_STEPS.map((n) => ({ n, title: t(`compare.guide${n}Title`), points: t(`compare.guide${n}Points`).split("|").map((x) => x.trim()).filter(Boolean) })).filter((g) => g.title).map((g, gi, all) => {
                  const last = gi === all.length - 1;
                  return (
                    <li key={g.n} className="cg-tl-step group flex gap-4 md:flex-col md:items-center md:text-center" style={{ ["--i" as string]: gi }}>
                      <span className={`cg-tl-node relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-full font-display text-[16px] font-extrabold ring-[6px] ring-bg transition duration-300 group-hover:scale-110 ${last ? "bg-accent text-accent-fg" : "bg-primary text-primary-fg"}`}>{g.n}</span>
                      <div className="min-w-0 pt-1.5 md:pt-0">
                        <h3 className="font-display text-[17px] font-bold leading-snug text-ink md:mt-3.5">{g.title}</h3>
                        {g.points.length > 0 && (
                          <ul className="mt-2.5 flex flex-wrap gap-1.5 md:justify-center">
                            {g.points.map((pt, pi) => (
                              <li key={pt} className="cg-tl-chip rounded-full bg-primary-soft px-3 py-1 text-[12.5px] font-semibold text-primary ring-1 ring-primary/15" style={{ ["--j" as string]: pi }}>{pt}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>
          </EditRegion>

          {/* Same layout as the homepage FAQ block: left heading with subtitle, two columns of questions. */}
          <EditRegion {...COMPARE_REGIONS.faq}>
          <section className="pt-6" aria-labelledby="compare-faq">
            <div className="mb-5">
              <h2 id="compare-faq" className="text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.85rem]">{t("compare.faqTitle")}</h2>
              <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
              {t("compare.faqSub") && <p className="mt-3 max-w-2xl text-muted">{t("compare.faqSub")}</p>}
            </div>
            <div className="grid items-start gap-3 lg:grid-cols-2">
              {FAQ_ITEMS.map((n) => ({ q: t(`compare.faq${n}Q`), a: t(`compare.faq${n}A`, { count: COMPARE_SLOTS }) })).filter((f) => f.q).map((f) => (
                <details key={f.q} className="group rounded-panel border border-line bg-surface px-5 py-4 open:border-primary/30 open:shadow-[0_8px_24px_-16px_rgb(var(--color-ink)/0.35)]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                    {f.q}
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-lg text-primary transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
          </EditRegion>
        </div>
      </div>
    </>
  );
}
