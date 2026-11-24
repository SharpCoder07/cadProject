import Image from "next/image";
import Link from "next/link";
import { ComparisonCard } from "@/components/site/comparison-card";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { cardsByIds, listSoftware, siteStats } from "@/server/services/catalog";
import { liveDeals } from "@/server/services/offers";
import { getCategoryTree } from "@/server/services/categories";
import { getBanners, getFaqGroup, getTestimonials } from "@/server/services/navigation";
import { listPublishedPosts } from "@/server/services/blog";
import { listPublishedComparisons } from "@/server/services/comparisons";
import type { ResolvedSection } from "@/server/services/cms";
import { blockSchemas, isBlockType, type BlockData } from "@/lib/blocks/schemas";
import type { LayoutData } from "@/lib/blocks/free-layout";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { ArrowRight, BadgeCheck, BookOpen, ChevronRight, LayoutGrid, Shapes, Star, Tag } from "lucide-react";
import { Stars } from "@/components/ui/misc";
import { HeroJourney } from "@/components/site/hero-journey";
import { searchExamples } from "@/lib/search-examples";
import { SoftwareLogo, SoftwareRow, SoftwareTile } from "@/components/site/software-card";
import { SearchBox } from "@/components/site/search-box";
import { EnquireButton } from "@/components/site/lead-dialog";
import { LeadForm } from "@/components/site/lead-form";
import { SoftwareTabs } from "./software-tabs";
import { makeT, type T } from "@/lib/site-texts";
import { EditableSection, EditRegion } from "@/components/site/edit-mode";
import { FreeLayout } from "@/components/site/free-layout/free-layout";
import { heroBrandsRegion } from "@/lib/edit-regions";
import { themedLogoUrl } from "@/lib/brand-logo";
import { Check } from "lucide-react";

type Settings = Awaited<ReturnType<typeof getSettings>>;

/** The last `n` words in a span (Design 1 shows them in its green gradient; the classic design doesn't style it). */
function accentLast(text: string, n = 2): React.ReactNode {
  const words = text.trim().split(/\s+/);
  if (words.length <= n + 1) return text;
  return <>{words.slice(0, -n).join(" ")} <span className="cg-accent">{words.slice(-n).join(" ")}</span></>;
}

