"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, MapPin, X } from "lucide-react";
import { INDIAN_CITIES, splitCities, type City } from "@/lib/cities";
import { cn } from "@/lib/utils";
import { controlClass } from "./field";

/**
 * Searchable city drop-down. Type to filter (city or state), pick with the mouse or arrow keys and Enter.
 * `options` limits the choice to the admin's own list; without it every Indian city in lib/cities is offered
 * and a city that isn't listed can still be typed in. `multiple` picks several (saved as “Delhi, Noida”).
 */
export function CitySelect({ id, value, onChange, options, multiple = false, placeholder, invalid, labels }: { id: string; value: string; onChange: (v: string) => void; options?: string[]; multiple?: boolean; placeholder?: string; invalid?: boolean; labels: { search: string; other: (q: string) => string; none: string; remove: (c: string) => string } }) {
  const list: City[] = useMemo(() => (options?.length ? options.map((name) => ({ name, state: "" })) : INDIAN_CITIES), [options]);
  const strict = Boolean(options?.length);
  const picked = multiple ? splitCities(value) : value ? [value] : [];
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const term = q.trim().toLowerCase();
  const matches = useMemo(() => {
    const m = term ? list.filter((c) => c.name.toLowerCase().includes(term) || c.state.toLowerCase().includes(term)) : list;
    // Names starting with the typed text first.
    return [...m].sort((a, b) => Number(!a.name.toLowerCase().startsWith(term)) - Number(!b.name.toLowerCase().startsWith(term))).slice(0, 60);
  }, [list, term]);
  const exact = matches.some((c) => c.name.toLowerCase() === term);
  const rows: { name: string; state: string; other?: boolean }[] = [...matches, ...(!strict && term && !exact ? [{ name: q.trim().slice(0, 80), state: "", other: true }] : [])];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => setActive(0), [term]);

  const choose = (name: string) => {
    if (multiple) {
      const next = picked.includes(name) ? picked.filter((c) => c !== name) : [...picked, name].slice(0, 15);
      onChange(next.join(", "));
      setQ("");
      input.current?.focus();
    } else {
      onChange(name);
      setQ("");
      setOpen(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(rows.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { if (open && rows[active]) { e.preventDefault(); choose(rows[active]!.name); } }
    else if (e.key === "Escape") setOpen(false);
    else if (e.key === "Backspace" && multiple && !q && picked.length) onChange(picked.slice(0, -1).join(", "));
  };

  return (
    <div ref={box} className="relative">
      <div
        className={cn(controlClass, "flex min-h-10 cursor-text flex-wrap items-center gap-1.5 py-1.5 pl-9 pr-8", invalid && "border-danger")}
        onClick={() => { setOpen(true); input.current?.focus(); }}
      >
        <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden />
        {multiple && picked.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-0.5 pl-2.5 pr-1 text-xs font-semibold text-primary">
            {c}
            <button type="button" onClick={(e) => { e.stopPropagation(); onChange(picked.filter((x) => x !== c).join(", ")); }} className="rounded-full p-0.5 hover:bg-primary/15" aria-label={labels.remove(c)}>
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={input}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={invalid || undefined}
          aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={open || multiple ? q : value}
          placeholder={multiple ? (picked.length ? "" : placeholder || labels.search) : value || placeholder || labels.search}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-muted/70 focus:ring-0"
        />
        <ChevronDown className="pointer-events-none absolute right-2.5 top-3 h-4 w-4 text-muted" aria-hidden />
      </div>
      {open && (
        <ul id={listId} role="listbox" aria-multiselectable={multiple || undefined} className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-control border border-line bg-surface py-1 shadow-lg">
          {rows.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{labels.none}</li>
          ) : (
            rows.map((c, i) => {
              const sel = picked.includes(c.name);
              return (
                <li
                  key={`${c.name}-${c.state}-${c.other ? "o" : ""}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={sel}
                  onMouseDown={(e) => { e.preventDefault(); choose(c.name); }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm", i === active ? "bg-primary-soft" : "", sel && "font-semibold text-primary")}
                >
                  <span>{c.other ? labels.other(c.name) : c.name}{c.state && <span className="ml-2 text-xs font-normal text-muted">{c.state}</span>}</span>
                  {sel && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
