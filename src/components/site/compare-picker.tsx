"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Ban, GitCompareArrows, Loader2, Plus, Search, Star, Trash2, X } from "lucide-react";
import { COMPARE_SLOTS, compareUrl, type CompareProduct } from "@/lib/compare";
import { cn } from "@/lib/utils";
import { useCompare } from "./compare-context";
import { SITE_SEARCH_INPUT } from "./search-box";
import { useT } from "@/components/site/texts";

/** Clean comparison URL (/compare/a-vs-b); slugs are put in alphabetical order. */
const hrefFor = (slugs: string[]) => compareUrl(slugs);

export function CompareRemoveLink({ slugs, remove }: { slugs: string[]; remove: string }) {
  const tx = useT();
  return (
    <Link href={hrefFor(slugs.filter((s) => s !== remove))} scroll={false} className="mt-1 inline-block text-xs font-semibold text-danger hover:underline">
      {tx("comparePicker.remove")}
    </Link>
  );
}

function Logo({ url, name, size }: { url: string | null; name: string; size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-16 w-16 text-xl" : "h-11 w-11 text-sm";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- small uploaded logo
    <img src={url} alt="" className={cn("shrink-0 rounded-2xl border border-line bg-white object-contain p-1.5", box)} />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl border border-line bg-bg font-display font-bold text-muted", box)} aria-hidden>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function SlotNumber({ n }: { n: number }) {
  return <span className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface text-[11px] font-bold text-muted shadow-sm">{n}</span>;
}

/**
 * "Choose products" panel on the compare page: three slots, each filled from a searchable product
 * list. The URL (/compare/a-vs-b) is the source of truth, so a comparison can be shared or bookmarked.
 */
export function CompareBuilder({ selected }: { selected: CompareProduct[] }) {
  const tx = useT();
  const router = useRouter();
  const compare = useCompare();
  const [pending, start] = useTransition();
  const [slot, setSlot] = useState<number | null>(null);
  const slugs = selected.map((p) => p.slug);
  const hadSelection = useRef(false);

  const go = (next: string[]) => start(() => router.push(hrefFor(next), { scroll: false }));

  // The page shows only the products in its URL: opening /compare starts empty (products ticked
  // on listings are compared from the tray's Compare button). The tray follows the slots once
  // something is picked here, and is emptied when the last product is removed.
  useEffect(() => {
    if (!compare.ready) return;
    if (!selected.length && !hadSelection.current) return;
    hadSelection.current = selected.length > 0;
    const same = compare.items.length === selected.length && compare.items.every((i, n) => i.slug === selected[n]?.slug);
    if (!same) compare.set(selected.map((p) => ({ slug: p.slug, name: p.name, logoUrl: p.logoUrl })));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync when the selection or storage changes
  }, [compare.ready, slugs.join(",")]);

  const choose = (index: number, slug: string) => {
    const next = [...slugs];
    if (index < next.length) next[index] = slug;
    else next.push(slug);
    setSlot(null);
    go(next);
  };

  return (
    <section id="build" className="scroll-mt-28 rounded-[1.75rem] border border-line bg-surface p-5 shadow-[0_24px_60px_-40px_rgb(var(--color-ink)/0.35)] sm:p-7" aria-labelledby="choose-products">
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <GitCompareArrows className="h-5 w-5" aria-hidden />
        </span>
        <div className="mr-auto">
          <h2 id="choose-products" className="font-display text-base font-bold text-ink">{tx("comparePicker.title")}</h2>
          <p className="text-xs text-muted">{tx("comparePicker.text", { count: COMPARE_SLOTS })}</p>
        </div>
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label={tx("comparePicker.updating")} />}
        <span className="rounded-full bg-bg px-3 py-1.5 text-xs font-bold text-muted">
          {tx("comparePicker.selected", { n: selected.length, max: COMPARE_SLOTS })}
        </span>
        {selected.length > 0 && (
          <button type="button" onClick={() => go([])} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-danger hover:bg-danger/10">
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> {tx("comparePicker.clearAll")}
          </button>
        )}
      </div>

      <div className={cn("mt-5 grid gap-4 md:grid-cols-3", pending && "pointer-events-none opacity-60 transition-opacity")}>
        {Array.from({ length: COMPARE_SLOTS }).map((_, i) => {
          const p = selected[i];
          if (!p) {
            return (
              <button
                key={`empty-${i}`}
                type="button"
                onClick={() => setSlot(i)}
                className="group relative flex min-h-[16rem] flex-col items-center justify-center rounded-3xl border border-dashed border-line bg-bg/60 p-6 text-center transition hover:border-primary/40 hover:bg-primary-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="absolute left-4 top-4"><SlotNumber n={i + 1} /></span>
                <span className="grid h-16 w-16 place-items-center rounded-2xl border-2 border-dashed border-line bg-surface text-muted transition group-hover:border-primary/50 group-hover:text-primary">
                  <Plus className="h-6 w-6" aria-hidden />
                </span>
                <span className="mt-5 font-display text-base font-bold text-ink transition group-hover:text-primary">{tx("comparePicker.addProduct")}</span>
                <span className="mt-1.5 max-w-[14rem] text-sm text-muted">{tx("comparePicker.addText")}</span>
              </button>
            );
          }
          return (
            <div key={p.slug} className="relative flex flex-col items-center rounded-3xl border border-line bg-surface p-5 text-center shadow-[0_12px_32px_-28px_rgb(var(--color-ink)/0.5)]">
              <span className="absolute left-4 top-4"><SlotNumber n={i + 1} /></span>
              <div className="mt-6"><Logo url={p.logoUrl} name={p.name} size="lg" /></div>
              {p.maker && <p className="mt-5 max-w-full truncate text-[11px] font-bold uppercase tracking-[0.12em] text-primary">{p.maker}</p>}
              <Link href={`/software/${p.slug}`} className="mt-1 font-display text-xl font-bold text-ink hover:text-primary">{p.name}</Link>
              {p.category && <p className="mt-1 text-sm text-muted">{p.category}</p>}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm">
                {p.ratingCount > 0 ? (
                  <>
                    <Star className="h-4 w-4 text-accent" fill="currentColor" strokeWidth={0} aria-hidden />
                    <span className="font-bold text-ink">{p.rating.toFixed(1)}</span>
                    <span className="text-muted">({p.ratingCount.toLocaleString("en-IN")})</span>
                  </>
                ) : (
                  <span className="text-muted">{tx("comparePicker.noReviews")}</span>
                )}
              </p>
              <div className="mt-auto flex w-full gap-2 pt-5">
                <button type="button" onClick={() => setSlot(i)} className="h-10 flex-1 rounded-xl border border-line text-sm font-semibold text-ink transition hover:border-primary hover:text-primary">
                  {tx("comparePicker.change")}
                </button>
                <button
                  type="button"
                  onClick={() => go(slugs.filter((s) => s !== p.slug))}
                  className="grid h-10 w-10 place-items-center rounded-xl border border-danger/25 text-danger transition hover:bg-danger/10"
                  aria-label={tx("comparePicker.removeAria", { name: p.name })}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <ProductPickerDialog
        slot={slot}
        current={slot !== null ? selected[slot]?.slug ?? null : null}
        taken={slugs}
        onClose={() => setSlot(null)}
        onChoose={(slug) => slot !== null && choose(slot, slug)}
      />
    </section>
  );
}

/** "Choose product" dialog: searchable list of published products; ones already in another slot are disabled. */
function ProductPickerDialog({ slot, current, taken, onClose, onChoose }: { slot: number | null; current: string | null; taken: string[]; onClose: () => void; onChoose: (slug: string) => void }) {
  const tx = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ total: number; items: CompareProduct[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const open = slot !== null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setQ("");
      el.showModal();
    }
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/compare/products?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal })
        .then((r) => (r.ok ? r.json() : { total: 0, items: [] }))
        .then((d: { total: number; items: CompareProduct[] }) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => undefined);
    }, q ? 200 : 0);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q, open]);

  return (
    <dialog
      ref={ref}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.target === ref.current && onClose()}
      className="w-[calc(100%-2rem)] max-w-xl whitespace-normal rounded-[1.75rem] border border-line bg-surface p-0 text-left text-base font-normal text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-sm"
      aria-labelledby="choose-product-title"
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-5 pt-6">
            <div className="min-w-0 flex-1">
              <h2 id="choose-product-title" className="font-display text-xl font-bold">{tx("comparePicker.dialogTitle")}</h2>
              <div className="mt-1">
                <p className="text-xs text-muted" aria-live="polite">
                  {loading && !data
                    ? tx("comparePicker.loading")
                    : data
                      ? q.trim()
                        ? `${data.total === 1 ? tx("comparePicker.foundOne") : tx("comparePicker.found", { count: data.total.toLocaleString("en-IN") })}${data.total > data.items.length ? tx("comparePicker.showing", { n: data.items.length }) : ""}`
                        : tx("comparePicker.total", { count: data.total.toLocaleString("en-IN") })
                      : ""}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={tx("comparePicker.close")}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="border-b border-line px-6 py-4">
            <label className="relative block">
              <span className="sr-only">{tx("comparePicker.searchLabel")}</span>
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={tx("comparePicker.searchPlaceholder")}
                autoComplete="off"
                className={`h-12 w-full rounded-2xl bg-bg pl-11 pr-4 text-sm transition focus:bg-surface ${SITE_SEARCH_INPUT}`}
              />
            </label>
          </div>
          <ul className={cn("min-h-[12rem] flex-1 overflow-y-auto px-3 py-3 show-scrollbar", loading && "opacity-60")}>
            {!q.trim() && data && data.items.length > 0 && <li className="px-3 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{tx("comparePicker.recommended")}</li>}
            {data?.items.map((p) => {
              const isCurrent = p.slug === current;
              const disabled = taken.includes(p.slug) && !isCurrent;
              return (
                <li key={p.slug}>
                  <button
                    type="button"
                    disabled={disabled || isCurrent}
                    onClick={() => onChoose(p.slug)}
                    className={cn(
                      "flex w-full items-center gap-3.5 rounded-2xl px-3 py-3 text-left transition",
                      disabled ? "cursor-not-allowed opacity-45" : isCurrent ? "bg-primary-soft/50" : "hover:bg-bg focus-visible:bg-bg focus-visible:outline-none",
                    )}
                  >
                    <Logo url={p.logoUrl} name={p.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
                      <span className="block truncate text-xs text-muted">{[p.maker, p.category].filter(Boolean).join(" · ") || tx("comparePicker.software")}</span>
                      {disabled && (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
                          <Ban className="h-3 w-3" aria-hidden /> {tx("comparePicker.alreadySelected")}
                        </span>
                      )}
                    </span>
                    {isCurrent && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-fg">{tx("comparePicker.inThisSlot")}</span>}
                  </button>
                </li>
              );
            })}
            {data && data.items.length === 0 && !loading && (
              <li className="px-3 py-10 text-center text-sm text-muted">{tx("comparePicker.noMatch", { q })}</li>
            )}
          </ul>
        </div>
      )}
    </dialog>
  );
}
