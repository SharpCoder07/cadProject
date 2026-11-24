"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Search, X } from "lucide-react";
import { SITE_SEARCH_INPUT } from "./search-box";
import { useT } from "@/components/site/texts";

/**
 * Instant search for short lists that are already on the page (vendors, industries): hides
 * items that don't match as you type — no reload. Items are elements with data-filter="<text>";
 * groups (data-filter-group) with no visible items are hidden too. Reads ?q= on load, so the
 * header search's "Search in …" suggestion can link here.
 */
export function InstantFilter({ placeholder, scopeHref, scopeLabel, children, className }: { placeholder: string; scopeHref: string; scopeLabel: string; children: ReactNode; className?: string }) {
  const tx = useT();
  const box = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    if (initial) setQ(initial);
    // "Search in …" picked in the header search.
    const onScope = (e: Event) => {
      setQ(String((e as CustomEvent<string>).detail ?? ""));
      box.current?.parentElement?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("cg:scope-search", onScope);
    return () => window.removeEventListener("cg:scope-search", onScope);
  }, []);

  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const term = q.trim().toLowerCase();
    let count = 0;
    root.querySelectorAll<HTMLElement>("[data-filter]").forEach((el) => {
      const hit = !term || (el.dataset.filter ?? "").toLowerCase().includes(term);
      el.hidden = !hit;
      if (hit) count++;
    });
    root.querySelectorAll<HTMLElement>("[data-filter-group]").forEach((g) => {
      g.hidden = !g.querySelector("[data-filter]:not([hidden])");
    });
    setShown(term ? count : null);
    const url = new URL(window.location.href);
    if (term) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url);
  }, [q]);

  return (
    <div className={className}>
      <form role="search" data-search-scope={scopeHref} data-search-scope-label={scopeLabel} onSubmit={(e) => e.preventDefault()} className="relative max-w-md">
        <label className="sr-only" htmlFor={`if-${scopeHref}`}>{placeholder}</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id={`if-${scopeHref}`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={`h-11 w-full rounded-control bg-surface pl-9 pr-8 text-sm text-ink transition placeholder:text-muted ${SITE_SEARCH_INPUT}`}
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label={tx("site.clearSearch")}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </form>
      <p className="mt-2 min-h-5 text-xs text-muted" aria-live="polite">
        {shown === null ? "" : shown === 0 ? tx("site.nothingMatches", { q: q.trim() }) : shown === 1 ? tx("site.matchesOne") : tx("site.matches", { count: shown })}
      </p>
      <div ref={box}>{children}</div>
    </div>
  );
}