function SectionHeading({ title, subtitle, action, center }: { title: string; subtitle?: string; action?: React.ReactNode; center?: boolean }) {
  if (!title) return null;
  return (
    <div className={cn("cg-sh mb-5 flex flex-wrap items-start justify-between gap-3", center && "flex-col items-center text-center")}>
      <div>
        <h2 className="text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.85rem]">{title}</h2>
        <span aria-hidden className={cn("cg-sh-bar mt-2.5 block h-1 w-12 rounded-full bg-accent", center && "mx-auto")} />
        {subtitle && <p className={cn("mt-3 max-w-2xl text-muted", center && "mx-auto")}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ViewAll({ href, children = "View all" }: { href: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-9 items-center gap-1 rounded-control border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-fg">
      {children} <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

const CHIP_TONES = [
  "bg-[#E6F7F4] text-[#0F766E]",
  "bg-[#FFF0DE] text-[#B85F00]",
  "bg-[#DCF5EB] text-[#0B7A55]",
  "bg-[#FDE6EE] text-[#C0265E]",
  "bg-[#ECF5DD] text-[#4D7C0F]",
  "bg-[#FFF6D6] text-[#8A6A00]",
] as const;

const compact = (n: number) => (n >= 1000 ? `${(Math.floor(n / 100) / 10).toLocaleString("en-IN")}k+` : n >= 10 ? `${Math.floor(n / 10) * 10}+` : String(n));

/**
 * Brands for the hero "Top software brands" strip (Products → Brands). Only real uploaded logos are
 * shown — the placeholder initials the demo seed generates under seed/ are skipped. Hand-picked
 * brands keep their order; otherwise display order, then brands with the most products. Links go
 * to /brands/<slug>.
 */
async function logoStripBrands(ids: string[]) {
  const where = { isActive: true, logo: { is: { storageKey: { not: { startsWith: "seed/" } } } } };
  const select = { id: true, name: true, slug: true, logo: { select: { url: true, width: true, height: true } } } as const;
  if (ids.length) {
    const rows = await db.brand.findMany({ where: { ...where, id: { in: ids } }, select });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id)).filter((r): r is (typeof rows)[number] => Boolean(r)).slice(0, 12);
  }
  return db.brand.findMany({ where, orderBy: [{ sortOrder: "asc" }, { software: { _count: "desc" } }, { name: "asc" }], take: 12, select });
}

async function Hero({ d, s, sectionId }: { d: BlockData<"HERO">; s: Settings; sectionId: string }) {
  const t = makeT(s.texts);
  const [stats, vendors] = await Promise.all([
    d.showStats ? siteStats() : null,
    d.showLogos ? logoStripBrands(d.logoBrandIds) : [],
  ]);
  const figures = stats
    ? [
        { value: compact(stats.products), label: t("home.statProducts"), Icon: LayoutGrid },
        { value: compact(stats.categories), label: t("home.statCategories"), Icon: Shapes },
        { value: compact(stats.vendors), label: t("home.statBrands"), Icon: BadgeCheck },
        { value: compact(stats.reviews), label: t("home.statReviews"), Icon: Star },
      ].filter((f) => f.value !== "0")
    : [];
  return (
    <section className="cg-hero relative overflow-hidden border-b border-line bg-[linear-gradient(180deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-surface))_100%)]">
      {d.backgroundImageUrl && <Image src={d.backgroundImageUrl} alt="" fill priority className="object-cover opacity-10" sizes="100vw" />}
      <div aria-hidden className="cg-float pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
      <div aria-hidden className="cg-float-alt pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
      <div className="cg-hero-in container relative py-9 text-center sm:py-12 xl:pb-[72px] xl:pt-[72px]">
        <HeroJourney labels={[1, 2, 3, 4].map((n) => t(`home.journey${n}`))} />
        <p className="cg-eyebrow">{t("home.heroEyebrow")}</p>
        <h1 data-textwarp className="cg-shine mx-auto max-w-4xl text-[clamp(1.9rem,4.4vw,3.2rem)] font-extrabold leading-[1.12] tracking-[-0.02em] text-ink">
          {accentLast(d.heading?.trim() || t("home.heroHeadingDefault"))}
        </h1>
        {d.subheading && <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{d.subheading}</p>}
        <SearchBox
          placeholder={d.placeholder || s.labels.searchPlaceholder}
          hints={searchExamples(s.labels)}
          size="lg"
          label={!d.lead || d.lead === "I need software for" ? "Search software, categories or brands" : d.lead}
          className="mx-auto mt-8 max-w-3xl text-left"
          inputClassName="rounded-control shadow-[0_18px_40px_-22px_rgb(var(--color-primary)/0.6)]"
        />
        {d.quickLinks.length > 0 && (
          <div className="mx-auto mt-5 flex max-w-3xl flex-wrap items-center justify-center gap-2">
            <span className="mr-1 text-sm font-medium text-muted">{t("home.popularSearches")}</span>
            {d.quickLinks.map((l) => (
              <Link key={l.href + l.label} href={l.href || "/search"} className="inline-flex h-8 items-center rounded-full border border-line bg-surface px-3.5 text-sm text-ink transition hover:border-primary hover:text-primary">
                {l.label}
              </Link>
            ))}
          </div>
        )}
        {figures.length > 0 && (
          <dl className="cg-hero-stats mx-auto mt-8 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {figures.map(({ value, label, Icon: I }) => (
              <div key={label} className="flex items-center gap-3 rounded-panel border border-line bg-surface px-4 py-3 text-left shadow-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                  <I className="h-5 w-5" aria-hidden />
                </span>
                <span className="flex flex-col-reverse">
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd data-countup className="font-display text-xl font-extrabold leading-tight text-ink tabular-nums">{value}</dd>
                </span>
              </div>
            ))}
          </dl>
        )}
      </div>
      {vendors.length > 0 && (
        <EditRegion {...heroBrandsRegion(sectionId)}>
        <div className="relative border-t border-line bg-surface/70">
          <div className="container py-7 sm:py-8">
            <SectionHeading title={t("home.brandsHeading")} subtitle={t("home.brandsSubtitle")} action={t("home.brandsLink") ? <ViewAll href="/brands">{t("home.brandsLink")}</ViewAll> : undefined} />
            {/* Moves endlessly (two rows once there are 8+ brands) with Animations on Full: motion.tsx. */}
            <div className="cg-marquee" data-rows="2">
            <ul className="flex flex-wrap items-center gap-3 sm:gap-4">
              {vendors.map((v) => (
                <li key={v.id}>
                  <Link href={`/brands/${v.slug}`} title={v.name} className="flex h-16 w-40 items-center justify-center rounded-panel border border-line bg-surface px-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_24px_-14px_rgb(var(--color-ink)/0.35)]">
                    {v.logo && <Image src={v.logo.url} alt={`${v.name} logo`} width={v.logo.width ?? 160} height={v.logo.height ?? 64} className="max-h-9 w-auto max-w-full object-contain" />}
                  </Link>
                </li>
              ))}
            </ul>
            </div>
          </div>
        </div>
        </EditRegion>
      )}
    </section>
  );
}

