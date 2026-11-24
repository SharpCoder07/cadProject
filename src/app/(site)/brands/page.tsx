import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { db } from "@/server/db";
import { buildMetadata } from "@/server/seo/metadata";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { Pagination } from "@/components/ui/pagination";
import { BrandSearch } from "@/components/site/brand-search";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";

type Props = { searchParams: Promise<{ q?: string; page?: string }> };
const PER_PAGE = 16;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q, page } = await searchParams;
  const t = await getT();
  const meta = buildMetadata({ path: "/brands", title: t("brands.seoTitle"), description: t("brands.seoDescription") });
  // Search results and later pages aren't indexed separately.
  return q || (Number(page) || 1) > 1 ? { ...meta, robots: { index: false, follow: true } } : meta;
}

/**
 * Software brands directory, styled after certinal.com's knowledge hub: a centred hero on a soft accent wash
 * with rings and live figures, then cards with a graphic banner (logo tile, accent arcs, product count),
 * name, the brand's top three products and a "view" link — 16 per page, with search — and a closing
 * call to action for software makers. Banner and ring styles: app/design1.css (.cg-brands, .cg-brand-*, .cg-bh-rings, .cg-card-rings); they use the theme's
 * main colour (the accent under Design 1).
 */
export default async function BrandsIndex({ searchParams }: Props) {
  const sp = await searchParams;
  const t = await getT();
  const q = (sp.q ?? "").trim().slice(0, 60);
  const where: Prisma.BrandWhereInput = { isActive: true, ...(q ? { name: { contains: q, mode: "insensitive" } } : {}) };
  const [total, all] = await Promise.all([db.brand.count({ where }), db.brand.count({ where: { isActive: true } })]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const page = Math.min(Math.max(1, Number(sp.page) || 1), pages);
  const brands = await db.brand.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { software: { _count: "desc" } }, { name: "asc" }],
    skip: (page - 1) * PER_PAGE,
    take: PER_PAGE,
    select: {
      id: true,
      name: true,
      slug: true,
      logo: { select: { url: true } },
      software: { where: { status: "PUBLISHED" }, orderBy: { popularityScore: "desc" }, take: 3, select: { name: true } },
      _count: { select: { software: { where: { status: "PUBLISHED" } } } },
    },
  });

  const productCount = await db.software.count({ where: { status: "PUBLISHED" } });
  const stats = [
    { value: all.toLocaleString("en-IN"), label: t("brands.statBrands") },
    { value: productCount.toLocaleString("en-IN"), label: t("brands.statProducts") },
    { value: "₹0", label: t("brands.statAdvice") },
  ];

  return (
    <EditRegion label="All brands" live={{ kind: "brands", id: "all", section: "all", title: "Brands" }} actions={[{ label: "Open in admin", href: "/admin/brands" }, { label: "Wording", href: "/admin/cms/texts?group=brands" }]}>
    <div className="cg-brands">
      {/* Hero (reference: certinal.com knowledge hub): centred on a soft accent wash, a pill label, big rings on the right. */}
      <section className="relative overflow-hidden border-b border-line bg-[linear-gradient(115deg,rgb(var(--bd)/0.07)_0%,rgb(var(--color-surface))_45%,rgb(var(--bd)/0.16)_100%)]">
        <div aria-hidden className="cg-bh-rings pointer-events-none absolute -right-[14%] top-1/2 hidden aspect-square w-[min(560px,50vw)] -translate-y-1/2 rounded-full md:block" />
        <div aria-hidden className="cg-bh-rings cg-bh-rings-sm pointer-events-none absolute -left-[8%] -bottom-[40%] hidden aspect-square w-[min(340px,34vw)] rounded-full opacity-40 md:block" />
        <div className="container relative py-12 text-center sm:py-16">
          <div className="flex justify-center"><Breadcrumbs items={[{ name: t("brands.heading"), path: "/brands" }]} /></div>
          <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--bd)/0.45)] bg-surface/80 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink shadow-[0_6px_18px_-12px_rgb(var(--color-ink)/0.4)] backdrop-blur">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--bd-ink))]" />
            {t("brands.eyebrow")}
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.08] tracking-[-0.025em] text-ink">{t("brands.heading")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted sm:text-lg">{t(all === 1 ? "brands.introOne" : "brands.intro", { count: all })}</p>
          <div className="[&>form]:mx-auto">
            <BrandSearch initial={q} />
          </div>
          <dl className="mx-auto mt-8 grid max-w-xl grid-cols-3 divide-x divide-line overflow-hidden rounded-2xl border border-line bg-surface/90 shadow-[0_18px_40px_-30px_rgb(var(--color-ink)/0.5)] backdrop-blur">
            {stats.map((s) => (
              <div key={s.label} className="px-3 py-3.5">
                <dd data-countup className="font-display text-xl font-extrabold text-ink sm:text-2xl">{s.value}</dd>
                <dt className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="bg-[rgb(var(--bd)/0.05)]">
        <div id="brands" className="container scroll-mt-44 py-10 sm:py-14">
          {q && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-muted">
                {t(total === 1 ? "brands.matchOne" : "brands.match", { count: total, query: q })}
              </p>
              <Link href="/brands" className="font-semibold text-primary hover:underline">{t("brands.showAll")}</Link>
            </div>
          )}
          {brands.length === 0 ? (
            <p className="rounded-[20px] border border-line bg-surface py-16 text-center text-muted">{q ? t("brands.noMatch") : t("brands.empty")}</p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {brands.map((b) => {
                const count = b._count.software;
                return (
                  <li key={b.id}>
                    <article className="cg-brand-card group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_4px_18px_-12px_rgb(var(--color-ink)/0.25)] transition duration-300 hover:-translate-y-1 hover:border-[rgb(var(--bd)/0.7)] hover:shadow-[0_22px_44px_-26px_rgb(var(--color-primary)/0.55)]">
                      {/* Banner: logo on a white tile; on the right the same soft filled rings as the page header, with the product count at their centre. */}
                      <div className="cg-brand-banner relative flex h-40 items-center overflow-hidden border-b border-line px-6">
                        <span aria-hidden className="cg-bh-rings cg-card-rings absolute -right-20 top-1/2 aspect-square h-[190%] -translate-y-1/2 rounded-full" />
                        <div className="relative z-[1] flex h-20 w-[55%] items-center justify-center rounded-2xl border border-line bg-surface px-4 shadow-[0_10px_24px_-18px_rgb(var(--color-ink)/0.5)]">
                          {b.logo ? (
                            <Image src={b.logo.url} alt="" width={240} height={64} className="h-auto max-h-12 w-auto max-w-full object-contain" />
                          ) : (
                            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-[rgb(var(--bd))] font-display text-xl font-bold text-white" aria-hidden>{b.name.slice(0, 1)}</span>
                          )}
                        </div>
                        <span className="absolute right-8 top-1/2 z-[1] grid h-[5.25rem] w-[5.25rem] -translate-y-1/2 place-items-center rounded-full bg-surface px-2.5 text-center shadow-[0_10px_24px_-14px_rgb(var(--color-ink)/0.55)]">
                          <span className="leading-none">
                            <span className="block font-display text-xl font-extrabold text-ink">{count || "–"}</span>
                            <span className="mt-1 block text-[10px] font-semibold uppercase leading-tight tracking-[0.06em] text-muted">{count ? t(count === 1 ? "brands.productsOne" : "brands.products") : t("brands.comingSoon")}</span>
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-6">
                        <h2 className="font-display text-lg font-bold leading-snug text-ink">
                          <Link href={`/brands/${b.slug}`} className="after:absolute after:inset-0 after:rounded-[20px]">{b.name}</Link>
                        </h2>
                        <p className="mt-1.5 text-sm leading-relaxed text-muted">{t("brands.cardLine", { name: b.name })}</p>
                        {b.software.length > 0 && (
                          <ul className="mt-4 flex flex-wrap gap-2">
                            {b.software.map((s) => (
                              <li key={s.name} className="max-w-full truncate rounded-full border border-line bg-bg px-3 py-1 text-xs font-medium text-ink">{s.name}</li>
                            ))}
                          </ul>
                        )}
                        <span className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-bold text-ink">
                          {t("brands.cardLink")} <ArrowUpRight className="h-4 w-4 text-[rgb(var(--bd-ink))] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-10">
            <Pagination page={page} pages={pages} basePath="/brands" params={{ q: q || undefined }} boxed anchor="brands" />
          </div>

          {/* Closing call to action, like the reference's "Ready to see … in action?". */}
          <div className="cg-brand-cta relative mt-14 overflow-hidden rounded-[28px] border border-[rgb(var(--bd)/0.35)] px-6 py-10 text-center sm:px-12 sm:py-14">
            <span aria-hidden className="cg-bh-rings pointer-events-none absolute -left-28 top-1/2 aspect-square h-[200%] -translate-y-1/2 rounded-full opacity-40" />
            <span aria-hidden className="cg-bh-rings pointer-events-none absolute -right-28 top-1/2 aspect-square h-[200%] -translate-y-1/2 rounded-full opacity-40" />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink/70">{t("brands.ctaEyebrow")}</p>
              <h2 className="mx-auto mt-2 max-w-2xl font-display text-[clamp(1.6rem,3.2vw,2.4rem)] font-extrabold leading-tight tracking-[-0.02em] text-ink">{t("brands.ctaHeading")}</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-ink/75 sm:text-base">{t("brands.ctaText")}</p>
              <Link href={t("header.listSoftwareUrl")} className="cg-glow mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-white transition hover:bg-primary/90">
                {t("brands.ctaButton")} <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    </EditRegion>
  );
}
