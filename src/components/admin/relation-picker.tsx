"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { controlClass } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type PickerType = "software" | "vendor" | "brand" | "category" | "page" | "industry";
export interface PickerItem {
  id: string;
  label: string;
  meta?: string | null;
}

async function fetchItems(type: PickerType, params: Record<string, string>) {
  const sp = new URLSearchParams({ type, ...params });
  const res = await fetch(`/api/picker?${sp.toString()}`);
  if (!res.ok) return [];
  return ((await res.json()) as { items: PickerItem[] }).items;
}

/** Typeahead picker for relations. Single mode stores one id; multi mode keeps order (useful for rankings). */
export function RelationPicker({ type, value, onChange, multiple = false, placeholder = "Search…", max = 50, id, disabled, exclude }: { type: PickerType; value: string[]; onChange: (ids: string[]) => void; multiple?: boolean; placeholder?: string; max?: number; id?: string; disabled?: boolean; /** Ids to leave out of the search results (e.g. already added). */ exclude?: string[] }) {
  const [labels, setLabels] = useState<Record<string, PickerItem>>({});
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickerItem[]>([]);
  const [open, setOpen] = useState(false);
  const loaded = useRef(new Set<string>());

  // Resolve labels for ids we haven't seen.
  useEffect(() => {
    const missing = value.filter((v) => !loaded.current.has(v));
    if (!missing.length) return;
    missing.forEach((m) => loaded.current.add(m));
    void fetchItems(type, { ids: missing.join(",") }).then((items) => setLabels((l) => ({ ...l, ...Object.fromEntries(items.map((i) => [i.id, i])) })));
  }, [type, value]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void fetchItems(type, { q }).then(setResults), 150);
    return () => clearTimeout(t);
  }, [q, open, type]);

  const shown = results.filter((r) => !value.includes(r.id) && !exclude?.includes(r.id));

  const add = (item: PickerItem) => {
    setLabels((l) => ({ ...l, [item.id]: item }));
    loaded.current.add(item.id);
    onChange(multiple ? (value.includes(item.id) || value.length >= max ? value : [...value, item.id]) : [item.id]);
    setQ("");
    if (!multiple) setOpen(false);
  };

  return (
    <div className="relative">
      {value.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-control border border-line bg-bg py-0.5 pl-2 pr-1 text-sm">
              {multiple && value.length > 1 && <span className="text-xs text-muted">{i + 1}.</span>}
              {labels[v]?.label ?? "…"}
              {!disabled && (
                <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="rounded p-0.5 text-muted hover:bg-ink/5 hover:text-danger" aria-label={`Remove ${labels[v]?.label ?? "item"}`}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {(multiple || value.length === 0) && !disabled && (
        <input
          id={id}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className={cn(controlClass, "h-9")}
          autoComplete="off"
        />
      )}
      {open && shown.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto admin-card py-1 shadow-lg">
          {shown.map((r) => (
            <li key={r.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => add(r)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-mint-soft">
                <span>{r.label}</span>
                {r.meta && <span className="text-xs text-muted">{r.meta}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
