import { Fragment } from "react";
import Link from "next/link";
import { Check, Minus, Star, Trophy } from "lucide-react";
import type { comparisonData } from "@/server/services/catalog";
import type { Settings } from "@/server/settings/schemas";
import { formatPrice, toNumber } from "@/lib/format";
import { SoftwareLogo } from "./software-card";
import { Icon } from "@/components/ui/icon";
import { EnquireButton } from "./lead-dialog";
import { CompareRemoveLink } from "./compare-picker";
import { makeT, type T } from "@/lib/site-texts";
import { billingLabel, deploymentLabel, pricingLabel } from "@/lib/enum-labels";

type Data = Awaited<ReturnType<typeof comparisonData>>;

const yes = (t: T) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 py-1 pl-1.5 pr-3 text-[13px] font-semibold text-success">
    <span className="grid h-5 w-5 place-items-center rounded-full bg-success text-white"><Check className="h-3 w-3" strokeWidth={3.5} aria-hidden /></span>
    {t("compareTable.yes")}
  </span>
);
const no = (t: T) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] py-1 pl-1.5 pr-3 text-[13px] font-semibold text-muted">
    <span className="grid h-5 w-5 place-items-center rounded-full bg-ink/10 text-muted"><Minus className="h-3 w-3" strokeWidth={3.5} aria-hidden /></span>
    {t("compareTable.no")}
  </span>
);
/** Row label column: pinned on small screens, readable dark text. */
const LABEL = "sticky left-0 z-10 w-52 min-w-[10.5rem] border-r border-line bg-bg px-5 py-4 text-left align-middle text-[13.5px] font-semibold text-ink/80";
/** A value cell; columns after the first get a divider line. */
const cellClass = (i: number) => `px-5 py-4 align-middle text-[14px] font-medium leading-relaxed text-ink${i > 0 ? " border-l border-line/70" : ""}`;
const ROW = "cg-fo-row border-t border-line/80 transition-colors even:bg-bg/40 hover:bg-primary-soft/25";

/** Running state while the rows are built: row number (for the sweep's timing) and wins per product. */
interface Tally { r: number; wins: number[]; decided: number }

/** The one product that is best on a row (highest score), or null when it's a tie or there's nothing to compare. */
function winnerOf(scores: (number | null)[]): number | null {
  const known = scores.map((s, i) => [s, i] as const).filter((x): x is readonly [number, number] => x[0] !== null);
  if (known.length < 2) return null;
  const top = Math.max(...known.map(([s]) => s));
  const at = known.filter(([s]) => s === top);
  return at.length === 1 ? at[0]![1] : null;
}

const WIN = "cg-win relative";
const winMark = (t: T) => <Trophy className="cg-win-mark ml-1.5 inline h-3.5 w-3.5 align-[-2px] text-primary" aria-label={t("compareTable.best")} />;

/**
 * Side-by-side comparison card: product heads, then pricing, deployment, plans, comparable
 * attributes (grouped) and top features. Scrolls sideways on small screens with the label column pinned.
 * Face-off (design concept 05, app/motion.css .cg-fo-*): when the table comes into view the products slide in
 * from the sides, "VS" badges pop between them, a light sweeps down the rows, the best value in each comparable
 * row turns teal and a verdict pops in. Winners are worked out here, so they show without animation too.
 */
