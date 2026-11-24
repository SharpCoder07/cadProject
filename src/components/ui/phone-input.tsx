"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { COUNTRIES, countryByIso, DEFAULT_COUNTRY, flagUrl, splitPhone, type Country } from "@/lib/countries";
import { cn } from "@/lib/utils";

function Flag({ iso, className }: { iso: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny remote flag
  return <img src={flagUrl(iso)} alt="" width={20} height={15} loading="lazy" className={cn("h-[15px] w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-black/10", className)} />;
}

const join = (c: Country, national: string) => (national ? `+${c.dial}${national}` : "");

/**
 * Phone number with a country picker (flag + calling code). The number box takes digits only and
 * stops at the country's length (10 for India). The value is "+<code><number>", e.g. "+919876543210",
 * or "" when empty. Pass `name` to also submit it in a plain form.
 */
export function PhoneInput({ value, onChange, id, name, invalid, disabled, placeholder, defaultCountry = DEFAULT_COUNTRY, onBlur }: { value: string | null | undefined; onChange: (v: string) => void; id?: string; name?: string; invalid?: boolean; disabled?: boolean; placeholder?: string; defaultCountry?: string; onBlur?: () => void }) {
  const initial = value ? splitPhone(value) : { country: countryByIso(defaultCountry), national: "" };
  const [country, setCountry] = useState<Country>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const search = useRef<HTMLInputElement>(null);

  // Follow outside changes (form reset, saved value loaded).
  useEffect(() => {
    if ((value ?? "") === join(country, national)) return;
    if (!value) { setNational(""); return; }
    const s = splitPhone(value);
    setCountry(s.country);
    setNational(s.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = box.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.min(Math.max(r.width, 280), window.innerWidth - 24);
      setPos({ top: r.bottom + 6, left: Math.max(12, Math.min(r.left, window.innerWidth - width - 12)), width });
    };
    place();
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    requestAnimationFrame(() => search.current?.focus());
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase().replace(/^\+/, "");
    if (!t) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(t) || c.iso.toLowerCase() === t || c.dial.startsWith(t));
  }, [q]);

  const update = (c: Country, n: string) => {
    const clean = n.replace(/\D/g, "").slice(0, c.max);
    setCountry(c);
    setNational(clean);
    onChange(join(c, clean));
  };

  const onType = (raw: string) => {
    // A pasted number with its country code ("+44 7700 900123") switches the country.
    if (raw.trim().startsWith("+")) {
      const s = splitPhone(raw);
      return update(s.country, s.national);
    }
    let digits = raw.replace(/\D/g, "");
    // A leading 0 is the trunk prefix used when dialling at home; it isn't part of the number (Italy excepted).
    if (country.iso !== "IT") digits = digits.replace(/^0+/, "");
    if (country.iso === "IN" && digits.length > 10) digits = digits.replace(/^91(?=[6-9]\d{9}$)/, "");
    update(country, digits);
  };

  return (
    <div ref={box} className={cn("flex h-10 w-full overflow-hidden rounded-control border bg-surface text-sm transition focus-within:border-mint focus-within:ring-4 focus-within:ring-mint-soft", invalid ? "border-danger" : "border-line", disabled && "opacity-60")}>
      {name && <input type="hidden" name={name} value={join(country, national)} />}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { setQ(""); setOpen((o) => !o); }}
        aria-label={`Country: ${country.name} (+${country.dial}). Change country`}
        aria-expanded={open}
        className="flex shrink-0 items-center gap-1.5 border-r border-line bg-bg/60 pl-2.5 pr-2 text-ink hover:bg-bg"
      >
        <Flag iso={country.iso} />
        <span className="tabular-nums">+{country.dial}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      </button>
      <input
        ref={input}
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        disabled={disabled}
        value={national}
        maxLength={country.max}
        placeholder={placeholder ?? (country.iso === "IN" ? "98765 43210" : `${country.min === country.max ? country.min : `${country.min}–${country.max}`} digits`)}
        aria-invalid={invalid || undefined}
        onChange={(e) => onType(e.target.value)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/^\s*\+/.test(text)) { e.preventDefault(); onType(text); }
        }}
        onBlur={onBlur}
        className="min-w-0 flex-1 border-0 bg-transparent px-3 tabular-nums text-ink outline-none placeholder:text-muted"
      />
      {open && pos && (
        <div style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }} className="z-[60] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_40px_-12px_rgb(16_24_40/0.3)]">
          <div className="relative border-b border-line p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={search}
              value={q}
              onChange={(e) => { e.stopPropagation(); setQ(e.target.value); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); if (list[0]) { update(list[0], national); setOpen(false); input.current?.focus(); } }
              }}
              placeholder="Search country or code"
              aria-label="Search country"
              className="h-9 w-full rounded-lg border border-line bg-bg/60 pl-8 pr-2 text-sm outline-none focus:border-mint"
            />
          </div>
          <ul role="listbox" aria-label="Countries" className="max-h-64 overflow-y-auto py-1">
            {list.length === 0 && <li className="px-3 py-3 text-sm text-muted">No country matches “{q}”.</li>}
            {list.map((c) => (
              <li key={c.iso}>
                <button
                  type="button"
                  role="option"
                  aria-selected={c.iso === country.iso}
                  onClick={() => { update(c, national); setOpen(false); input.current?.focus(); }}
                  className={cn("flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-bg", c.iso === country.iso && "bg-mint-soft/60")}
                >
                  <Flag iso={c.iso} />
                  <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                  <span className="tabular-nums text-muted">+{c.dial}</span>
                  {c.iso === country.iso && <Check className="h-4 w-4 text-mint-ink" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
