import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Check, Star } from "lucide-react";
import type { SoftwareCard as Card } from "@/server/services/catalog";
import type { Settings } from "@/server/settings/schemas";
import { DEPLOYMENT_LABEL, formatPrice, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge, Stars } from "@/components/ui/misc";
import { CompareCheckbox } from "./compare-controls";
import { EnquireButton } from "./lead-dialog";
import { Tx } from "./texts";

type Labels = Settings["labels"];
type ListingOpts = Pick<Settings["listing"], "showVendorName" | "showStartingPrice" | "showRating" | "showCompareCheckbox">;

export function SoftwareLogo({ logo, name, size = 48 }: { logo: { url: string; alt?: string | null } | null; name: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-surface shadow-[0_2px_6px_-3px_rgb(var(--color-ink)/0.2)]" style={{ width: size, height: size }}>
      {logo ? (
        <Image src={logo.url} alt={logo.alt || `${name} logo`} width={size} height={size} className="h-full w-full object-contain p-1.5" />
      ) : (
        <span className="grid h-full w-full place-items-center bg-primary-soft font-display text-lg font-bold text-primary" aria-hidden>
          {name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}

function PriceLine({ sw, compact }: { sw: Card; compact?: boolean }) {
  const price = toNumber(sw.startingPrice);
  if (price && price > 0)
    return (
      <p className={cn("leading-tight", compact ? "text-sm" : "text-[15px]")}>
        <span className="block text-[11px] font-medium text-muted"><Tx k="card.startingFrom" /></span>
        <span className="font-display font-bold text-ink">{formatPrice(price, sw.currency)}</span>
        {sw.priceUnit && <span className="text-xs text-muted"> {sw.priceUnit}</span>}
      </p>
    );
  if (sw.pricingModel === "QUOTE_BASED" || price === null)
    return (
      <p className="text-sm leading-tight">
        <span className="block text-[11px] font-medium text-muted"><Tx k={`labels.pricing_${sw.pricingModel}`} /></span>
        <span className="font-semibold text-ink"><Tx k="card.priceOnRequest" /></span>
      </p>
    );
  return (
    <p className="text-sm leading-tight">
      <span className="block text-[11px] font-medium text-muted"><Tx k="card.pricing" /></span>
      <span className="font-display font-bold text-success"><Tx k="card.free" /></span>
    </p>
  );
}

function RatingPill({ sw }: { sw: Card }) {
  const rating = toNumber(sw.ratingAvg) ?? 0;
  if (sw.ratingCount === 0) return <span className="text-xs text-muted"><Tx k="card.noReviews" /></span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className="inline-flex items-center gap-0.5 rounded bg-success px-1.5 py-0.5 text-xs font-bold text-white">
        {rating.toFixed(1)} <Star className="h-3 w-3" fill="currentColor" strokeWidth={0} aria-hidden />
      </span>
      <Stars value={rating} />
      <Link href={`/software/${sw.slug}#reviews`} className="relative z-10 text-xs text-muted hover:text-primary">
        ({sw.ratingCount} <Tx k={sw.ratingCount === 1 ? "card.review" : "card.reviews"} />)
      </Link>
    </span>
  );
}

export interface SubScores {
  ease: number | null;
  value: number | null;
  features: number | null;
  support: number | null;
}

const SCORE_LABELS: [keyof SubScores, string][] = [
  ["ease", "product.aspectEase"],
  ["value", "product.aspectValue"],
  ["features", "product.aspectFeatures"],
  ["support", "product.aspectSupport"],
];

/** Four aspect scores as thin bars (only aspects someone rated). */
export function ScoreBars({ scores, className }: { scores: SubScores | undefined; className?: string }) {
  const rows = SCORE_LABELS.filter(([k]) => scores?.[k] != null);
  if (!scores || !rows.length) return null;
  return (
    <dl className={cn("grid grid-cols-2 gap-x-5 gap-y-1.5", className)}>
      {rows.map(([k, label]) => {
        const v = scores[k] as number;
        return (
          <div key={k} className="min-w-0">
            <dt className="flex justify-between text-[11px] text-muted">
              <span className="truncate"><Tx k={label} /></span>
              <span className="font-semibold text-ink">{v.toFixed(1)}</span>
            </dt>
            <dd className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-line">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${(v / 5) * 100}%` }} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Listing card used on category, search and classification pages. */
export function SoftwareRow({ sw, labels, opts, scores, rank }: { sw: Card; labels: Labels; opts: ListingOpts; scores?: SubScores; rank?: number }) {
  const trial = sw.hasFreeTrial ? labels.freeTrialBadge : sw.hasFreeVersion ? labels.freeVersionBadge : null;
  const facts: { key: string; node: React.ReactNode }[] = [
    ...(sw.deployment ?? []).map((d) => ({ key: d, node: d in DEPLOYMENT_LABEL ? <Tx k={`labels.deployment_${d}`} /> : d })),
    ...(trial ? [{ key: "trial", node: trial }] : []),
  ];
  return (
    <article className="group relative rounded-panel border border-line bg-surface transition hover:border-primary/40 hover:shadow-[0_12px_32px_-18px_rgb(var(--color-ink)/0.35)]">
      {sw.isSponsored && <span className="absolute right-0 top-0 rounded-bl-control rounded-tr-panel bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-muted">{labels.sponsoredLabel}</span>}
      <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[auto_1fr_13rem]">
        <div className="flex items-start gap-4 md:flex-col md:items-center">
          <div className="relative">
            <SoftwareLogo logo={sw.logo} name={sw.name} size={84} />
            {rank != null && <span className="absolute -left-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1 text-xs font-bold text-accent-fg">{rank}</span>}
          </div>
          {opts.showCompareCheckbox && (
            <div className="hidden md:block">
              <CompareCheckbox item={{ slug: sw.slug, name: sw.name, logoUrl: sw.logo?.url ?? null }} label={labels.compareCta} />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pr-16">
            <h3 className="font-display text-lg font-bold leading-tight">
              <Link href={`/software/${sw.slug}`} className="hover:text-primary">
                {sw.name}
              </Link>
            </h3>
            {sw.isTrending && <Badge tone="accent"><Tx k="card.trending" /></Badge>}
          </div>
          {opts.showVendorName && sw.vendor && (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <Tx k="card.by" /> <Link href={`/vendors/${sw.vendor.slug}`} className="font-medium text-ink/80 hover:text-primary">{sw.vendor.name}</Link>
              {sw.vendor.verification === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5 text-primary" aria-label={labels.verifiedLabel} />}
            </p>
          )}
          {opts.showRating && <div className="mt-2"><RatingPill sw={sw} /></div>}
          <ScoreBars scores={scores} className="mt-3 max-w-md" />
          {(sw.shortDescription || sw.tagline) && (
            <p className="mt-3 line-clamp-2 max-w-prose text-sm text-muted">
              {sw.shortDescription ?? sw.tagline}{" "}
              <Link href={`/software/${sw.slug}`} className="font-semibold text-primary hover:underline"><Tx k="card.readMore" /></Link>
            </p>
          )}
          {facts.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {facts.map((f) => (
                <li key={f.key} className="inline-flex items-center gap-1 rounded-control bg-bg px-2 py-0.5 text-xs text-ink/80">
                  <Check className="h-3 w-3 text-success" aria-hidden /> {f.node}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-3 border-t border-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          {opts.showStartingPrice && <PriceLine sw={sw} />}
          <div className="flex flex-col gap-2">
            <EnquireButton type="DEMO" softwareSlugs={[sw.slug]} productName={sw.name} source="CATEGORY_PAGE" title={labels.demoCta} className="h-10 rounded-control border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-fg">
              {labels.demoCta}
            </EnquireButton>
            <EnquireButton type="QUOTE" softwareSlugs={[sw.slug]} productName={sw.name} source="CATEGORY_PAGE" className="h-10 rounded-control bg-accent px-4 text-sm font-bold text-accent-fg hover:brightness-95">
              {labels.enquireCta}
            </EnquireButton>
          </div>
          {opts.showCompareCheckbox && (
            <div className="md:hidden">
              <CompareCheckbox item={{ slug: sw.slug, name: sw.name, logoUrl: sw.logo?.url ?? null }} label={labels.compareCta} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/** Product card for grids (homepage blocks, related products). */
export function SoftwareTile({ sw, labels, className }: { sw: Card; labels: Labels; className?: string }) {
  return (
    <article className={cn("card-lift relative flex flex-col rounded-panel border border-line bg-surface p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <SoftwareLogo logo={sw.logo} name={sw.name} size={60} />
        {sw.isSponsored ? <Badge>{labels.sponsoredLabel}</Badge> : sw.hasFreeTrial ? <Badge tone="success">{labels.freeTrialBadge}</Badge> : sw.isTrending ? <Badge tone="accent"><Tx k="card.trending" /></Badge> : null}
      </div>
      <h3 className="mt-4 font-display text-[17px] font-bold leading-snug">
        <Link href={`/software/${sw.slug}`} className="after:absolute after:inset-0 after:rounded-panel hover:text-primary">
          {sw.name}
        </Link>
      </h3>
      <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
        {sw.vendor ? <><Tx k="card.by" /> {sw.vendor.name}{sw.vendor.verification === "VERIFIED" && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-primary" aria-label={labels.verifiedLabel} />}</> : sw.primaryCategory?.name}
      </p>
      <div className="mt-2.5"><RatingPill sw={sw} /></div>
      {sw.tagline && <p className="mt-2.5 line-clamp-2 text-sm text-muted">{sw.tagline}</p>}
      <div className="min-h-4 flex-1" />
      <div className="mt-2 border-t border-dashed border-line pt-4">
        <PriceLine sw={sw} compact />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <EnquireButton type="DEMO" softwareSlugs={[sw.slug]} productName={sw.name} source="CATEGORY_PAGE" title={labels.demoCta} className="relative z-10 h-9 rounded-control border border-primary px-2 text-xs font-semibold text-primary hover:bg-primary hover:text-primary-fg">
            {labels.demoCta}
          </EnquireButton>
          <EnquireButton type="QUOTE" softwareSlugs={[sw.slug]} productName={sw.name} source="CATEGORY_PAGE" className="relative z-10 h-9 rounded-control bg-accent px-2 text-xs font-bold text-accent-fg hover:brightness-95">
            {labels.enquireCta}
          </EnquireButton>
        </div>
      </div>
    </article>
  );
}
