import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/misc";

/**
 * Shared pieces for admin / vendor / account list pages (the "All products" design):
 *   <ListPanel tabs={<PillTabs …/>} meta="Showing 1–25 of 80" filters={<FilterBar bare>…</FilterBar>} footer={<PanelPagination …/>}>
 *     <PanelTable>…</PanelTable>
 *   </ListPanel>
 */

export const PANEL = "overflow-hidden rounded-[20px] border border-line/80 bg-surface shadow-[0_1px_2px_rgb(var(--color-ink)/0.04),0_12px_32px_-24px_rgb(var(--color-ink)/0.25)]";

export function ListPanel({ title, tabs, meta, actions, filters, children, footer, className }: { title?: ReactNode; tabs?: ReactNode; meta?: ReactNode; actions?: ReactNode; filters?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  const head = title || tabs || meta || actions;
  return (
    <section className={cn(PANEL, className)}>
      {head && (
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          {/* Left: title or tabs. Right: the count, right beside the search / buttons. */}
          <div className="mr-auto flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            {title && <h2 className="text-[15px] font-bold text-ink">{title}</h2>}
            {tabs}
          </div>
          {(meta || actions) && (
            <div className="flex w-full flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:w-auto">
              {meta && <p className="whitespace-nowrap text-xs text-muted" aria-live="polite">{meta}</p>}
              {actions}
            </div>
          )}
        </div>
      )}
      {filters && <div className="border-b border-line bg-bg/40 px-4 py-3 sm:px-5">{filters}</div>}
      {children}
      {footer}
    </section>
  );
}

/** The admin's one tab style (status tabs, page tabs, editor tabs): a grey track with the open tab raised. */
export const PILL_TRACK = "flex w-fit max-w-full gap-1 rounded-xl bg-bg p-1";
export const pillTab = (active: boolean) => cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition", active ? "bg-surface font-semibold text-ink shadow-[0_1px_3px_rgb(16_24_40/0.1)] ring-1 ring-line" : "font-medium text-muted hover:text-ink");

/** Pill switcher for status tabs, each with a count. */
export function PillTabs({ items, label = "Filter" }: { items: { href: string; label: string; count?: number; active: boolean }[]; label?: string }) {
  return (
    <nav aria-label={label} className={cn(PILL_TRACK, "overflow-x-auto")}>
      {items.map((t) => (
        <Link
          key={t.href + t.label}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={pillTab(t.active)}
        >
          {t.label}
          {t.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", t.active ? "bg-mint-soft text-mint-ink" : "bg-surface text-muted")}>{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export { SearchField } from "./search-field";

/** Compact labelled-by-placeholder dropdown for a FilterBar. */
/** Highlighted only while it narrows the list: not for an empty value, “ALL”, or the page's own default (`resting`). */
export function SelectField({ name, label, value, resting, children }: { name: string; label: string; value?: string; resting?: string; children: ReactNode }) {
  const filtering = Boolean(value) && value !== "ALL" && value !== resting;
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} aria-label={label} className={cn("w-full max-w-[11rem] appearance-none truncate rounded-control border pl-3 pr-8 text-sm text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint-soft", filtering ? "border-mint bg-mint-soft" : "border-line bg-surface hover:border-ink/20")}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </label>
  );
}

/** Date input for a FilterBar, with a small leading label. */
export function DateField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <label className="flex shrink-0 items-center gap-2 rounded-control border border-line bg-surface pl-3 text-sm text-muted focus-within:border-mint focus-within:ring-4 focus-within:ring-mint-soft">
      {label}
      <input type="date" name={name} defaultValue={defaultValue} className="w-[8.25rem] min-w-0 border-0 bg-transparent pr-2 text-sm text-ink outline-none" />
    </label>
  );
}

/** Table inside a ListPanel: grey header row, divided rows, hover. */
export function PanelTable({ children, minWidth = 48 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table
        style={{ minWidth: `${minWidth}rem` }}
        className="w-full text-left text-sm [&_thead_tr]:border-b [&_thead_tr]:border-line [&_thead_tr]:bg-bg/60 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-muted sm:[&_th]:px-5 [&_td]:px-4 [&_td]:py-3 sm:[&_td]:px-5 [&_tbody]:divide-y [&_tbody]:divide-line [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-bg/60"
      >
        {children}
      </table>
    </div>
  );
}

/** "Page 2 of 5" + page numbers, shown only when there is more than one page. */
export function PanelPagination({ page, pages, basePath, params, anchor }: { page: number; pages: number; basePath: string; params: Record<string, string | string[] | undefined>; anchor?: string }) {
  if (pages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
      <p className="text-xs text-muted">Page {page} of {pages}</p>
      <Pagination page={page} pages={pages} basePath={basePath} params={params} anchor={anchor} />
    </div>
  );
}

/** Empty state inside a panel, with an icon tile. */
export function PanelEmpty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <EmptyState title={title} icon={<span className="grid h-12 w-12 place-items-center rounded-2xl bg-bg ring-1 ring-line">{icon}</span>} action={action}>{children}</EmptyState>;
}

/** "Showing 1–25 of 80". */
export const showing = (page: number, perPage: number, total: number) => (total ? `Showing ${(page - 1) * perPage + 1}–${Math.min(page * perPage, total)} of ${total.toLocaleString("en-IN")}` : "Nothing to show");
/** "Showing 1–n of n" for lists shown in full (no pages). */
export const showingAll = (total: number) => showing(1, Math.max(total, 1), total);

/** Soft icon button for row actions (edit, view…), brightens on hover. */
export const ROW_ICON = "grid h-8 w-8 place-items-center rounded-lg text-ink/50 transition hover:bg-surface hover:text-ink hover:shadow-[0_1px_3px_rgb(16_24_40/0.08)] hover:ring-1 hover:ring-line";

/**
 * First cell of a list row: thumbnail (image, or initials/icon tile) + bold title + muted second line.
 * `round` for people/avatars, `wide` for banner-style images.
 */
export function ItemTitle({ image, icon, title, sub, href, round, wide }: { image?: string | null; icon?: ReactNode; title: string; sub?: ReactNode; href?: string; round?: boolean; wide?: boolean }) {
  const shape = cn("shrink-0 overflow-hidden ring-1 ring-line", round ? "rounded-full" : "rounded-xl", wide ? "h-9 w-14" : "h-9 w-9");
  const initials = title.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex min-w-0 items-center gap-3">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
        <img src={image} alt="" className={cn(shape, "bg-white", wide ? "object-cover" : "object-contain p-0.5")} />
      ) : (
        <span className={cn(shape, "grid place-items-center bg-mint-soft text-[11px] font-bold text-mint-ink ring-0")}>{icon ?? initials}</span>
      )}
      <span className="min-w-0">
        {href ? (
          <Link href={href} className="block truncate font-semibold text-ink hover:text-mint-ink">{title}</Link>
        ) : (
          <span className="block truncate font-semibold text-ink">{title}</span>
        )}
        {sub && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </div>
  );
}
