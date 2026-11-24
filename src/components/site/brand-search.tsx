"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { useT } from "@/components/site/texts";

/** Brands page search: filters the cards as you type (after a short pause); Enter searches straight away. */
export function BrandSearch({ initial }: { initial: string }) {
  const tx = useT();
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const [pending, start] = useTransition();
  const first = useRef(true);
  const sent = useRef(initial);

  // The search was changed from outside the box (e.g. "Show all brands"): show that.
  useEffect(() => {
    if (initial !== sent.current) {
      sent.current = initial;
      first.current = true;
      setQ(initial);
    }
  }, [initial]);

  // "Search in Software brands" picked in the header search.
  useEffect(() => {
    const onScope = (e: Event) => {
      setQ(String((e as CustomEvent<string>).detail ?? ""));
      document.getElementById("brands")?.scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("cg:scope-search", onScope);
    return () => window.removeEventListener("cg:scope-search", onScope);
  }, []);

  const go = (value: string) => {
    const v = value.trim();
    if (v === sent.current) return;
    sent.current = v;
    start(() => router.replace(v ? `/brands?q=${encodeURIComponent(v)}` : "/brands", { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => go(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on typing only
  }, [q]);

  return (
    <form
      role="search"
      data-search-scope="/brands"
      data-search-scope-label={tx("site.brandsScope")}
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
        document.getElementById("brands")?.scrollIntoView({ behavior: "smooth" });
      }}
      className="mt-7 flex max-w-xl items-center gap-2 rounded-2xl border border-primary/20 bg-surface p-1.5 focus-within:border-primary/60 shadow-[0_16px_36px_-24px_rgb(var(--color-ink)/0.45)]"
    >
      <label className="relative flex-1">
        <span className="sr-only">{tx("site.searchBrands")}</span>
        {pending ? (
          <Loader2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-hidden />
        ) : (
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        )}
        <input
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={tx("site.brandsPlaceholder")}
          autoComplete="off"
          className="h-11 w-full rounded-xl border-0 bg-transparent pl-10 pr-9 text-sm text-ink outline-none placeholder:text-muted focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label={tx("site.clearSearch")}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </label>
    </form>
  );
}
