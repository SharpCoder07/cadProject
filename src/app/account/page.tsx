import Link from "next/link";
import { ArrowRight, Heart, MessageSquareText, Star, Tag } from "lucide-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { Alert, Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { StatCard } from "@/components/admin/dashboard-cards";

export const metadata = { title: "Dashboard" };

const REVIEW_STATUS = {
  PENDING: { label: "Waiting for approval", tone: "warning" },
  APPROVED: { label: "Published", tone: "success" },
  REJECTED: { label: "Not published", tone: "danger" },
} as const;

/** Buyer dashboard: favourites, live offers on them, and reviews at a glance. */
export default async function AccountOverview({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireUser("/account");
  const { welcome } = await searchParams;
  const now = new Date();
  const liveOffer = { status: "PUBLISHED" as const, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] };
  const [favCount, offers, reviewStats, recentReviews, me] = await Promise.all([
    db.productFavourite.count({ where: { userId: user.id } }),
    db.productOffer.findMany({
      where: { ...liveOffer, software: { status: "PUBLISHED", favouritedBy: { some: { userId: user.id } } } },
      orderBy: { startsAt: "desc" },
      take: 6,
      select: { id: true, title: true, discount: true, couponCode: true, endsAt: true, software: { select: { name: true, slug: true, logo: { select: { url: true } } } } },
    }),
    db.review.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true }, orderBy: { status: "asc" } }),
    db.review.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4, select: { id: true, title: true, rating: true, status: true, createdAt: true, software: { select: { name: true, slug: true } } } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { offerEmails: true, totpEnabledAt: true } }),
  ]);
  const reviewCount = (s?: string) =>
    reviewStats.filter((r) => !s || r.status === s).reduce((n, r) => n + (typeof r._count === "object" && r._count ? r._count._all ?? 0 : 0), 0);


  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.375rem] font-bold leading-tight tracking-[-0.015em] sm:text-2xl">Welcome back, <span className="text-[#0F766E] dark:text-teal-300">{user.name.split(" ")[0]}</span></h1>
          <p className="mt-1 text-sm text-muted">Your favourites, live offers and reviews at a glance.</p>
        </div>
        <ButtonLink size="sm" href="/categories" variant="secondary">Browse software</ButtonLink>
      </div>
      {welcome && (
        <Alert tone="success" className="mb-4" title="Your account is ready">
          Tap the heart on any product page to save it to your favourites — we&apos;ll email you when it launches an offer.
        </Alert>
      )}
      {!me.offerEmails && favCount > 0 && (
        <Alert tone="info" className="mb-4">
          Offer emails are off, so you won&apos;t hear about new deals on your favourites. <Link href="/account/favourites" className="font-medium underline">Turn them on</Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Favourite products" value={formatNumber(favCount)} icon={Heart} chip="red" href="/account/favourites" sub="Products you follow" />
        <StatCard label="Live offers" value={formatNumber(offers.length)} valueClass="text-success" chip="green" icon={Tag} href="/account/favourites" sub="On your favourites" />
        <StatCard label="Reviews written" value={formatNumber(reviewCount())} icon={MessageSquareText} href="/account/reviews" sub={`${formatNumber(reviewCount("PENDING"))} waiting for approval`} />
        <StatCard label="Reviews published" value={formatNumber(reviewCount("APPROVED"))} icon={Star} href="/account/reviews?status=APPROVED" sub="Live on product pages" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader title="Live offers on your favourites" actions={<Link href="/account/favourites" className="text-sm font-semibold text-ink hover:underline">View all</Link>} />
          {offers.length === 0 ? (
            <EmptyState title={favCount ? "No live offers right now" : "No favourites yet"} icon={<Tag className="h-6 w-6" />}>
              {favCount ? "We'll email you as soon as one of your favourites launches an offer." : "Save products with the heart on their page and their offers will show up here."}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {offers.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                  {o.software.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small uploaded logo
                    <img src={o.software.logo.url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-line bg-white object-contain p-1" />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink/5 text-sm font-semibold text-muted">{o.software.name.slice(0, 1)}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{o.software.name}</p>
                    <p className="truncate text-xs text-muted">
                      <span className="font-semibold text-success">{o.discount}</span> · {o.title}
                      {o.couponCode && <> · <span className="font-mono">{o.couponCode}</span></>}
                      {o.endsAt && <> · until {formatDate(o.endsAt)}</>}
                    </p>
                  </div>
                  <Link href={`/software/${o.software.slug}#offers`} target="_blank" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
                    View <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Your recent reviews" actions={<Link href="/account/reviews" className="text-sm font-semibold text-ink hover:underline">View all</Link>} />
          {recentReviews.length === 0 ? (
            <EmptyState title="No reviews yet" icon={<MessageSquareText className="h-6 w-6" />}>
              Used a product listed here? Open its page and choose <strong>Write a review</strong>.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {recentReviews.map((r) => {
                const st = REVIEW_STATUS[r.status as keyof typeof REVIEW_STATUS] ?? REVIEW_STATUS.PENDING;
                return (
                  <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{r.title}</p>
                      <p className="truncate text-xs text-muted">{r.software.name} · {r.rating}★ · {formatDate(r.createdAt)}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {!me.totpEnabledAt && (
        <Panel className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5">
            <div>
              <p className="text-sm font-semibold text-ink">Protect your account with two-step verification</p>
              <p className="text-sm text-muted">Optional: a code from an authenticator app each time you sign in.</p>
            </div>
            <ButtonLink size="sm" href="/account/settings" variant="secondary">Set it up</ButtonLink>
          </div>
        </Panel>
      )}
    </>
  );
}
