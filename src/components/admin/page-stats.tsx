import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const CHIP = {
  neutral: "bg-bg text-ink/70 ring-1 ring-line",
  red: "bg-mint-soft text-mint-ink",
  green: "bg-success/10 text-success",
  amber: "bg-warning/10 text-warning",
} as const;

export interface PageStat {
  label: string;
  value: ReactNode;
  icon: ComponentType<{ className?: string }>;
  /** Supporting line under the number. */
  sub?: ReactNode;
  tone?: keyof typeof CHIP;
  href?: string;
}

/** Row of KPI cards at the top of an admin page — the same cards as the dashboard. */
export function PageStats({ items, className }: { items: PageStat[]; className?: string }) {
  return (
    <div className={cn("mb-5 grid gap-4 sm:grid-cols-2", items.length >= 4 ? "xl:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "", className)}>
      {items.map(({ label, value, icon: Icon, sub, tone = "neutral", href }) => {
        const body = (
          <div className={cn("admin-card flex h-full min-h-[7.5rem] flex-col p-5 transition", href && "hover:border-ink/15 hover:shadow-[0_8px_20px_-12px_rgb(16_24_40/0.2)]")}>
            <div className="flex items-start justify-between gap-3">
              <p className="pt-1 text-xs font-semibold uppercase tracking-[0.06em] text-ink/65">{label}</p>
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", CHIP[tone])}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
            </div>
            <p className="mt-2 text-[1.75rem] font-bold leading-none tracking-tight tabular-nums text-ink">{value}</p>
            {sub && <p className="mt-auto pt-2 text-[13px] text-muted">{sub}</p>}
          </div>
        );
        return href ? (
          <Link key={label} href={href} className="block h-full rounded-panel">{body}</Link>
        ) : (
          <div key={label}>{body}</div>
        );
      })}
    </div>
  );
}