export function CompareTable({ data, labels, texts, editable, heading }: { data: Data; labels: Settings["labels"]; texts?: Record<string, string>; editable: boolean; heading?: string }) {
  const t = makeT(texts);
  const { products, attrRows } = data;
  const slugs = products.map((p) => p.slug);
  type P = (typeof products)[number];
  const cols = products.length + 1;
  const tally: Tally = { r: 0, wins: products.map(() => 0), decided: 0 };
  /** One row; `score` (higher is better, null = not comparable) marks the best product's cell. */
  const row = (label: string, render: (p: P) => React.ReactNode, score?: (p: P) => number | null, top = false) => {
    const best = score && products.length > 1 ? winnerOf(products.map(score)) : null;
    if (best !== null) { tally.wins[best]!++; tally.decided++; }
    return (
      <tr className={ROW} style={{ ["--r" as string]: tally.r++ }}>
        <th scope="row" className={`${LABEL}${top ? " !align-top" : ""}`}>{label}</th>
        {products.map((p, i) => (
          <td key={p.id} className={`${cellClass(i)}${top ? " !align-top" : ""}${i === best ? ` ${WIN}` : ""}`}>{render(p)}{i === best && winMark(t)}</td>
        ))}
      </tr>
    );
  };
  const groups = [...new Set(attrRows.map((a) => a.group))];

  const body = (
    <>
            <GroupHeading label={t("compareTable.overview")} colSpan={cols} />
            {row(t("compareTable.rating"), (p) =>
              p.ratingCount ? (
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-accent" fill="currentColor" strokeWidth={0} aria-hidden />
                  <span className="font-bold">{(toNumber(p.ratingAvg) ?? 0).toFixed(1)}</span>
                  <span className="text-muted">{t("compareTable.reviews", { count: p.ratingCount.toLocaleString("en-IN") })}</span>
                </span>
              ) : (
                <span className="text-muted">{t("compareTable.noReviews")}</span>
              ),
              (p) => (p.ratingCount ? toNumber(p.ratingAvg) ?? null : null),
            )}
            {row(t("compareTable.category"), (p) => p.primaryCategory?.name ?? "—")}
            {row(t("compareTable.deployment"), (p) =>
              p.deployment.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {p.deployment.map((d) => (
                    <span key={d} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-ink ring-1 ring-line">{deploymentLabel(t, d)}</span>
                  ))}
                </span>
              ) : (
                "—"
              ),
            )}

            <GroupHeading label={t("compareTable.pricing")} colSpan={cols} />
            {row(t("compareTable.startingPrice"), (p) => {
              const n = toNumber(p.startingPrice);
              return n && n > 0 ? (
                <>
                  <span className="font-display text-lg font-extrabold text-ink">{formatPrice(n, p.currency)}</span> <span className="text-[13px] font-normal text-muted">{p.priceUnit}</span>
                </>
              ) : p.pricingModel === "FREE" ? (
                <span className="rounded-full bg-success/10 px-3 py-1 text-[13px] font-bold text-success">{t("compareTable.free")}</span>
              ) : (
                <span className="rounded-full bg-bg px-3 py-1 text-[13px] font-semibold text-muted ring-1 ring-line">{t("compareTable.priceOnRequest")}</span>
              );
            }, (p) => {
              const n = toNumber(p.startingPrice);
              return n && n > 0 ? -n : p.pricingModel === "FREE" ? 0 : null;
            })}
            {row(t("compareTable.pricingModel"), (p) => pricingLabel(t, p.pricingModel))}
            {row(labels.freeTrialBadge, (p) => (p.hasFreeTrial ? yes(t) : no(t)), (p) => (p.hasFreeTrial ? 1 : 0))}
            {row(labels.freeVersionBadge, (p) => (p.hasFreeVersion ? yes(t) : no(t)), (p) => (p.hasFreeVersion ? 1 : 0))}
            {row(t("compareTable.plans"), (p) =>
              p.plans.length ? (
                <ul className="divide-y divide-line/70 rounded-xl ring-1 ring-line/80">
                  {p.plans.map((pl) => {
                    const n = toNumber(pl.price);
                    return (
                      <li key={pl.id} className="flex flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-[13px]">
                        <span className="font-semibold text-ink">{pl.name}</span>
                        <span className="font-medium text-ink/70">{n === null ? t("compareTable.custom") : `${formatPrice(n, pl.currency)} ${pl.priceUnit ?? billingLabel(t, pl.billingPeriod)}`}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                "—"
              ),
            )}

            {groups.map((g) => (
              // Called directly (not as <GroupRows/>) so its wins are counted before the verdict below.
              <Fragment key={g}>{GroupRows({ t, group: g, rows: attrRows.filter((a) => a.group === g), colSpan: cols, tally })}</Fragment>
            ))}

            <GroupHeading label={t("compareTable.features")} colSpan={cols} />
            {row(t("compareTable.topFeatures"), (p) => {
              if (!p.features.length) return <span className="text-muted">—</span>;
              const others = products.filter((o) => o.id !== p.id).map((o) => new Set(o.features.map((f) => f.title.trim().toLowerCase())));
              // "Only here" only means something when the products share some features.
              const sharesAny = p.features.some((f) => others.some((set) => set.has(f.title.trim().toLowerCase())));
              return (
                <div className="flex flex-col gap-2">
                  <ul data-play className="grid gap-1.5 xl:grid-cols-2">
                    {p.features.slice(0, 8).map((f, fi) => {
                      const unique = sharesAny && others.every((set) => !set.has(f.title.trim().toLowerCase()));
                      return (
                        <li key={f.id} tabIndex={f.description ? 0 : undefined} aria-describedby={f.description ? `feat-${f.id}` : undefined} className="cg-feat relative flex min-w-0 items-center gap-2 rounded-lg border border-line/80 bg-surface px-2.5 py-1.5 outline-none transition hover:border-primary/40 hover:bg-primary-soft/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20" style={{ ["--i" as string]: fi }}>
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                            {f.icon ? <Icon name={f.icon} className="h-3 w-3" /> : <Check className="h-3 w-3" strokeWidth={3.5} aria-hidden />}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{f.title}</span>
                          {unique && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[9.5px] font-extrabold uppercase text-accent-fg">{t("compareTable.onlyHere")}</span>}
                          {f.description && (
                            // Thought-cloud card with the feature's description (hover, or focus/tap on touch screens).
                            <span id={`feat-${f.id}`} role="tooltip" className={`cg-cloud pointer-events-none absolute bottom-[calc(100%+20px)] z-30 w-[17rem] ${fi % 2 === 1 ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"}`}>
                              <span className="relative block rounded-[22px] bg-surface bg-[radial-gradient(circle_at_100%_100%,rgb(var(--color-primary-soft))_0,transparent_60%)] p-4">
                                <span className="flex items-center gap-2">
                                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-primary text-primary-fg shadow-[0_6px_14px_-6px_rgb(var(--color-primary)/0.8)]">
                                    {f.icon ? <Icon name={f.icon} className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden />}
                                  </span>
                                  <span className="min-w-0 flex-1 text-[13.5px] font-extrabold leading-snug text-ink">{f.title}</span>
                                  {unique && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[9.5px] font-extrabold uppercase text-accent-fg">{t("compareTable.onlyHere")}</span>}
                                </span>
                                <span className="mt-2 block whitespace-normal text-[12.5px] font-normal leading-relaxed text-ink/75">{f.description}</span>
                                <span className="mt-2.5 block text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary">{p.name}</span>
                              </span>
                              <span aria-hidden className={`absolute -bottom-2.5 h-3.5 w-3.5 rounded-full bg-surface ${fi % 2 === 1 ? "right-8" : "left-8"}`} />
                              <span aria-hidden className={`absolute -bottom-[1.1rem] h-2 w-2 rounded-full bg-surface ${fi % 2 === 1 ? "right-6" : "left-6"}`} />
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  {p.features.length > 8 && (
                    <Link href={`/software/${p.slug}#features`} className="inline-flex items-center gap-1 self-start text-[13px] font-bold text-primary hover:underline">
                      {t("compareTable.moreFeatures", { count: p.features.length - 8 })} →
                    </Link>
                  )}
                </div>
              );
            }, undefined, true)}
    </>
  );
  // Verdict: who wins the most comparable rows (only with a clear leader and something to compare).
  const most = Math.max(0, ...tally.wins);
  const leaders = tally.wins.filter((w) => w === most).length;
  const verdict = products.length > 1 && tally.decided > 0
    ? leaders === 1 && most > 0
      ? t("compareTable.verdict", { name: products[tally.wins.indexOf(most)]!.name, wins: most, total: tally.decided })
      : t("compareTable.verdictTie", { total: tally.decided })
    : null;

  return (
    <section data-play className="cg-faceoff overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-[0_24px_60px_-40px_rgb(var(--color-ink)/0.35)]" aria-labelledby="comparison-heading">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-5 pb-5 pt-6 sm:px-7">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{t("compareTable.eyebrow")}</p>
          <h2 id="comparison-heading" className="mt-1 font-display text-2xl font-bold text-ink">{heading ?? t("compareTable.heading")}</h2>
          <p className="mt-1 text-sm text-muted">
            {products.length === 1 ? t("compareTable.comparingOne") : t("compareTable.comparing", { count: products.length })}
            {products.length === 1 && editable ? t("compareTable.addAnother") : ""}
          </p>
          {products.length > 1 && tally.decided > 0 && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted"><Trophy className="h-3.5 w-3.5 text-primary" aria-hidden /> {t("compareTable.legend")}</p>
          )}
        </div>
        {verdict && (
          <p className="cg-fo-verdict inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-fg">
            <Trophy className="h-4 w-4" aria-hidden /> {verdict}
          </p>
        )}
      </div>
      <div data-no-motion className="overflow-x-auto border-t border-line">
        <table className="w-full min-w-[44rem] border-collapse">
          <thead>
            <tr>
              <th scope="col" className={`${LABEL} !align-bottom !text-[11px] uppercase tracking-[0.14em] !text-muted`}>{t("compareTable.compare")}</th>
              {products.map((p, i) => (
                <th key={p.id} scope="col" className={`relative min-w-[14rem] py-5 pr-5 text-left align-top font-normal ${i > 0 ? "pl-9" : "pl-5"}`} style={{ width: `${100 / products.length}%` }}>
                  {i > 0 && (
                    <>
                      {/* A thin divider between the products, with the VS badge on it, level with the logos. */}
                      <span aria-hidden className="pointer-events-none absolute bottom-5 left-0 top-5 w-px bg-line" />
                      <span className="cg-fo-vs pointer-events-none absolute left-0 top-[42px] z-20 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-surface text-[11px] font-extrabold tracking-wide text-primary shadow-[0_6px_16px_-8px_rgb(var(--color-ink)/0.35)] ring-1 ring-line" aria-hidden>
                        <span className="cg-fo-ripple absolute inset-0 rounded-full border-2 border-primary/40" />
                        {t("compareTable.vs")}
                      </span>
                    </>
                  )}
                  <div className={`cg-fo-head ${i === 0 && products.length > 1 ? "from-left" : i === products.length - 1 && products.length > 1 ? "from-right" : "from-below"}`}>
                  <div className="flex items-start gap-3">
                    <SoftwareLogo logo={p.logo} name={p.name} size={48} />
                    <div className="min-w-0">
                      <Link href={`/software/${p.slug}`} className="block truncate font-display text-[17px] font-bold text-ink hover:text-primary">{p.name}</Link>
                      {p.vendor && <p className="truncate text-xs text-muted">{t("compareTable.by", { name: p.vendor.name })}</p>}
                      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {p.ratingCount ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-bold text-ink"><Star className="h-3 w-3 text-accent" fill="currentColor" strokeWidth={0} aria-hidden />{(toNumber(p.ratingAvg) ?? 0).toFixed(1)}</span>
                        ) : null}
                        {p.primaryCategory && <span className="rounded-full bg-bg px-2 py-0.5 font-semibold text-muted ring-1 ring-line">{p.primaryCategory.name}</span>}
                      </p>
                      {editable && <CompareRemoveLink slugs={slugs} remove={p.slug} />}
                    </div>
                  </div>
                  <EnquireButton type="QUOTE" softwareSlugs={[p.slug]} productName={p.name} source="COMPARE_PAGE" className="mt-4 h-10 w-full rounded-xl bg-accent text-sm font-bold text-accent-fg transition hover:bg-accent/90">
                    {labels.enquireCta}
                  </EnquireButton>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupHeading({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="border-t-2 border-line bg-primary-soft/50">
      <th colSpan={colSpan} scope="rowgroup" className="px-5 py-3 text-left">
        <span className="sticky left-5 inline-flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.12em] text-primary">
          <span aria-hidden className="h-4 w-1 rounded-full bg-primary" />
          {label}
        </span>
      </th>
    </tr>
  );
}

function GroupRows({ t, group, rows, colSpan, tally }: { t: T; group: string; rows: Data["attrRows"]; colSpan: number; tally: Tally }) {
  return (
    <>
      <GroupHeading label={group} colSpan={colSpan} />
      {rows.map((r) => {
        // Yes/No rows are comparable: the only product with “Yes” wins the row.
        const best = r.values.length > 1 ? winnerOf(r.values.map((v) => (v === "Yes" ? 1 : v === "No" ? 0 : null))) : null;
        if (best !== null) { tally.wins[best]!++; tally.decided++; }
        return (
          <tr key={r.id} className={ROW} style={{ ["--r" as string]: tally.r++ }}>
            <th scope="row" className={LABEL}>{r.label}</th>
            {r.values.map((v, i) => (
              <td key={i} className={`${cellClass(i)}${i === best ? ` ${WIN}` : ""}`}>
                {v === null ? <span className="text-muted">—</span> : v === "Yes" ? yes(t) : v === "No" ? no(t) : v}
                {i === best && winMark(t)}
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}
