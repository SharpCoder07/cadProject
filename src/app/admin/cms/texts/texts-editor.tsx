"use client";

import { useMemo, useState } from "react";
import { ExternalLink, RotateCcw, Search, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { TEXT_DEFAULTS } from "@/lib/site-texts";
import { TEXT_ENTRIES, TEXT_GROUPS } from "@/lib/site-text-catalog";
import { cn } from "@/lib/utils";
import { saveSettingAction } from "../../settings/actions";

const varsOf = (s: string) => [...new Set(s.match(/\{\w+\}/g) ?? [])];

/** Only texts that differ from the default are saved (an empty text is saved too: it hides that item where the page allows). */
const changesOf = (values: Record<string, string>) =>
  Object.fromEntries(Object.entries(values).filter(([k, v]) => k in TEXT_DEFAULTS && v !== TEXT_DEFAULTS[k]));

export function TextsEditor({ saved, initialGroup, initialQuery }: { saved: Record<string, string>; initialGroup?: string; initialQuery?: string }) {
  const start = useMemo(() => ({ ...TEXT_DEFAULTS, ...changesOf(saved) }), [saved]);
  const [values, setValues] = useState<Record<string, string>>(start);
  const [base, setBase] = useState<Record<string, string>>(start);
  const [group, setGroup] = useState(TEXT_GROUPS.some((g) => g.key === initialGroup) ? initialGroup! : TEXT_GROUPS[0]!.key);
  const [q, setQ] = useState(initialQuery ?? "");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const save = useServerAction(saveSettingAction, { success: "Website texts saved — the site is updated", onSuccess: () => setBase(values) });

  const dirtyKeys = Object.keys(values).filter((k) => values[k] !== base[k]);
  const changedIn = (g: string) => TEXT_ENTRIES.filter((e) => e.group === g && values[e.key] !== TEXT_DEFAULTS[e.key]).length;
  const term = q.trim().toLowerCase();
  const shown = TEXT_ENTRIES.filter((e) => {
    if (onlyChanged && values[e.key] === TEXT_DEFAULTS[e.key]) return false;
    if (term) return e.label.toLowerCase().includes(term) || (values[e.key] ?? "").toLowerCase().includes(term) || (TEXT_DEFAULTS[e.key] ?? "").toLowerCase().includes(term) || e.key.toLowerCase().includes(term);
    return onlyChanged || e.group === group;
  });
  const searching = Boolean(term) || onlyChanged;
  const groupOf = Object.fromEntries(TEXT_GROUPS.map((g) => [g.key, g]));
  const active = groupOf[group]!;
  const totalChanged = TEXT_ENTRIES.filter((e) => values[e.key] !== TEXT_DEFAULTS[e.key]).length;
  const set = (k: string, v: string) => setValues((o) => ({ ...o, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save.run({ key: "texts", value: changesOf(values) });
      }}
      className="grid items-start gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]"
    >
      {/* Groups */}
      <nav aria-label="Text groups" className="rounded-panel border border-line bg-surface p-2 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
        <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5">
          {TEXT_GROUPS.map((g) => {
            const n = changedIn(g.key);
            return (
              <li key={g.key} className="shrink-0">
                <button
                  type="button"
                  onClick={() => { setGroup(g.key); setQ(""); setOnlyChanged(false); }}
                  className={cn("flex w-full items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-sm transition", !searching && group === g.key ? "bg-mint-soft font-semibold text-mint-ink" : "text-ink hover:bg-bg")}
                >
                  <span className="truncate">{g.label}</span>
                  {n > 0 && <span className="rounded-full bg-accent/15 px-1.5 text-[11px] font-bold text-accent" title={`${n} changed`}>{n}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface p-3">
          <label className="relative min-w-[14rem] flex-1">
            <span className="sr-only">Search all texts</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search every text, e.g. “free quote”" className="h-10 w-full rounded-control border border-line bg-bg pl-9 pr-8 text-sm outline-none focus:border-mint" />
            {q && (
              <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink" aria-label="Clear search">
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyChanged} onChange={(e) => setOnlyChanged(e.target.checked)} className="h-4 w-4 rounded border-line" />
            Only changed ({totalChanged})
          </label>
        </div>

        <div className="rounded-panel border border-line bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <div>
              <h2 className="font-semibold text-ink">{searching ? (term ? `Texts matching “${q.trim()}”` : "Changed texts") : active.label}</h2>
              <p className="text-xs text-muted">{shown.length} {shown.length === 1 ? "text" : "texts"}</p>
            </div>
            {!searching && (
              <a href={active.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-mint-ink hover:underline">
                See it on the website <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
          {shown.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-muted">No texts found.</p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((e) => {
                const def = TEXT_DEFAULTS[e.key] ?? "";
                const v = values[e.key] ?? "";
                const changed = v !== def;
                const missing = varsOf(def).filter((x) => !v.includes(x));
                const long = def.length > 90 || v.length > 90;
                const id = `text-${e.key}`;
                return (
                  <li key={e.key} className={cn("px-5 py-4", changed && "bg-accent/[0.04]")}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <label htmlFor={id} className="text-sm font-semibold text-ink">{e.label}</label>
                      {searching && <span className="text-xs text-muted">· {groupOf[e.group]?.label}</span>}
                      {changed && <Badge tone="accent">Changed</Badge>}
                      {changed && v === "" && <Badge tone="warning">Empty — hidden or blank on the site</Badge>}
                      {changed && (
                        <button type="button" onClick={() => set(e.key, def)} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-mint-ink">
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Use default
                        </button>
                      )}
                    </div>
                    {long ? (
                      <textarea id={id} value={v} rows={Math.min(6, Math.max(2, Math.ceil(Math.max(v.length, def.length) / 90)))} maxLength={4000} onChange={(ev) => set(e.key, ev.target.value)} className="w-full rounded-control border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-mint" />
                    ) : (
                      <input id={id} value={v} maxLength={4000} onChange={(ev) => set(e.key, ev.target.value)} className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm outline-none focus:border-mint" />
                    )}
                    {changed && <p className="mt-1 text-xs text-muted">Default: <span className="text-ink/80">{def || "(empty)"}</span></p>}
                    {varsOf(def).length > 0 && (
                      <p className={cn("mt-1 text-xs", missing.length ? "text-warning" : "text-muted")}>
                        {missing.length ? `Not used any more: ${missing.join(" ")} — the page will leave it out.` : `Filled in by the page: ${varsOf(def).join(" ")}`}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface/95 px-4 py-3 shadow-[0_-12px_30px_-24px_rgb(16_24_40/0.5)] backdrop-blur">
          <Button size="sm" type="submit" loading={save.pending} disabled={dirtyKeys.length === 0}>Save</Button>
          {dirtyKeys.length > 0 && (
            <Button size="sm" type="button" variant="secondary" onClick={() => setValues(base)} disabled={save.pending}>
              <Undo2 className="h-4 w-4" aria-hidden /> Discard changes
            </Button>
          )}
          <span className="text-sm text-muted">{dirtyKeys.length ? `${dirtyKeys.length} unsaved ${dirtyKeys.length === 1 ? "change" : "changes"}` : "All changes saved"}</span>
        </div>
      </div>
    </form>
  );
}
