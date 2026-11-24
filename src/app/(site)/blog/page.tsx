import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { blogTopics, blogTopStories, listPublishedPosts, type PostCard } from "@/server/services/blog";
import { buildMetadata, listingIndexing } from "@/server/seo/metadata";
import { collectionPageLd } from "@/server/seo/jsonld";
import { JsonLd } from "@/components/site/json-ld";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/misc";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ListSearch } from "@/components/site/list-search";
import { type T } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";

type Props = { searchParams: Promise<{ page?: string; category?: string; tag?: string; type?: string; q?: string }> };

const TYPE_KEY: Record<string, string> = { GUIDE: "blog.typeGuide", NEWS: "blog.typeNews", RESOURCE: "blog.typeResource", ARTICLE: "blog.typeArticle" };
const TYPE_KEYS = ["guide", "news", "resource"];
const typeChips = (tr: T) => [
  { key: "guide", label: tr("blog.filterGuides") },
  { key: "news", label: tr("blog.filterNews") },
  { key: "resource", label: tr("blog.filterResources") },
];

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  const idx = listingIndexing("/blog", sp);
  const tr = await getT();
  return buildMetadata({
    path: idx.path,
    title: `${tr("blog.metaTitle")}${idx.page > 1 ? tr("blog.metaPage", { page: idx.page }) : ""}`,
    description: tr("blog.metaDescription"),
    noIndex: idx.noIndex,
  });
}

/* ─── Cards ─────────────────────────────────────────────────────────────── */
// Covers are 1200×630 pictures, often with the title printed on them: every cover box keeps that shape (aspect-[1200/630]) so nothing is cropped off.

function Cover({ post, className, sizes, priority }: { post: PostCard; className?: string; sizes: string; priority?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden bg-[linear-gradient(135deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-surface))_100%)]", className)}>
      {post.cover ? (
        <Image src={post.cover.url} alt={post.cover.alt ?? ""} fill className="object-cover transition duration-500 group-hover:scale-[1.03]" sizes={sizes} priority={priority} />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-primary/70" aria-hidden>
          <BookOpen className="h-9 w-9" />
        </span>
      )}
    </div>
  );
}

const kicker = (p: PostCard, tr: T) => p.category?.name ?? tr(TYPE_KEY[p.type] ?? "blog.typeArticle");

async function Meta({ post }: { post: PostCard }) {
  const tr = await getT();
  return (
    <p className="text-xs text-muted">
      {post.publishedAt ? formatDate(post.publishedAt) : null}
      {post.readingMinutes ? <> · {tr("blog.minRead", { minutes: post.readingMinutes })}</> : null}
    </p>
  );
}

async function Kicker({ post }: { post: PostCard }) {
  const tr = await getT();
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
      {kicker(post, tr)}
      {post.type === "GUIDE" && post.category && !/guide/i.test(post.category.name) ? <span className="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] tracking-wide text-primary">{tr("blog.guideTag")}</span> : null}
    </p>
  );
}

/** Grid card: cover on top, then topic, title, summary, date. */
function PostTile({ post }: { post: PostCard }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgb(var(--color-ink)/0.45)]">
      <Cover post={post} className="aspect-[1200/630]" sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" />
      <div className="flex flex-1 flex-col p-4">
        <Kicker post={post} />
        <h3 className="mt-2 line-clamp-3 text-[15px] font-bold leading-snug text-ink">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{post.title}</Link>
        </h3>
        {post.excerpt && <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{post.excerpt}</p>}
        <div className="mt-auto pt-4"><Meta post={post} /></div>
      </div>
    </article>
  );
}

/** Compact card: small cover on the left (kept at the covers' 1200×630 shape so their printed title is not cut), text on the right. */
function PostRow({ post }: { post: PostCard }) {
  return (
    <article className="group relative flex h-full overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgb(var(--color-ink)/0.45)]">
      <Cover post={post} className="m-3 mr-0 aspect-[1200/630] w-32 shrink-0 self-start rounded-xl sm:w-36" sizes="144px" />
      <div className="flex min-w-0 flex-col p-4">
        <Kicker post={post} />
        <h3 className="mt-1.5 line-clamp-3 text-sm font-bold leading-snug text-ink">
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{post.title}</Link>
        </h3>
        <div className="mt-auto pt-3"><Meta post={post} /></div>
      </div>
    </article>
  );
}

