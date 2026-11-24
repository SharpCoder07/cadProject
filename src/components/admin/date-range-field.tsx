"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const short = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

function presets(): { label: string; from: string; to: string }[] {
  const t = new Date();
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  return [
    { label: "Today", from: iso(today), to: iso(today) },
    { label: "Yesterday", from: iso(addDays(today, -1)), to: iso(addDays(today, -1)) },
    { label: "Last 7 days", from: iso(addDays(today, -6)), to: iso(today) },
    { label: "Last 30 days", from: iso(addDays(today, -29)), to: iso(today) },
    { label: "This month", from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(today) },
    { label: "Last month", from: iso(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: iso(new Date(today.getFullYear(), today.getMonth(), 0)) },
  ];
}

/**
 * "Date" filter for a FilterBar: a button that opens quick ranges (Today, Last 7 days…) and a custom
 * From–To. It submits `from` and `to` (YYYY-MM-DD, both days included) with the rest of the filters.
 */
export function DateRangeField({ from: initialFrom, to: initialTo, label = "Date", hide = [] }: { from?: string; to?: string; label?: string; /** Quick ranges to leave out (by label) when the page already offers them. */ hide?: string[] }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const box = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const WIDTH = 304;

  // The panel is placed against the window (not inside the list card, which clips its contents):
  // under the button, and moved left when it would run off the right edge.
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = button.current?.getBoundingClientRect();
      if (!r) return;
      const max = window.innerWidth - WIDTH - 12;
      const left = r.left + WIDTH > window.innerWidth - 12 ? r.right - WIDTH : r.left;
      setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(left, max)) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const apply = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setOpen(false);
    // Let the hidden inputs update, then run the filter form.
    requestAnimationFrame(() => fromRef.current?.form?.requestSubmit());
  };
  const active = Boolean(initialFrom || initialTo);
  const quick = presets().filter((p) => !hide.includes(p.label));
  const preset = quick.find((p) => p.from === initialFrom && p.to === initialTo);
  const text = !active ? label : preset ? preset.label : initialFrom && initialTo ? (initialFrom === initialTo ? short(initialFrom) : `${short(initialFrom)} – ${short(initialTo)}`) : initialFrom ? `From ${short(initialFrom)}` : `Until ${short(initialTo!)}`;

  return (
    <div ref={box} className="relative shrink-0">
      <input ref={fromRef} type="hidden" name="from" value={from} />
      <input type="hidden" name="to" value={to} />
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn("inline-flex h-10 items-center gap-2 rounded-control border px-3 text-sm transition", active ? "border-mint bg-mint-soft text-ink" : "border-line bg-surface text-ink hover:border-ink/20")}
      >
        <CalendarDays className="h-4 w-4 text-muted" aria-hidden />
        {text}
        <ChevronDown className="h-4 w-4 text-muted" aria-hidden />
      </button>
      {open && pos && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, width: WIDTH }} className="z-50 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-[0_16px_40px_-12px_rgb(16_24_40/0.25)]">
          <div className="grid grid-cols-2 gap-1">
            {quick.map((p) => (
              <button key={p.label} type="button" onClick={() => apply(p.from, p.to)} className={cn("rounded-lg px-3 py-2 text-left text-sm transition hover:bg-bg", preset?.label === p.label ? "bg-mint-soft font-semibold text-mint-ink" : "text-ink")}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-line pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Custom</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-xs text-muted">
                From
                {/* No name: these only fill the hidden inputs above when you press Done. */}
                <input type="date" value={from} max={to || undefined} onChange={(e) => { e.stopPropagation(); setFrom(e.target.value); }} className="mt-1 h-10 w-full rounded-control border border-line bg-surface px-2 text-sm text-ink" />
              </label>
              <label className="text-xs text-muted">
                To
                <input type="date" value={to} min={from || undefined} onChange={(e) => { e.stopPropagation(); setTo(e.target.value); }} className="mt-1 h-10 w-full rounded-control border border-line bg-surface px-2 text-sm text-ink" />
              </label>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button type="button" onClick={() => apply("", "")} className="px-2 text-sm text-muted hover:text-ink">Clear dates</button>
            <button type="button" onClick={() => apply(from, to)} className="inline-flex h-9 items-center gap-1.5 rounded-control bg-ink px-4 text-sm font-semibold text-surface hover:bg-ink/90">
              <Check className="h-4 w-4" aria-hidden /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
