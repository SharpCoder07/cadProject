import Image from "next/image";
import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

type Day = { day: string; leads: number; views: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
/** Monday-first weekday index (0 = Mon). */
const weekdayOf = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;

function Summary({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-line rounded-xl border border-line bg-bg/50">
      {items.map((it) => (
        <div key={it.label} className="px-4 py-3">
          <dt className="text-xs text-muted">{it.label}</dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Change({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-sm text-muted">{now ? "New activity" : "No change"}</span>;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", up ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
      {up ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

/** Calendar heatmap: one square per day, weeks as columns, darker red = more leads. */
export function LeadHeatmap({ trend }: { trend: Day[] }) {
  const total = trend.reduce((n, d) => n + d.leads, 0);
  const max = Math.max(...trend.map((d) => d.leads), 0);
  const busiest = trend.reduce<Day | null>((b, d) => (d.leads > (b?.leads ?? 0) ? d : b), null);
  const lead = trend.length ? weekdayOf(trend[0]!.day) : 0;
  const cells: (Day | null)[] = [...Array<null>(lead).fill(null), ...trend];
  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const level = (n: number) => (n === 0 || max === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const shade = ["bg-bg ring-1 ring-inset ring-line", "bg-mint-soft", "bg-mint/60", "bg-mint", "bg-mint-ink"];

  return (
    <div className="space-y-5">
      <Summary
        items={[
          { label: "Total, 30 days", value: formatNumber(total) },
          { label: "Daily average", value: (total / Math.max(trend.length, 1)).toFixed(1) },
          { label: "Busiest day", value: busiest ? <span className="text-base">{dayLabel(busiest.day)}</span> : "—" },
        ]}
      />
      <div role="img" aria-label={`Leads per day over the last ${trend.length} days: ${total} in total`}>
        <div className="grid grid-cols-7 gap-1.5 pb-1.5 text-center text-[11px] font-medium text-muted">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="space-y-1.5">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, di) => {
                const d = week[di];
                if (!d) return <span key={di} />;
                const lv = level(d.leads);
                return (
                  <span key={di} title={`${dayLabel(d.day)}: ${d.leads} ${d.leads === 1 ? "lead" : "leads"}`} className={cn("flex h-9 items-center justify-between rounded-lg px-2 text-[11px]", shade[lv], lv >= 3 ? "text-white" : "text-ink/60")}>
                    <span>{Number(d.day.slice(8))}</span>
                    {d.leads > 0 && <span className="font-bold">{d.leads}</span>}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted">
        Fewer
        {shade.map((c, i) => (
          <span key={i} className={cn("h-3 w-3 rounded-[4px]", c)} aria-hidden />
        ))}
        More
      </div>
    </div>
  );
}

/** Daily columns with this-week vs last-week totals; the busiest day is marked in red. */
export function ViewsColumns({ trend }: { trend: Day[] }) {
  const total = trend.reduce((n, d) => n + d.views, 0);
  const max = Math.max(...trend.map((d) => d.views), 0);
  const thisWeek = trend.slice(-7).reduce((n, d) => n + d.views, 0);
  const lastWeek = trend.slice(-14, -7).reduce((n, d) => n + d.views, 0);

  return (
    <div className="space-y-5">
      <Summary
        items={[
          { label: "Total, 30 days", value: formatNumber(total) },
          { label: "Last 7 days", value: formatNumber(thisWeek) },
          { label: "vs previous 7", value: <Change now={thisWeek} before={lastWeek} /> },
        ]}
      />
      {max === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No product page views recorded in the last 30 days.</p>
      ) : (
        <div>
          <div className="flex h-36 items-end gap-[3px]" role="img" aria-label={`Product page views per day: ${total} in the last ${trend.length} days`}>
            {trend.map((d) => (
              <span
                key={d.day}
                title={`${dayLabel(d.day)}: ${formatNumber(d.views)} views`}
                className={cn("min-h-[3px] flex-1 rounded-t-[4px] transition-colors", d.views === max ? "bg-primary" : "bg-ink/80 hover:bg-ink")}
                style={{ height: `${Math.max(2, (d.views / max) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-[11px] text-muted">
            <span>{dayLabel(trend[0]!.day)}</span>
            <span>{dayLabel(trend[trend.length - 1]!.day)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

type Top = { id: string; name: string; slug: string; enquiryCount: number; viewCount: number; logo: { url: string } | null; primaryCategory: { name: string } | null };

/** Ranked list: share of enquiries as a bar, plus views and enquiry rate (enquiries ÷ views). */
export function EnquiryLeaderboard({ items }: { items: Top[] }) {
  const ranked = items.filter((t) => t.enquiryCount > 0);
  const sum = ranked.reduce((n, t) => n + t.enquiryCount, 0);
  if (!ranked.length) return <p className="px-6 py-10 text-center text-sm text-muted">No product enquiries yet.</p>;
  return (
    <ol className="divide-y divide-line">
      {ranked.map((t, i) => {
        const share = Math.round((t.enquiryCount / sum) * 100);
        const rate = t.viewCount ? ((t.enquiryCount / t.viewCount) * 100).toFixed(1) : null;
        return (
          <li key={t.id} className="flex items-center gap-3 px-6 py-3.5">
            <span className={cn("w-5 shrink-0 text-sm font-bold tabular-nums", i === 0 ? "text-primary" : "text-muted")}>{i + 1}</span>
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-surface">
              {t.logo ? <Image src={t.logo.url} alt="" width={36} height={36} className="h-full w-full object-contain p-1" /> : <span className="text-sm font-bold text-ink/60">{t.name.slice(0, 1)}</span>}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/admin/software?q=${encodeURIComponent(t.name)}`} className="truncate text-sm font-semibold text-ink hover:underline">{t.name}</Link>
                <span className="shrink-0 text-sm font-bold tabular-nums">{formatNumber(t.enquiryCount)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg ring-1 ring-inset ring-line">
                <div className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-ink/70")} style={{ width: `${Math.max(share, 3)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {share}% of enquiries · {formatNumber(t.viewCount)} views{rate ? ` · ${rate}% enquire` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