function SectionTitle({ eyebrow, title, id, action }: { eyebrow: string; title: string; id: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-[1.6rem] font-extrabold leading-tight tracking-[-0.01em] text-ink sm:text-[2rem]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

/**
 * Blog home, magazine style (cadgram.com/blog): "What matters now" lead story with four more,
 * "Latest articles" grid with pages, and "Specialist coverage" — three posts per topic.
 * With a topic, type, tag or search selected it becomes a plain filtered grid.
 */
export default async function BlogIndex({ searchParams }: Props) {
  const sp = await searchParams;
  const tr = await getT();
  const TYPES = typeChips(tr);
  const page = Math.max(1, Number(sp.page) || 1);
  const type = sp.type && TYPE_KEYS.includes(sp.type) ? sp.type.toUpperCase() : undefined;
  const filtered = Boolean(sp.category || sp.tag || type || sp.q);
  const showTop = !filtered && page === 1;

  const [top, topics] = await Promise.all([filtered ? Promise.resolve([]) : blogTopStories(5), blogTopics(3)]);
  const { items, pages, total } = await listPublishedPosts({
    page,
    perPage: 8,
    categorySlug: sp.category,
    tagSlug: sp.tag,
    type,
    q: sp.q?.slice(0, 80),
    // The top stories aren't repeated in "Latest".
    excludeIds: filtered ? undefined : top.map((p) => p.id),
  });
  const [lead, ...side] = top;
  const activeTopic = topics.find((t) => t.slug === sp.category);
  const activeType = TYPES.find((t) => t.key === sp.type);
  const listTitle = sp.q ? tr("blog.results", { q: sp.q }) : activeTopic ? activeTopic.name : activeType ? activeType.label : tr("blog.latestTitle");
  const chip = "inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold transition";

  return (
    <EditRegion label="Blog" actions={[{ label: "Edit posts", href: "/admin/blog" }, { label: "Blog categories", href: "/admin/blog/categories" }, { label: "Wording", href: "/admin/cms/texts?group=blog" }]}>
    <>
      <JsonLd data={collectionPageLd({ name: listTitle, path: "/blog", description: tr("blog.ldDescription"), items: [...(showTop ? top : []), ...items].map((p) => ({ name: p.title, path: `/blog/${p.slug}` })) })} />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-[linear-gradient(180deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-surface))_100%)]">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
        <div className="container relative py-10 sm:py-14">
          <Breadcrumbs items={[{ name: tr("blog.breadcrumb"), path: "/blog" }]} />
          <div className="mt-6 grid items-end gap-6 lg:grid-cols-[1fr_24rem]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{tr("blog.eyebrow")}</p>
              <h1 className="mt-2 text-[clamp(2.2rem,5vw,3.4rem)] font-extrabold tracking-[-0.02em] text-ink">{tr("blog.heading")}</h1>
              <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
              <p className="mt-3 max-w-2xl text-base text-muted sm:text-lg">{tr("blog.lead")}</p>
            </div>
            <ListSearch placeholder={tr("blog.searchPlaceholder")} basePath="/blog" params={sp} scopeLabel={tr("blog.searchScope")} anchor="latest" className="w-full [&_input]:h-12 [&_input]:rounded-2xl [&_input]:shadow-[0_16px_36px_-24px_rgb(var(--color-ink)/0.45)]" />
          </div>
          <nav aria-label={tr("blog.topicsNav")} className="mt-7 flex flex-wrap gap-2">
            <Link href="/blog" className={cn(chip, !filtered ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-ink hover:border-primary hover:text-primary")}>{tr("blog.all")}</Link>
            {TYPES.map((t) => (
              <Link key={t.key} href={`/blog?type=${t.key}#latest`} className={cn(chip, sp.type === t.key ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-ink hover:border-primary hover:text-primary")}>{t.label}</Link>
            ))}
            {topics.filter((c) => !TYPES.some((t) => t.label.toLowerCase() === c.name.toLowerCase())).map((c) => (
              <Link key={c.slug} href={`/blog?category=${c.slug}#latest`} className={cn(chip, sp.category === c.slug ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface text-ink hover:border-primary hover:text-primary")}>{c.name}</Link>
            ))}
          </nav>
        </div>
      </section>

      <div className="bg-bg">
        <div className="container space-y-14 py-10 sm:py-14">
          {/* What matters now */}
          {showTop && lead && (
            <section aria-labelledby="top-stories">
              <SectionTitle eyebrow={tr("blog.topEyebrow")} title={tr("blog.topTitle")} id="top-stories" />
              <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
                <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface transition hover:shadow-[0_24px_50px_-30px_rgb(var(--color-ink)/0.5)]">
                  <Cover post={lead} className="aspect-[1200/630]" sizes="(min-width:1024px) 58vw, 100vw" priority />
                  <div className="flex flex-1 flex-col p-6">
                    <Kicker post={lead} />
                    <h3 className="mt-2 text-[1.6rem] font-extrabold leading-tight tracking-[-0.01em] text-ink sm:text-[2rem]">
                      <Link href={`/blog/${lead.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{lead.title}</Link>
                    </h3>
                    {lead.excerpt && <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-muted">{lead.excerpt}</p>}
                    <div className="mt-auto pt-5"><Meta post={lead} /></div>
                  </div>
                </article>
                {side.length > 0 && (
                  <ul className="grid gap-5 sm:grid-cols-2">
                    {side.map((p) => (
                      <li key={p.id}>
                        <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-26px_rgb(var(--color-ink)/0.45)]">
                          <Cover post={p} className="aspect-[1200/630]" sizes="(min-width:1024px) 20vw, 50vw" />
                          <div className="flex flex-1 flex-col p-4">
                            <Kicker post={p} />
                            <h3 className="mt-1.5 line-clamp-3 text-sm font-bold leading-snug text-ink">
                              <Link href={`/blog/${p.slug}`} className="after:absolute after:inset-0 group-hover:text-primary">{p.title}</Link>
                            </h3>
                            <div className="mt-auto pt-3"><Meta post={p} /></div>
                          </div>
                        </article>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {/* Latest / filtered grid (hidden when every post is already a top story) */}
          {(filtered || items.length > 0 || page > 1) && (
          <section id="latest" className="scroll-mt-44" aria-labelledby="latest-heading">
            <SectionTitle
              eyebrow={filtered ? (total === 1 ? tr("blog.countOne") : tr("blog.count", { count: total })) : tr("blog.latestEyebrow")}
              title={listTitle}
              id="latest-heading"
              action={
                filtered ? (
                  <Link href="/blog" className="text-sm font-bold text-primary hover:underline">{tr("blog.showEverything")}</Link>
                ) : topics.length > 0 ? (
                  <a href="#topics" className="inline-flex items-center gap-1 text-sm font-bold text-primary">{tr("blog.browseTopics")} <ArrowRight className="h-4 w-4" aria-hidden /></a>
                ) : null
              }
            />
            {activeTopic?.description && <p className="-mt-3 mb-6 max-w-2xl text-muted">{activeTopic.description}</p>}
            {items.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line bg-surface">
                <EmptyState title={sp.q ? tr("blog.noMatch", { q: sp.q }) : tr("blog.empty")}>{sp.q ? tr("blog.noMatchText") : tr("blog.emptyText")}</EmptyState>
              </div>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((p) => (
                  <li key={p.id}><PostTile post={p} /></li>
                ))}
              </ul>
            )}
            <div className="mt-8"><Pagination page={page} pages={pages} basePath="/blog" params={sp} boxed anchor="latest" /></div>
          </section>
          )}

          {/* Specialist coverage */}
          {!filtered && topics.length > 0 && (
            <section id="topics" className="scroll-mt-44" aria-labelledby="topics-heading">
              <SectionTitle eyebrow={tr("blog.topicsEyebrow")} title={tr("blog.topicsTitle")} id="topics-heading" />
              <div className="space-y-10 border-t-2 border-ink pt-6">
                {topics.map((t) => (
                  <div key={t.slug}>
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h3 className="font-display text-xl font-extrabold text-ink">{t.name}</h3>
                        <p className="mt-0.5 text-sm text-muted">{t.description || tr("blog.topicFallback", { topic: t.name })}</p>
                      </div>
                      <Link href={`/blog?category=${t.slug}#latest`} className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                        {tr("blog.viewAll")}{t.total > 3 ? ` ${t.total}` : ""} <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </div>
                    <ul className="grid gap-4 md:grid-cols-3">
                      {t.posts.map((p) => (
                        <li key={p.id}><PostRow post={p} /></li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
    </EditRegion>
  );
}
