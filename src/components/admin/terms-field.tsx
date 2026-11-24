"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search } from "lucide-react";
import { TAXONOMIES, type TaxonomyKind } from "@/lib/taxonomies";
import { cn } from "@/lib/utils";

export interface EditorTerm {
  id: string;
  kind: TaxonomyKind;
  name: string;
  parentId: string | null;
}

/** Toggle chips for every classification (professions, use cases, platforms…), grouped by taxonomy. */
export function TermsField({ terms, value, onChange, manageHref }: { terms: EditorTerm[]; value: string[]; onChange: (ids: string[]) => void; manageHref?: (key: string) => string }) {
  const [q, setQ] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const toggle = (id: string) => onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  const needle = q.trim().toLowerCase();

  return (
    <div className="space-y-5">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter terms…" className="h-9 w-full rounded-control border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-ink/30" aria-label="Filter terms" />
      </div>
      {TAXONOMIES.map((t) => {
        const all = terms.filter((x) => x.kind === t.kind);
        const shown = needle ? all.filter((x) => x.name.toLowerCase().includes(needle)) : all;
        const count = all.filter((x) => selected.has(x.id)).length;
        if (needle && !shown.length) return null;
        return (
          <fieldset key={t.kind}>
            <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              {t.plural}
              {count > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] font-semibold text-surface">{count}</span>}
              {manageHref && <Link href={manageHref(t.key)} target="_blank" className="ml-auto text-xs font-normal text-muted hover:text-ink hover:underline">Manage</Link>}
            </legend>
            {all.length === 0 ? (
              <p className="text-xs text-muted">No {t.plural.toLowerCase()} yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {shown.map((term) => {
                  const on = selected.has(term.id);
                  return (
                    <button
                      key={term.id}
                      type="button"
                      onClick={() => toggle(term.id)}
                      aria-pressed={on}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-ink bg-ink text-surface" : "border-line text-ink hover:border-ink/40", term.parentId && "italic")}
                    >
                      {on && <Check className="h-3 w-3" aria-hidden />}
                      {term.name}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
