"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE_SEARCH_INPUT } from "./search-box";
import { useT } from "@/components/site/texts";

/**
 * Search box scoped to one list (a category's products, the blog…). Updates the list as you type,
 * keeping the page's other filters, and tells the header search what this page's list is
 * (data-search-scope), so its suggestions can offer "Search in <list>" first.
 */
export function ListSearch({
  placeholder,
  basePath,
  params,
  scopeLabel,
  anchor,
  className,
  panel,
}: {
  placeholder: string;
  basePath: string;
  /** The page's current query string values (other filters are kept; page is reset). */
  params: Record<string, string | string[] | undefined>;
  /** e.g. "CAD Software" — shown in the header search's "Search in …" suggestion. */
  scopeLabel: string;
  /** Element id to keep in view after Enter. */
  anchor?: string;
  className?: string;
  /** Admin / vendor / account list: mint focus like other panel fields. Website lists get the plain website style. */
  panel?: boolean;
}) {
  const tx = useT();
  const router = useRouter();
  const initial = typeof params.q === "string" ? params.q : "";
  const [q, setQ] = useState(initial);
  const [pending, start] = useTransition();
  const sent = useRef(initial.trim());

  const hrefFor = (term: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k === "q" || k === "page" || v === undefined || v === "") continue;
      (Array.isArray(v) ? v : [v]).forEach((x) => sp.append(k, x));
    }
    if (term) sp.set("q", term);
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const go = (term: string) => {
    if (term === sent.current) return;
    sent.current = term;
    start(() => router.replace(hrefFor(term), { scroll: false }));
  };

  // Changed from outside (e.g. "Clear all filters"): show it.
  useEffect(() => {
    if (initial.trim() !== sent.current) {
      sent.current = initial.trim();
      setQ(initial);
    }
  }, [initial]);

  // "Search in …" picked in the header search.
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const onScope = (e: Event) => {
      const term = String((e as CustomEvent<string>).detail ?? "");
      setQ(term);
      (anchor ? document.getElementById(anchor) : formRef.current)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("cg:scope-search", onScope);
    return () => window.removeEventListener("cg:scope-search", onScope);
  }, [anchor]);

  useEffect(() => {
    const t = setTimeout(() => go(q.trim()), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on typing only
  }, [q]);

  return (
    <form
      ref={formRef}
      role="search"
      data-search-scope={basePath}
      data-search-scope-label={scopeLabel}
      onSubmit={(e) => {
        e.preventDefault();
        go(q.trim());
        if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
      }}
      className={cn("relative", className)}
    >
      <label className="sr-only" htmlFor={`ls-${basePath}`}>{placeholder}</label>
      {pending ? (
        <Loader2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-hidden />
      ) : (
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      )}
      <input
        id={`ls-${basePath}`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className={cn("h-10 w-full rounded-control bg-surface pl-9 pr-8 text-sm text-ink transition placeholder:text-muted", panel ? "border border-line outline-none focus:border-mint focus:ring-4 focus:ring-mint-soft" : SITE_SEARCH_INPUT)}
      />
      {q && (
        <button type="button" onClick={() => setQ("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label={tx("site.clearSearch")}>
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </form>
  );
}
