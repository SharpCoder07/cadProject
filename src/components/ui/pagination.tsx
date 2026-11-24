import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Builds a URL for page n preserving other search params. */
export function pageHref(basePath: string, params: Record<string, string | string[] | undefined>, page: number) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || v === undefined || v === "") continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function Pagination({ page, pages, basePath, params, boxed, anchor }: { page: number; pages: number; basePath: string; params: Record<string, string | string[] | undefined>; /** Bordered squares, left-aligned (category directory). */ boxed?: boolean; /** Element id to scroll to on the new page (e.g. the list), instead of the top. */ anchor?: string }) {
  if (pages <= 1) return null;
  const href = (n: number) => `${pageHref(basePath, params, n)}${anchor ? `#${anchor}` : ""}`;
  const window: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) window.push(p);
    else if (window[window.length - 1] !== "…") window.push("…");
  }
  const item = boxed
    ? "inline-flex h-10 min-w-10 items-center justify-center rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink hover:border-mint hover:text-mint-ink"
    : "inline-flex h-9 min-w-9 items-center justify-center rounded-control px-3 text-sm";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center gap-1", boxed ? "justify-start gap-2" : "justify-center")}>
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(item, "hover:bg-ink/5")} rel="prev">
          <ChevronLeft className="h-4 w-4" aria-hidden /> <span className="sr-only sm:not-sr-only">Previous</span>
        </Link>
      ) : null}
      {window.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className={cn(item, "text-muted")} aria-hidden>
            …
          </span>
        ) : (
          <Link key={p} href={href(p)} aria-current={p === page ? "page" : undefined} className={cn(item, p === page ? "border-primary bg-primary text-primary-fg" : "hover:bg-ink/5")}>
            {p}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={href(page + 1)} className={cn(item, "hover:bg-ink/5")} rel="next">
          <span className="sr-only sm:not-sr-only">Next</span> <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
