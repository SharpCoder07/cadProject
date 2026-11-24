"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/components/site/texts";

export interface CascadeCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  count: number;
  subs: { id: string; name: string; slug: string }[];
}

/**
 * All categories page (design concept 02, "Cascade tiles"): a filterable grid of category tiles. When the grid
 * comes into view the tiles fold down into place column by column, like cards being dealt; each icon spins in,
 * the product counts tick up and the most popular category glows once. Compact tiles, six per row on wide
 * screens (subcategories are on each category page; the filter still finds a category by them). Styles: app/motion.css (.cg-cascade).
 * Nothing is hidden unless this script has armed the grid, so without JavaScript, with Animations "Off" or with
 * "Reduce motion" the tiles simply show.
 */
export function CategoryCascade({ items }: { items: CascadeCategory[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const grid = useRef<HTMLUListElement>(null);
  const hotId = useMemo(() => items.reduce<CascadeCategory | null>((best, c) => (!best || c.count > best.count ? c : best), null)?.id, [items]);

  const query = q.trim().toLowerCase();
  // The popular category comes first; the rest keep their order (Admin › Categories).
  const ordered = useMemo(() => [...items].sort((a, b) => Number(b.id === hotId) - Number(a.id === hotId)), [items, hotId]);
  const shown = query ? ordered.filter((c) => c.name.toLowerCase().includes(query) || c.subs.some((s) => s.name.toLowerCase().includes(query))) : ordered;

  useEffect(() => {
    const box = grid.current;
    if (!box) return;
    const level = document.querySelector("[data-motion]")?.getAttribute("data-motion") ?? "full";
    if (level === "off" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tiles = [...box.querySelectorAll<HTMLElement>(":scope > li")];
    // Delay per tile from its place in the grid: column first, then row (works at every screen width).
    const tops = [...new Set(tiles.map((el) => el.offsetTop))].sort((a, b) => a - b);
    const lefts = [...new Set(tiles.map((el) => el.offsetLeft))].sort((a, b) => a - b);
    tiles.forEach((el) => {
      const row = tops.indexOf(el.offsetTop);
      const col = lefts.indexOf(el.offsetLeft);
      el.style.setProperty("--d", `${col * 110 + row * 70}ms`);
    });
    // Already on screen when the page opens: play straight away; otherwise when scrolled to.
    box.classList.add("is-armed");
    const play = () => {
      box.classList.add("is-in");
      if (level !== "full") return;
      tiles.forEach((el) => {
        const num = el.querySelector<HTMLElement>("[data-count]");
        if (!num) return;
        const to = Number(num.dataset.count) || 0;
        const wait = parseFloat(el.style.getPropertyValue("--d")) + 350;
        if (to < 2) return;
        num.textContent = "0";
        window.setTimeout(() => {
          const start = performance.now();
          const step = (now: number) => {
            const k = Math.min(1, (now - start) / 900);
            num.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
            if (k < 1) requestAnimationFrame(step);
            else num.textContent = String(to);
          };
          requestAnimationFrame(step);
          // Animation frames pause in background tabs: make sure the real number is there regardless.
          window.setTimeout(() => { num.textContent = String(to); }, 1000);
        }, wait);
      });
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        play();
      }
    }, { threshold: 0.05 });
    io.observe(box);
    return () => io.disconnect();
    // Runs once: tiles added later by filtering animate in on their own (CSS).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div data-no-motion>
      <div className="mt-6 flex max-w-md items-center gap-2 rounded-2xl border border-line bg-surface px-3.5 focus-within:border-primary/60 focus-within:shadow-[0_0_0_4px_rgb(var(--color-primary)/0.12)]">
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <label className="flex-1">
          <span className="sr-only">{t("categories.filter")}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("categories.filter")} className="h-11 w-full border-0 bg-transparent text-sm text-ink outline-none placeholder:text-muted focus:ring-0" />
        </label>
        {q && (
          <button type="button" onClick={() => setQ("")} className="rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label={t("categories.clearFilter")}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 rounded-panel border border-line bg-surface p-10 text-center text-muted">{t("categories.noMatch", { query: q.trim() })}</p>
      ) : null}
      {/* data-no-motion: the site-wide scroll fades leave this grid to its own animation. */}
      <ul ref={grid} data-no-motion className="cg-cascade mt-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {shown.map((c) => {
          return (
            <li key={c.id} className={`cg-tile group relative flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface p-[18px] shadow-[0_18px_30px_-28px_rgb(var(--color-ink)/0.5)]${c.id === hotId && !query ? " cg-hot" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="cg-tile-ic grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <Icon name={c.icon} className="h-[22px] w-[22px]" />
                </span>
                {c.id === hotId && !query && <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-fg">{t("categories.popular")}</span>}
              </div>
              <h2 className="font-display text-[15px] font-bold leading-snug text-ink">
                <Link href={`/categories/${c.slug}`} className="after:absolute after:inset-0 after:rounded-[18px] group-hover:text-primary">{c.name}</Link>
              </h2>
              <span className="text-xs font-bold text-primary">
                {t(c.count === 1 ? "categories.productsOne" : "categories.products", { count: "\u0001" }).split("\u0001").map((part, i) => (i === 0 ? <span key={i}>{part}<span data-count={c.count}>{c.count}</span></span> : <span key={i}>{part}</span>))}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
