"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type FormEvent, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ListFilter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/site/texts";

/** Section tabs under the category hero; sticks below the header and highlights the section in view. */
export function CategoryTabs({ items }: { items: { id: string; label: string }[] }) {
  const tx = useT();
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => Boolean(e));
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-180px 0px -55% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav aria-label={tx("site.onThisPage")} className="sticky z-20 mb-5 hidden rounded-panel border border-line bg-surface px-2 shadow-sm md:top-[4.85rem] md:block lg:top-[7.85rem]">
      <ul className="flex gap-1 overflow-x-auto">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              onClick={() => setActive(i.id)}
              aria-current={active === i.id ? "true" : undefined}
              className={cn("-mb-px block whitespace-nowrap border-b-[3px] px-4 py-3 text-sm font-semibold transition-colors", active === i.id ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}
            >
              {i.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** "Filter" button that opens the filter form under the directory heading. */
export function FilterToggle({ count, children, buttonClassName }: { count: number; children: ReactNode; buttonClassName?: string }) {
  const tx = useT();
  const [open, setOpen] = useState(count > 0);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="category-filters"
        className={cn("inline-flex h-10 items-center gap-2 rounded-control border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-fg", buttonClassName)}
      >
        {open ? <X className="h-4 w-4" aria-hidden /> : <ListFilter className="h-4 w-4" aria-hidden />}
        {tx("site.filter")}
        {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] text-primary-fg">{count}</span>}
      </button>
      <div id="category-filters" hidden={!open} className="order-last w-full basis-full">
        {children}
      </div>
    </>
  );
}

/** Horizontal article slider with previous/next arrows (scroll-snap, no library). */
export function ArticleSlider({ children }: { children: ReactNode }) {
  const tx = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const update = () => {
    const el = ref.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(update, []);
  const go = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.9, behavior: "smooth" });
  const arrow = "grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink transition hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink";
  return (
    <div className="relative">
      <div className="absolute -top-14 right-0 flex gap-2">
        <button type="button" className={arrow} onClick={() => go(-1)} disabled={edge.start} aria-label={tx("site.prevArticles")}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className={arrow} onClick={() => go(1)} disabled={edge.end} aria-label={tx("site.nextArticles")}>
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <div ref={ref} onScroll={update} className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

// ─── Live sort shuffle (design concept 03) ───────────────────────────────────
// Changing the sort or a filter re-renders the product list without a page reload; rows that stay glide from
// their old place to the new one (FLIP), new rows rise in. Positions are taken just before the change
// (flipCapture) and played back when the new list arrives (FlipList), whether React keeps or remounts it.

const flipStore: { at: number; rects: Map<string, DOMRect> } = { at: 0, rects: new Map() };

/** Remembers where every product row is now, just before the list changes. */
export function flipCapture() {
  flipStore.rects = new Map();
  document.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((el) => flipStore.rects.set(el.dataset.flipKey!, el.getBoundingClientRect()));
  flipStore.at = performance.now();
}

const motionOn = () => {
  const level = document.querySelector("[data-motion]")?.getAttribute("data-motion") ?? "full";
  return level !== "off" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

/** The product list: plays the shuffle when it re-renders after flipCapture(). Rows need data-flip-key. */
export function FlipList({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box || !flipStore.rects.size) return;
    if (performance.now() - flipStore.at > 6000) { flipStore.rects = new Map(); return; }
    const rows = [...box.querySelectorAll<HTMLElement>(":scope > [data-flip-key]")];
    const old = flipStore.rects;
    const changed = rows.some((el) => {
      const b = old.get(el.dataset.flipKey!);
      return !b || Math.abs(b.top - el.getBoundingClientRect().top) > 1;
    }) || rows.length !== old.size;
    if (!changed) return; // the new list hasn't arrived yet
    flipStore.rects = new Map();
    box.removeAttribute("aria-busy");
    if (!motionOn()) return;
    let fresh = 0;
    rows.forEach((el) => {
      const before = old.get(el.dataset.flipKey!);
      const now = el.getBoundingClientRect();
      if (before) {
        const dx = before.left - now.left;
        const dy = before.top - now.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px)`, boxShadow: "0 0 0 0 transparent" },
            { transform: `translate(${dx / 2}px, ${dy / 2}px) scale(1.01)`, boxShadow: "0 28px 50px -30px rgb(var(--color-primary) / 0.55)", offset: 0.5 },
            { transform: "none", boxShadow: "0 0 0 0 transparent" },
          ],
          { duration: 650, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
        );
        el.style.position = "relative";
        el.style.zIndex = dy < 0 ? "2" : "1";
        window.setTimeout(() => { el.style.zIndex = ""; }, 700);
      } else {
        el.animate([{ opacity: 0, transform: "translateY(18px) scale(0.98)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: Math.min(fresh++, 6) * 60, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" });
      }
    });
  });
  return <ul ref={ref} className={className}>{children}</ul>;
}

/** Pushes a new address for the list without scrolling, after noting where the rows are. */
function useListNav() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (href: string) => {
    flipCapture();
    document.getElementById("products")?.querySelector("ul")?.setAttribute("aria-busy", "true");
    start(() => router.push(href, { scroll: false }));
  };
  return { go, pending };
}

/** Sort as pills with a sliding highlight (the select in the filter form still offers every sort). */
export function SortPills({ value, options, label }: { value: string; options: { value: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { go, pending } = useListNav();
  const [active, setActive] = useState(value);
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => setActive(value), [value]);
  useLayoutEffect(() => {
    const place = () => {
      const el = [...(wrap.current?.querySelectorAll<HTMLElement>("[data-sort]") ?? [])].find((b) => b.dataset.sort === active);
      setInd(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active]);
  const pick = (v: string) => {
    if (v === active) return;
    setActive(v);
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set("sort", v);
    else sp.delete("sort");
    sp.delete("page");
    go(`${pathname}${sp.size ? `?${sp.toString()}` : ""}`);
  };
  return (
    <div role="group" aria-label={label} ref={wrap} className={cn("cg-sort relative flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", pending && "is-pending")}>
      {ind && <span aria-hidden className="cg-sort-ind pointer-events-none absolute bottom-1 left-0 top-1 rounded-full bg-primary-soft shadow-[inset_0_0_0_1.5px_rgb(var(--color-primary))]" style={{ width: ind.w, transform: `translateX(${ind.x}px)` }} />}
      {options.map((o) => (
        <button key={o.value} type="button" data-sort={o.value} aria-pressed={active === o.value} onClick={() => pick(o.value)} className={cn("relative z-[1] h-8 whitespace-nowrap rounded-full px-3.5 text-[13px] font-semibold transition-colors", active === o.value ? "text-primary" : "text-muted hover:text-ink")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The filter form, applied without a page reload so the list can shuffle (a normal GET form without JS). */
export function ListFilterForm({ action, className, children }: { action: string; className?: string; children: ReactNode }) {
  const { go } = useListNav();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    for (const [k, v] of new FormData(e.currentTarget).entries()) if (typeof v === "string" && v !== "") sp.append(k, v);
    go(`${action}${sp.size ? `?${sp.toString()}` : ""}`);
  };
  return <form method="get" action={action} onSubmit={submit} className={className}>{children}</form>;
}

/** An applied filter as a chip that pops in; clicking it removes the filter (and shuffles the list). */
export function FilterChip({ href, label, removeLabel, index }: { href: string; label: string; removeLabel: string; index: number }) {
  const { go } = useListNav();
  return (
    <Link
      href={href}
      scroll={false}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        go(href);
      }}
      aria-label={removeLabel}
      className="cg-chip-pop inline-flex h-8 items-center gap-1.5 rounded-full bg-primary-soft pl-3 pr-2 text-[12.5px] font-bold text-primary transition hover:bg-primary hover:text-primary-fg"
      style={{ ["--i" as string]: index }}
    >
      {label} <X className="h-3.5 w-3.5" aria-hidden />
    </Link>
  );
}
