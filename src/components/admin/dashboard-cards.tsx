import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Shared pieces of the Super Admin dashboard and the vendor / reseller portal overview. */
export const CHIP = {
  neutral: "bg-bg text-ink/70 ring-1 ring-line",
  red: "bg-mint-soft text-mint-ink",
  green: "bg-success/10 text-success",
} as const;

/** Compact KPI card: label + icon, one number, one supporting line (about 145 px tall). */
export function StatCard({ label, value, valueClass, sub, chip = "neutral", icon: Icon, href, aside }: { label: string; value: React.ReactNode; valueClass?: string; sub?: React.ReactNode; chip?: keyof typeof CHIP; icon: React.ComponentType<{ className?: string }>; href?: string; aside?: React.ReactNode }) {
  const body = (
    <div className={cn("admin-card flex h-full flex-col px-4 py-3.5 transition", href && "hover:border-ink/15 hover:shadow-[0_8px_20px_-12px_rgb(16_24_40/0.2)]")}>
      <div className="flex items-start justify-between gap-3">
        <p className="pt-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-ink/65">{label}</p>
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", CHIP[chip])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2.5">
        <p className={cn("text-[1.6rem] font-bold leading-none tracking-tight tabular-nums text-ink", valueClass)}>{value}</p>
        {aside}
      </div>
      {sub && <p className="mt-auto pt-1.5 text-[13px] text-muted">{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-panel">
      {body}
    </Link>
  ) : (
    body
  );
}

export const TILE = {
  amber: "border-[#FCD9A0] bg-[#FFFBF2] text-[#C26A00] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  rose: "border-[#F9C9CC] bg-[#FFF6F6] text-primary dark:border-rose-500/30 dark:bg-rose-500/10",
  blue: "border-[#BFE6DC] bg-[#F0FAF7] text-[#047857] dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  violet: "border-[#F5DFB5] bg-[#FFF8EB] text-[#B45309] dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  slate: "border-line bg-surface text-ink/70",
} as const;
export type Tone = keyof typeof TILE;

export function AttentionTile({ count, label, href, tone }: { count: number; label: string; href: string; tone: Tone }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition hover:shadow-[0_4px_12px_-6px_rgb(16_24_40/0.18)]", TILE[tone])}>
      <span className="min-w-[1.25ch] text-base font-bold tabular-nums">{formatNumber(count)}</span>
      <span className="flex-1 truncate text-[13px] font-medium text-ink">{label}</span>
      <ArrowRight className="h-4 w-4 shrink-0 text-ink/50 transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
    </Link>
  );
}


/** One box of an "at a glance" list: icon, label and number, optionally a link. */
export function GlanceItem({ label, value, icon: Icon, tint, href }: { label: string; value: number; icon: React.ComponentType<{ className?: string }>; tint: string; href?: string }) {
  const inner = (
    <>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", tint)}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-ink/75">{label}</span>
      <span className="text-[15px] font-bold tabular-nums text-ink">{formatNumber(value)}</span>
    </>
  );
  const cls = "flex h-full items-center gap-3 rounded-xl border border-line bg-bg/50 px-3 py-2.5";
  return href ? <Link href={href} title={`${label}: ${formatNumber(value)}`} className={cn(cls, "transition hover:border-primary/40 hover:bg-primary-soft/40")}>{inner}</Link> : <div title={`${label}: ${formatNumber(value)}`} className={cls}>{inner}</div>;
}