function HowItWorks({ d }: { d: BlockData<"HOW_IT_WORKS"> }) {
  if (!d.steps.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title} center />
      {/* A rail that fills as you scroll past, lighting up each step (motion.tsx). */}
      <div data-progress className="relative">
      <span aria-hidden className="cg-rail"><span /></span>
      <ol data-steps className={cn("relative grid gap-4 sm:grid-cols-2", d.steps.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {d.steps.map((st, i) => (
          <li key={i} className="relative rounded-panel border border-line bg-surface p-6 text-center">
            <span className="absolute left-4 top-3 font-display text-4xl font-extrabold text-primary/10">{String(i + 1).padStart(2, "0")}</span>
            <span className={cn("mx-auto grid h-14 w-14 place-items-center rounded-full", CHIP_TONES[i % CHIP_TONES.length])}>
              <Icon name={st.icon} className="h-6 w-6" />
            </span>
            <p className="mt-4 font-display text-lg font-bold text-ink">{st.title}</p>
            {st.text && <p className="mt-1.5 text-sm text-muted">{st.text}</p>}
          </li>
        ))}
      </ol>
      </div>
    </section>
  );
}

/**
 * Connection diagram: cards on the left, joined by dashed curves to a centre card (your logo), which
 * links to one result card on the right. Desktop uses a fixed 5-column grid so the SVG lines (drawn in
 * a 0–100 box stretched over the grid) meet every card exactly; phones stack it with short connectors.
 */
function FlowDiagram({ d, s }: { d: BlockData<"FLOW_DIAGRAM">; s: Settings }) {
  const items = d.items.filter((i) => i.label);
  if (!items.length) return null;
  const n = items.length;
  // Column edges in % of the grid width (must match lg:grid-cols below): 30 | 13 | 20 | 9 | 28.
  const L = 30, C0 = 43, C1 = 63, R = 72;
  const builtIn = !s.site.logoUrl || s.site.logoUrl.startsWith("/brand/cadgram-");
  const mark = builtIn ? themedLogoUrl("/brand/cadgram-icon.svg", s.theme) : s.site.logoUrl;
  const dot = "absolute top-1/2 hidden h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--cg-flow-c)] lg:block";
  const card = "relative flex h-14 items-center gap-3 rounded-2xl border border-line bg-surface px-3 shadow-[0_6px_18px_-12px_rgb(0_0_0/0.25)]";
  return (
    <section className="container py-8 sm:py-10">
      {(d.title || d.subtitle) && <SectionHeading title={d.title} subtitle={d.subtitle || undefined} center />}
      <div
        className="cg-flow relative overflow-hidden rounded-[28px] border border-line p-5 sm:p-8 lg:px-12 lg:py-10"
        style={{
          backgroundColor: "rgb(var(--color-surface))",
          backgroundImage: "radial-gradient(rgb(var(--color-ink) / 0.09) 1px, transparent 1px), linear-gradient(135deg, rgb(var(--color-surface)), rgb(var(--color-accent) / 0.06))",
          backgroundSize: "18px 18px, 100% 100%",
        }}
      >
        {d.leftLabel && <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{d.leftLabel}</p>}
        <div className="relative flex flex-col gap-5 lg:grid lg:gap-0 lg:[grid-template-columns:30%_13%_20%_9%_28%]">
          {/* Lines (desktop only). Each card sits in an equal-height row, so its centre is at (i + 0.5) / n. */}
          <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block">
            {items.map((_, i) => {
              const y = ((i + 0.5) / n) * 100;
              const y2 = 50 + (y - 50) * 0.14;
              return <path key={i} className="cg-flow-line" d={`M${L} ${y} C${L + 7} ${y} ${C0 - 6} ${y2} ${C0} ${y2}`} />;
            })}
            {[-2.5, 0, 2.5].map((o) => <path key={o} className="cg-flow-line" d={`M${C1} ${50 + o} L${R} ${50 + o}`} />)}
          </svg>

          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:col-start-1 lg:grid-cols-1">
            {items.map((it, i) => {
              const inner = (
                <>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[rgb(var(--color-accent)/0.25)] text-ink"><Icon name={it.icon} className="h-[18px] w-[18px]" /></span>
                  <span className="truncate text-sm font-semibold text-ink">{it.label}</span>
                  <span aria-hidden className={cn(dot, "-right-1")} />
                </>
              );
              return (
                <li key={i} className="py-1.5 sm:px-1.5 lg:px-0">
                  {it.href ? <Link href={it.href} className={cn(card, "transition hover:-translate-y-0.5 hover:border-[var(--cg-flow-c)]")}>{inner}</Link> : <div className={card}>{inner}</div>}
                </li>
              );
            })}
          </ul>

          <span aria-hidden className="mx-auto h-8 border-l-2 border-dashed border-[var(--cg-flow-c)] lg:hidden" />

          <div className="flex items-center justify-center lg:col-start-3">
            <div className="cg-flow-hub relative flex w-full max-w-[260px] py-7 lg:aspect-square lg:py-5 flex-col items-center justify-center rounded-[28px] border border-[rgb(var(--color-accent)/0.7)] p-5 text-center">
              {mark && <Image src={mark} alt="" width={56} height={56} className={cn("w-auto", builtIn ? "h-12" : "h-10 max-w-[80%]")} />}
              {builtIn && <p className="mt-3 font-display text-xl font-bold text-ink">{s.site.name}</p>}
              {d.centerText && <p className="mt-1.5 text-xs font-semibold leading-snug text-ink/80">{d.centerText}</p>}
            </div>
          </div>

          <span aria-hidden className="mx-auto h-8 border-l-2 border-dashed border-[var(--cg-flow-c)] lg:hidden" />

          <div className="flex items-center lg:col-start-5">
            <div className="relative w-full">
              {d.rightLabel && <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted lg:absolute lg:bottom-full lg:mb-3">{d.rightLabel}</p>}
              <div className="relative flex items-center gap-3 rounded-2xl border border-[rgb(var(--color-accent)/0.8)] bg-surface p-4 shadow-[0_10px_30px_-18px_var(--cg-flow-c)]">
                <span aria-hidden className={cn(dot, "-left-1")} />
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.3)] text-ink"><Check className="h-4 w-4" /></span>
                <div className="min-w-0">
                  {d.outcomeTitle && <p className="font-display text-[15px] font-bold leading-snug text-ink">{d.outcomeTitle}</p>}
                  {d.outcomeText && <p className="mt-0.5 text-xs text-muted">{d.outcomeText}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

async function Deals({ d, t }: { d: BlockData<"DEALS">; t: T }) {
  const deals = await liveDeals(d.limit);
  if (!deals.length) return null;
  return (
    <section className="bg-surface py-8 sm:py-9">
      <div className="container">
        <SectionHeading title={d.title} subtitle={d.subtitle} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {deals.map((o) => (
            <li key={o.id}>
              <article className="card-lift relative flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface">
                <div className="flex items-center justify-between gap-3 bg-[linear-gradient(135deg,rgb(var(--color-primary))_0%,rgb(var(--color-primary)/0.8)_100%)] px-4 py-3 text-primary-fg">
                  <span className="font-display text-lg font-extrabold leading-tight">{o.discount}</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold opacity-90"><span className="cg-live" aria-hidden /> Live <Tag className="h-4 w-4 opacity-80" aria-hidden /></span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-3">
                    <SoftwareLogo logo={o.software.logo} name={o.software.name} size={44} />
                    <span className="min-w-0">
                      <span className="block truncate font-display font-bold text-ink">{o.software.name}</span>
                      <span className="block truncate text-xs text-muted">{o.software.vendor?.name ?? o.software.primaryCategory?.name}</span>
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-ink">{o.title}</p>
                  {o.couponCode && (
                    <p className="mt-3 w-fit rounded-control border border-dashed border-accent bg-accent/10 px-2.5 py-1 font-mono text-xs font-bold tracking-wider text-ink">{o.couponCode}</p>
                  )}
                  <div className="min-h-3 flex-1" />
                  <div className="mt-3 flex items-center justify-between border-t border-dashed border-line pt-3 text-xs text-muted">
                    <span>{o.endsAt ? t("blocks.dealEnds", { date: formatDate(o.endsAt) }) : t("blocks.dealNoEnd")}</span>
                    <Link href={`/software/${o.software.slug}#offers`} className="font-semibold text-primary after:absolute after:inset-0 hover:underline">
                      {t("blocks.dealLink")}
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

async function Banners({ d }: { d: BlockData<"BANNER_CAROUSEL"> }) {
  const banners = await getBanners(d.placement);
  if (!banners.length) return null;
  return (
    <section className="container py-6 sm:py-7">
      <div className={cn("grid gap-5", banners.length > 1 && "md:grid-cols-2")}>
        {banners.slice(0, 4).map((b, i) => {
          const tone = b.theme === "dark" ? "bg-band text-white" : b.theme === "light" ? "bg-surface text-ink border border-line" : "bg-primary text-primary-fg";
          const inner = (
            <div className={cn("group relative flex min-h-[12rem] overflow-hidden rounded-panel", tone)}>
              {b.image && <Image src={b.image.url} alt={b.image.alt ?? ""} fill className="object-cover opacity-30" sizes="(min-width: 768px) 50vw, 100vw" />}
              <span aria-hidden className={cn("absolute -bottom-16 -right-10 h-56 w-56 rounded-full border-[28px]", i % 2 ? "border-accent/80" : "border-white/15")} />
              <span aria-hidden className="absolute right-20 top-8 h-10 w-10 rounded-full bg-accent/90" />
              <div className="relative flex max-w-md flex-col justify-end p-7">
                <p className="font-display text-2xl font-bold leading-tight sm:text-[1.7rem]">{b.title}</p>
                {b.subtitle && <p className="mt-2 opacity-85">{b.subtitle}</p>}
                {b.ctaLabel && (
                  <span className="mt-5 inline-flex w-fit items-center gap-1 rounded-control bg-accent px-5 py-2.5 text-sm font-bold text-accent-fg transition group-hover:gap-2">
                    {b.ctaLabel} <ChevronRight className="h-4 w-4" aria-hidden />
                  </span>
                )}
              </div>
            </div>
          );
          return b.ctaUrl ? (
            <Link key={b.id} href={b.ctaUrl} className="block">
              {inner}
            </Link>
          ) : (
            <div key={b.id}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}

async function FeaturedSoftware({ d, s }: { d: BlockData<"FEATURED_SOFTWARE">; s: Settings }) {
  const items = d.source === "manual" ? await cardsByIds(d.softwareIds) : await listSoftware(d.source === "category" ? "popular" : d.source, d.limit, d.source === "category" ? d.categoryId : null);
  if (!items.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title} subtitle={d.subtitle} action={d.viewAllHref ? <ViewAll href={d.viewAllHref} /> : undefined} />
      {d.layout === "rows" ? (
        <div className="space-y-3">
          {items.map((sw) => (
            <SoftwareRow key={sw.id} sw={sw} labels={s.labels} opts={s.listing} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((sw) => (
            <SoftwareTile key={sw.id} sw={sw} labels={s.labels} />
          ))}
        </div>
      )}
    </section>
  );
}

async function SoftwareTabsBlock({ d, s }: { d: BlockData<"SOFTWARE_TABS">; s: Settings }) {
  if (!d.tabs.length) return null;
  const tabs = await Promise.all(d.tabs.map(async (t) => ({ label: t.label, categoryId: t.categoryId, items: await listSoftware("popular", d.limit, t.categoryId) })));
  const cats = await db.category.findMany({ where: { id: { in: d.tabs.map((t) => t.categoryId) } }, select: { id: true, slug: true } });
  const slugOf = new Map(cats.map((c) => [c.id, c.slug]));
  return (
    <section className="container py-8 sm:py-9">
      <SoftwareTabs
        title={d.title}
        tabs={tabs.filter((t) => t.items.length).map((t) => ({
          label: t.label,
          href: `/categories/${slugOf.get(t.categoryId) ?? ""}`,
          content: (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {t.items.map((sw) => (
                <SoftwareTile key={sw.id} sw={sw} labels={s.labels} />
              ))}
            </div>
          ),
        }))}
      />
    </section>
  );
}

async function CategoryGrid({ d, t }: { d: BlockData<"CATEGORY_GRID">; t: T }) {
  const tree = await getCategoryTree();
  const flat = tree.flatMap((c) => [c, ...c.children]);
  const chosen = d.categoryIds.length ? d.categoryIds.map((id) => flat.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => Boolean(c)) : tree;
  const items = chosen.slice(0, d.limit);
  if (!items.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title} subtitle={d.subtitle} action={t("blocks.categoriesLink") ? <ViewAll href="/categories">{t("blocks.categoriesLink")}</ViewAll> : undefined} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 lg:gap-4">
        {items.map((c, i) => (
          <li key={c.id}>
            <Link href={`/categories/${c.slug}`} className="card-lift group flex h-full flex-col items-center rounded-panel border border-line bg-surface px-3 py-5 text-center">
              <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-full transition group-hover:scale-105", CHIP_TONES[i % CHIP_TONES.length])}>
                <Icon name={c.icon} className="h-6 w-6" />
              </span>
              <span className="mt-3 line-clamp-2 text-sm font-semibold leading-snug text-ink group-hover:text-primary">{c.name}</span>
              {d.showCounts && <span className="mt-1 text-xs text-muted">{c.softwareCount + c.children.reduce((n, x) => n + x.softwareCount, 0)} products</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function IndustryGrid({ d, t }: { d: BlockData<"INDUSTRY_GRID">; t: T }) {
  const industries = await db.industry.findMany({
    where: { isActive: true, ...(d.industryIds.length ? { id: { in: d.industryIds } } : {}) },
    orderBy: { sortOrder: "asc" },
    take: d.limit,
    select: { id: true, name: true, slug: true, icon: true, description: true },
  });
  if (!industries.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title} action={t("blocks.industriesLink") ? <ViewAll href="/industries">{t("blocks.industriesLink")}</ViewAll> : undefined} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        {industries.map((i, n) => (
          <li key={i.id}>
            <Link href={`/industries/${i.slug}`} className="card-lift group flex h-full flex-col rounded-panel border border-line bg-surface p-5">
              <span className={cn("grid h-11 w-11 place-items-center rounded-xl", CHIP_TONES[(n + 2) % CHIP_TONES.length])}>
                <Icon name={i.icon} className="h-5 w-5" />
              </span>
              <span className="mt-4">
                <span className="block font-display text-[17px] font-semibold group-hover:text-primary">{i.name}</span>
                {i.description && <span className="mt-0.5 line-clamp-2 block text-sm text-muted">{i.description}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RichText({ d }: { d: BlockData<"RICH_TEXT"> }) {
  if (!d.html) return null;
  // Stored HTML was sanitized on save (src/server/services/cms.ts).
  return (
    <section className="container py-6 sm:py-7">
      <div className={cn("prose-content", d.width === "wide" ? "max-w-none" : "max-w-3xl")} dangerouslySetInnerHTML={{ __html: d.html }} />
    </section>
  );
}

function Cta({ d }: { d: BlockData<"CTA"> }) {
  const dark = d.tone !== "accent" && d.tone !== "plain";
  const tone = d.tone === "accent" ? "bg-accent text-accent-fg" : d.tone === "plain" ? "bg-surface border border-line" : "bg-primary text-primary-fg [&_h2]:text-primary-fg";
  const btn = dark ? "bg-accent text-accent-fg hover:brightness-95" : "bg-primary text-primary-fg hover:bg-primary/90";
  return (
    <section className="cg-fold container py-8 sm:py-9">
      <div className={cn("cg-cta relative flex flex-col gap-8 overflow-hidden rounded-panel px-7 py-10 sm:px-12 md:flex-row md:items-center md:justify-between", tone)}>
        {dark && <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border-[40px] border-white/10" />}
        <div className="relative max-w-2xl">
          <h2 className="text-[1.9rem] font-bold leading-tight text-current sm:text-[2.4rem]">{d.heading}</h2>
          {d.body && <p className="mt-3 text-lg opacity-80">{d.body}</p>}
        </div>
        <div className="relative flex shrink-0 flex-wrap gap-3">
          {d.openLeadForm ? (
            <EnquireButton source="GET_ADVICE" className={cn("cg-glow inline-flex h-12 items-center rounded-control px-7 font-bold", btn)}>
              {d.primaryLabel}
            </EnquireButton>
          ) : d.primaryHref ? (
            <Link href={d.primaryHref} className={cn("cg-glow inline-flex h-12 items-center rounded-control px-7 font-bold", btn)}>
              {d.primaryLabel}
            </Link>
          ) : null}
          {d.secondaryLabel && d.secondaryHref && (
            <Link href={d.secondaryHref} className="inline-flex h-12 items-center rounded-control border border-current/30 px-7 font-semibold hover:bg-white/10">
              {d.secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

async function Testimonials({ d }: { d: BlockData<"TESTIMONIALS"> }) {
  const items = await getTestimonials(d.limit);
  if (!items.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title} center />
      <ul className="grid gap-4 md:grid-cols-3 lg:gap-5">
        {items.map((t) => (
          <li key={t.id}>
            <figure className="relative flex h-full flex-col rounded-panel border border-line bg-surface p-6">
              <span aria-hidden className="absolute right-5 top-2 font-display text-7xl leading-none text-primary/15">“</span>
              {t.rating && <Stars value={t.rating} />}
              <blockquote className="mt-4 flex-1 text-[15px] leading-relaxed text-ink">{t.quote}</blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4 text-sm">
                {t.avatar && <Image src={t.avatar.url} alt="" width={36} height={36} className="rounded-full object-cover" />}
                <span>
                  <span className="block font-medium">{t.name}</span>
                  <span className="text-muted">{[t.role, t.company].filter(Boolean).join(", ")}</span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function Faq({ d, t }: { d: BlockData<"FAQ">; t: T }) {
  const group = await getFaqGroup(d.groupKey);
  if (!group?.items.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title || group.title} subtitle={t("blocks.faqSubtitle") || undefined} />
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {group.items.map((f) => (
          <details key={f.id} className="group rounded-panel border border-line bg-surface px-5 py-4 open:border-primary/30 open:shadow-[0_8px_24px_-16px_rgb(var(--color-ink)/0.35)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {f.question}
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-lg text-primary transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

async function LogoCloud({ d }: { d: BlockData<"LOGO_CLOUD"> }) {
  const vendors = await db.vendor.findMany({
    where: { isActive: true, kind: "VENDOR", logoId: { not: null }, ...(d.vendorIds.length ? { id: { in: d.vendorIds } } : { verification: "VERIFIED" }) },
    take: d.limit,
    select: { id: true, name: true, slug: true, logo: { select: { url: true } } },
  });
  if (!vendors.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title} />
      <div className="cg-marquee" data-rows="2">
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {vendors.map((v) => (
          <li key={v.id} className="[.is-running_&]:w-40">
            <Link href={`/vendors/${v.slug}`} className="flex h-20 items-center justify-center rounded-panel border border-line bg-surface p-3 opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0" title={v.name}>
              {v.logo && <Image src={v.logo.url} alt={v.name} width={120} height={48} className="max-h-12 w-auto object-contain" />}
            </Link>
          </li>
        ))}
      </ul>
      </div>
    </section>
  );
}

function Offers({ d }: { d: BlockData<"OFFERS"> }) {
  if (!d.items.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {d.items.map((o, i) => (
          <li key={i}>
            <Link href={o.href || "#"} className="card-lift relative flex h-full flex-col overflow-hidden rounded-panel border border-line bg-surface p-5 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-accent">
              {o.badge && <span className="w-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-fg">{o.badge}</span>}
              <span className="mt-3 font-display text-lg font-semibold">{o.title}</span>
              {o.description && <span className="mt-1 text-sm text-muted">{o.description}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "Latest software insights" (cadgram.com style): eyebrow + heading, "Visit the blog →", cards with cover, date, title, summary and "Read article →". */
async function BlogPosts({ d: raw, t }: { d: BlockData<"BLOG_POSTS">; t: T }) {
  // Blocks saved before this design had the heading "Buying guides" and no label: show the new defaults.
  // (Only for "any type" blocks: a block set to show guides may deliberately be called "Buying guides".)
  const legacy = (raw.title === "Buying guides" || raw.title === "Buying guides and articles") && (raw.type ?? "ANY") === "ANY";
  const d = legacy ? { ...raw, title: "Latest software insights" } : raw;
  const { items } = await listPublishedPosts({ perPage: d.limit, type: d.type });
  if (!items.length) return null;
  const href = d.type && d.type !== "ANY" ? `/blog?type=${d.type.toLowerCase()}` : "/blog";
  return (
    <section className="container py-8 sm:py-9" aria-labelledby="blog-posts-heading">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          {d.eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{d.eyebrow}</p>}
          <h2 id="blog-posts-heading" className="mt-1 text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.85rem]">{d.title}</h2>
          <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
        </div>
        <ViewAll href={href}>{d.linkLabel || t("blocks.blogLink")}</ViewAll>
      </div>
      <ul className={cn("grid gap-5 sm:grid-cols-2", items.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {items.map((p) => (
          <li key={p.id}>
            <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_12px_32px_-28px_rgb(var(--color-ink)/0.5)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_-26px_rgb(var(--color-ink)/0.45)]">
              <div className="relative aspect-[1200/630] overflow-hidden bg-[linear-gradient(135deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-surface))_100%)]">
                {p.cover ? (
                  <Image src={p.cover.url} alt={p.cover.alt ?? ""} fill className="object-cover transition duration-500 group-hover:scale-[1.03]" sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center text-primary/70" aria-hidden><BookOpen className="h-9 w-9" /></span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <p className="text-xs text-muted">
                  {formatDate(p.publishedAt)}
                  {p.category?.name && <span className="font-semibold text-accent"> · {p.category.name}</span>}
                </p>
                <h3 className="mt-2 line-clamp-3 text-[17px] font-bold leading-snug text-ink">
                  <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{p.title}</Link>
                </h3>
                {p.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{p.excerpt}</p>}
                <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-primary">
                  {t("blocks.readArticle")} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                </span>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stats({ d }: { d: BlockData<"STATS"> }) {
  if (!d.items.length) return null;
  return (
    <section className="container py-6 sm:py-7">
      <dl className="cg-stats grid grid-cols-2 overflow-hidden rounded-panel border border-line bg-surface md:grid-cols-4">
        {d.items.map((it, i) => (
          <div key={i} className={cn("flex flex-col-reverse gap-1 p-6 sm:p-8", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line md:border-t-0", i === 2 && "md:border-l")}>
            <dt className="text-sm text-muted">{it.label}</dt>
            <dd data-countup className="font-display text-[2.2rem] font-extrabold leading-none tracking-tight text-primary tabular-nums">{it.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function Comparisons({ d }: { d: BlockData<"COMPARISONS"> }) {
  const items = await listPublishedComparisons(d.limit);
  if (!items.length) return null;
  return (
    <section className="container py-8 sm:py-9">
      <SectionHeading title={d.title} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <li key={c.slug}>
            <ComparisonCard c={c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function LeadFormBlock({ d, s }: { d: BlockData<"LEAD_FORM">; s: Settings }) {
  return (
    <section className="container py-8 sm:py-9">
      <div className="grid gap-8 overflow-hidden rounded-panel border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-2xl font-semibold sm:text-3xl">{d.title}</h2>
          {(d.subtitle || s.labels.leadFormSubtitle) && <p className="mt-2 text-muted">{d.subtitle || s.labels.leadFormSubtitle}</p>}
        </div>
        <LeadForm
          source="CMS_FORM"
          config={{ consentText: s.leads.consentText, companySizes: s.leads.companySizes, successMessage: s.labels.leadSuccess, submitLabel: s.labels.enquireCta, requireCompany: s.leads.requireCompany }}
        />
      </div>
    </section>
  );
}

/** Renders CMS sections in order. Each block fetches its own data. */
export async function Blocks({ sections }: { sections: ResolvedSection[] }) {
  const s = await getSettings();
  const t = makeT(s.texts);
  return (
    <>
      {sections.map((sec) => (
        <EditableSection key={sec.id} id={sec.id}>{renderBlock(sec, s, t)}</EditableSection>
      ))}
    </>
  );
}

/** Sections pasted into a Free layout's columns, rendered here on the server (they load live data). */
function layoutSlots(data: LayoutData, s: Settings, t: ReturnType<typeof makeT>) {
  const slots: Record<string, React.ReactNode> = {};
  for (const r of data.rows ?? []) {
    for (const c of r.columns) {
      for (const w of c.widgets) {
        if (w.type !== "section") continue;
        const bt = String(w.props.blockType ?? "");
        if (!isBlockType(bt) || bt === "LAYOUT") continue;
        const parsed = blockSchemas[bt].safeParse(w.props.data ?? {});
        if (parsed.success) slots[w.id] = renderBlock({ id: w.id, type: bt, data: parsed.data as Record<string, unknown> }, s, t);
      }
    }
  }
  return slots;
}

/** One page section (wrapped by EditableSection for the website's edit mode). */
function renderBlock(sec: ResolvedSection, s: Settings, t: ReturnType<typeof makeT>) {
        const d = sec.data as never;
        switch (sec.type) {
          case "HERO": return <Hero key={sec.id} d={d} s={s} sectionId={sec.id} />;
          case "BANNER_CAROUSEL": return <Banners key={sec.id} d={d} />;
          case "FEATURED_SOFTWARE": return <FeaturedSoftware key={sec.id} d={d} s={s} />;
          case "SOFTWARE_TABS": return <SoftwareTabsBlock key={sec.id} d={d} s={s} />;
          case "CATEGORY_GRID": return <CategoryGrid key={sec.id} d={d} t={t} />;
          case "INDUSTRY_GRID": return <IndustryGrid key={sec.id} d={d} t={t} />;
          case "RICH_TEXT": return <RichText key={sec.id} d={d} />;
          case "CTA": return <Cta key={sec.id} d={d} />;
          case "TESTIMONIALS": return <Testimonials key={sec.id} d={d} />;
          case "FAQ": return <Faq key={sec.id} d={d} t={t} />;
          case "LOGO_CLOUD": return <LogoCloud key={sec.id} d={d} />;
          case "OFFERS": return <Offers key={sec.id} d={d} />;
          case "BLOG_POSTS": return <BlogPosts key={sec.id} d={d} t={t} />;
          case "STATS": return <Stats key={sec.id} d={d} />;
          case "COMPARISONS": return <Comparisons key={sec.id} d={d} />;
          case "LEAD_FORM": return <LeadFormBlock key={sec.id} d={d} s={s} />;
          case "HOW_IT_WORKS": return <HowItWorks key={sec.id} d={d} />;
          case "FLOW_DIAGRAM": return <FlowDiagram key={sec.id} d={d} s={s} />;
          case "DEALS": return <Deals key={sec.id} d={d} t={t} />;
          case "LAYOUT": return <FreeLayout key={sec.id} sectionId={sec.id} data={d} slots={layoutSlots(sec.data as unknown as LayoutData, s, t)} />;
          default: return null;
        }
}
