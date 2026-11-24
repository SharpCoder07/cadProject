"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { Building2, LayoutGrid, Loader2, Search, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/site/texts";

interface Suggestion {
  type: "software" | "category" | "vendor" | "term" | "scope";
  label: string;
  href: string;
  meta?: string | null;
  logoUrl?: string | null;
}

/** Combobox with debounced suggestions (WAI-ARIA combobox pattern). Enter without a selection runs a full search. */
/** Website search bars: a soft brand-colour border and no focus glow (same as the homepage hero search). */
export const SITE_SEARCH_INPUT = "border border-primary/20 outline-none focus:border-primary/60 focus:ring-0 focus-visible:border-primary/60 focus-visible:ring-0 focus-visible:ring-offset-0";

export function SearchBox({ placeholder, size = "md", autoFocus, defaultValue = "", className, inputClassName, label, live, hints }: { placeholder: string; size?: "md" | "lg"; autoFocus?: boolean; defaultValue?: string; className?: string; inputClassName?: string; label?: string; /** On the search results page: update the results as you type instead of showing suggestions. */ live?: boolean; /** Example searches typed out in the empty box until it is focused (Typed.js-style); from Website settings › Labels via searchExamples(). None = no typing. */ hints?: string[] }) {
  const tx = useT();
  const router = useRouter();
  const [pending, startLive] = useTransition();
  const sent = useRef(defaultValue.trim());

  const listId = useId();
  const [q, setQ] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const abort = useRef<AbortController | null>(null);

  // Live mode: refresh the results page a moment after typing stops.
  useEffect(() => {
    if (!live) return;
    const term = q.trim();
    if (term === sent.current) return;
    const t = setTimeout(() => {
      sent.current = term;
      startLive(() => router.replace(term ? `/search?q=${encodeURIComponent(term)}` : "/search", { scroll: false }));
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on typing only
  }, [q, live]);

  // Live mode: flag the page while new results load, so the results area shows shimmer placeholders (motion.css).
  useEffect(() => {
    if (!live) return;
    document.documentElement.toggleAttribute("data-cg-searching", pending);
    return () => document.documentElement.removeAttribute("data-cg-searching");
  }, [pending, live]);

  // Example searches typed out letter by letter (like Typed.js) while the box is empty and not focused.
  // Off when the website's animations are off, or for visitors who ask for reduced motion: the normal placeholder shows.
  const examples = useMemo(() => hints ?? [], [hints]);
  const [motionOk, setMotionOk] = useState(false);
  useEffect(() => {
    const off = document.querySelector<HTMLElement>("[data-motion]")?.dataset.motion === "off" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setMotionOk(!off);
  }, []);
  const [focused, setFocused] = useState(false);
  const [typed, setTyped] = useState("");
  const showHint = motionOk && examples.length > 0 && !q && !focused;
  const hintKey = examples.join("|");
  useEffect(() => {
    const hints = examples;
    if (!showHint || !hints.length) return;
    let h = 0;
    let i = 0;
    let dir = 1;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const word = hints[h % hints.length]!;
      i += dir;
      setTyped(word.slice(0, i));
      if (dir > 0 && i >= word.length) {
        dir = -1;
        t = setTimeout(tick, 1600);
        return;
      }
      if (dir < 0 && i <= 0) {
        dir = 1;
        h++;
        t = setTimeout(tick, 350);
        return;
      }
      t = setTimeout(tick, dir > 0 ? 70 : 30);
    };
    t = setTimeout(tick, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the list itself changes
  }, [showHint, hintKey]);

  // A list on this page with its own search (category products, blog, vendors…): offer it first.
  const pathname = usePathname();
  const [scope, setScope] = useState<{ label: string } | null>(null);
  useEffect(() => {
    if (live) return;
    const t = setTimeout(() => {
      const el = document.querySelector<HTMLElement>("[data-search-scope]");
      setScope(el?.dataset.searchScopeLabel ? { label: el.dataset.searchScopeLabel } : null);
    }, 50);
    return () => clearTimeout(t);
  }, [pathname, live]);

  useEffect(() => {
    if (live) return;
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const t = setTimeout(async () => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          const data = (await res.json()) as { suggestions: Suggestion[] };
          setItems(data.suggestions);
          setActive(-1);
          setOpen(true);
        }
      } catch {
        /* aborted or offline: keep previous suggestions */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    if (href === "#scope") {
      // Hand the term to this page's list search, which filters and scrolls to the list.
      window.dispatchEvent(new CustomEvent("cg:scope-search", { detail: q.trim() }));
      return;
    }
    router.push(href);
  };
  const term = q.trim();
  const shown: Suggestion[] = scope && term ? [{ type: "scope", label: tx("searchBox.scope", { term, list: scope.label }), href: "#scope", meta: tx("searchBox.scopeMeta") }, ...items] : items;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const pick = shown[active];
    if (open && pick) return go(pick.href);
    if (live) {
      sent.current = term;
      startLive(() => router.replace(term ? `/search?q=${encodeURIComponent(term)}` : "/search", { scroll: false }));
      return;
    }
    if (term) go(`/search?q=${encodeURIComponent(term)}`);
  };

  const lg = size === "lg";
  return (
    <form role="search" onSubmit={submit} className={cn("relative", className)}>
      <label htmlFor={`${listId}-input`} className="sr-only">
        {label ?? tx("searchBox.label")}
      </label>
      {pending ? (
        <Loader2 className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 animate-spin text-primary", lg ? "left-4 h-5 w-5" : "left-3 h-4 w-4")} aria-hidden />
      ) : (
        <Search className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted", lg ? "left-4 h-5 w-5" : "left-3 h-4 w-4")} aria-hidden />
      )}
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          if (scope && !live) setOpen(true);
        }}
        onFocus={() => {
          setFocused(true);
          if (shown.length) setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          setTimeout(() => setOpen(false), 120);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(shown.length - 1, a + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(-1, a - 1));
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={showHint ? "" : placeholder}
        className={cn(
          "w-full rounded-control bg-surface text-ink placeholder:text-muted/80",
          SITE_SEARCH_INPUT,
          lg ? "h-14 pl-12 pr-5 text-lg" : "h-10 pl-9 pr-3 text-sm",
          inputClassName,
        )}
      />
      {showHint && (
        <span aria-hidden className={cn("pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center text-muted/90", lg ? "left-12 text-lg" : "left-9 text-sm")}>
          {typed}
          <span className="cg-caret ml-0.5 inline-block w-[2px] self-stretch bg-primary" style={{ height: lg ? "1.4em" : "1.2em" }} />
        </span>
      )}
      {open && !live && shown.length > 0 && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[60vh] overflow-y-auto rounded-panel border border-line bg-surface py-1 text-ink shadow-[0_24px_60px_-20px_rgb(var(--color-ink)/0.4)]">
          {shown.map((s, i) => (
            <li
              key={`${s.type}-${s.href}`}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(s.href);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", i === active && "bg-primary-soft")}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-bg">
                {s.type === "scope" ? (
                  <Search className="h-4 w-4 text-primary" aria-hidden />
                ) : s.type === "software" && s.logoUrl ? (
                  <Image src={s.logoUrl} alt="" width={32} height={32} className="object-contain" />
                ) : s.type === "vendor" ? (
                  <Building2 className="h-4 w-4 text-muted" aria-hidden />
                ) : s.type === "term" ? (
                  <Tags className="h-4 w-4 text-primary" aria-hidden />
                ) : (
                  <LayoutGrid className="h-4 w-4 text-muted" aria-hidden />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{s.label}</span>
                {s.meta && <span className="block truncate text-xs text-muted">{s.meta}</span>}
              </span>
            </li>
          ))}
          <li role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); go(`/search?q=${encodeURIComponent(q.trim())}`); }} className="cursor-pointer border-t border-line px-3 py-2 text-sm text-primary hover:bg-primary-soft">
            {tx("searchBox.seeAll", { q: q.trim() })}
          </li>
        </ul>
      )}
    </form>
  );
}
