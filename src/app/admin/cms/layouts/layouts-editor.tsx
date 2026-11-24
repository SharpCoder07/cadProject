"use client";

import { PILL_TRACK, pillTab } from "@/components/admin/list-panel";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Eye, EyeOff, Lock, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SortableList, moveItem } from "@/components/admin/sortable";
import { useServerAction } from "@/components/admin/use-action";
import { LAYOUT_KEYS, LAYOUT_PAGES, resolveLayout, type LayoutEntry, type LayoutPageKey, type LayoutsSetting, type LayoutZone } from "@/lib/layouts";
import { cn } from "@/lib/utils";
import { saveSettingAction } from "../../settings/actions";

type Drafts = Record<LayoutPageKey, LayoutEntry[]>;

export function LayoutsEditor({ saved, initialPage, productDefaults }: { saved: LayoutsSetting; initialPage: LayoutPageKey; productDefaults: Record<string, boolean> }) {
  const build = (src: LayoutsSetting): Drafts => Object.fromEntries(LAYOUT_KEYS.map((k) => [k, resolveLayout(k, src[k], k === "product" ? productDefaults : {})])) as Drafts;
  const start = useMemo(() => build(saved), [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const [drafts, setDrafts] = useState(start);
  const [base, setBase] = useState(start);
  const [page, setPage] = useState<LayoutPageKey>(initialPage);
  const [askReset, setAskReset] = useState(false);
  const save = useServerAction(saveSettingAction, { success: "Page layouts saved — the website is updated", onSuccess: () => setBase(drafts) });

  const def = LAYOUT_PAGES[page];
  const zones: LayoutZone[] = def.zones;
  const list = drafts[page];
  const dirtyPages = LAYOUT_KEYS.filter((k) => JSON.stringify(drafts[k]) !== JSON.stringify(base[k]));
  const setList = (l: LayoutEntry[]) => setDrafts((d) => ({ ...d, [page]: l }));
  const toggle = (id: string) => setList(list.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)));
  /** Replaces one zone's entries in the page list, keeping the other zones where they are. */
  const setZone = (zone: LayoutZone, entries: LayoutEntry[]) => {
    const ids = new Set(zone.sections.map((s) => s.id));
    const rest = list.filter((e) => !ids.has(e.id));
    const at = list.findIndex((e) => ids.has(e.id));
    setList([...rest.slice(0, at), ...entries, ...rest.slice(at)]);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirtyPages.length) void save.run({ key: "layouts", value: drafts });
      }}
      className="space-y-4"
    >
      <div className={cn(PILL_TRACK, "flex-wrap")} role="tablist" aria-label="Pages">
        {LAYOUT_KEYS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={page === k} onClick={() => setPage(k)} className={pillTab(page === k)}>
            {LAYOUT_PAGES[k].label}
            {dirtyPages.includes(k) && <span className="h-2 w-2 rounded-full bg-accent" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      <section className="rounded-panel border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-semibold text-ink">{def.label}</h2>
            <p className="mt-0.5 max-w-3xl text-sm text-muted">{def.description}</p>
          </div>
          <a href={def.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-mint-ink hover:underline">
            See it on the website <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
        <div className="space-y-6 p-5">
          {zones.map((zone) => {
            const entries = zone.sections.map((s) => s.id).map((id) => list.find((e) => e.id === id)!).sort((a, b) => list.indexOf(a) - list.indexOf(b));
            const info = new Map(zone.sections.map((s) => [s.id, s]));
            const row = (e: LayoutEntry, i: number, handle: React.ReactNode) => {
              const s = info.get(e.id)!;
              return (
                <div className={cn("flex items-center gap-2 rounded-xl border px-2 py-2", e.visible ? "border-line bg-surface" : "border-dashed border-line bg-bg")}>
                  {handle}
                  {!zone.fixedOrder && <span className="w-6 text-center text-xs font-bold text-muted">{i + 1}</span>}
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-semibold", e.visible ? "text-ink" : "text-muted line-through")}>{s.label}</span>
                    {s.hint && <span className="block truncate text-xs text-muted">{s.hint}</span>}
                  </span>
                  {!e.visible && <Badge>Hidden</Badge>}
                  {!zone.fixedOrder && (
                    <span className="flex shrink-0">
                      <button type="button" onClick={() => setZone(zone, moveItem(entries, i, -1))} disabled={i === 0} className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30" aria-label={`Move ${s.label} up`}><ArrowUp className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setZone(zone, moveItem(entries, i, 1))} disabled={i === entries.length - 1} className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30" aria-label={`Move ${s.label} down`}><ArrowDown className="h-4 w-4" /></button>
                    </span>
                  )}
                  {s.required ? (
                    <span className="inline-flex h-8 items-center gap-1 px-2 text-xs text-muted" title="Always shown"><Lock className="h-3.5 w-3.5" aria-hidden /> Always</span>
                  ) : (
                    <button type="button" onClick={() => toggle(e.id)} aria-pressed={e.visible} className={cn("inline-flex h-8 items-center gap-1.5 rounded-control border px-2.5 text-xs font-semibold transition", e.visible ? "border-line text-ink hover:border-danger/40 hover:text-danger" : "border-mint text-mint-ink hover:bg-mint-soft")}>
                      {e.visible ? <><EyeOff className="h-3.5 w-3.5" aria-hidden /> Hide</> : <><Eye className="h-3.5 w-3.5" aria-hidden /> Show</>}
                    </button>
                  )}
                </div>
              );
            };
            return (
              <div key={zone.id}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">{zone.label}{!zone.fixedOrder && <span className="ml-2 font-normal normal-case tracking-normal">— drag or use the arrows to change the order</span>}</h3>
                {zone.fixedOrder ? (
                  <ul className="space-y-2">{entries.map((e, i) => <li key={e.id}>{row(e, i, null)}</li>)}</ul>
                ) : (
                  <SortableList items={entries} getId={(e) => e.id} onReorder={(l) => setZone(zone, l)} renderItem={row} />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface/95 px-4 py-3 shadow-[0_-12px_30px_-24px_rgb(16_24_40/0.5)] backdrop-blur">
        <Button size="sm" type="submit" loading={save.pending} disabled={!dirtyPages.length}>Save</Button>
        {dirtyPages.length > 0 && (
          <Button size="sm" type="button" variant="secondary" onClick={() => setDrafts(base)} disabled={save.pending}>
            <Undo2 className="h-4 w-4" aria-hidden /> Discard changes
          </Button>
        )}
        <Button size="sm" type="button" variant="ghost" onClick={() => setAskReset(true)}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Restore the default {def.label.toLowerCase()}
        </Button>
        <span className="text-sm text-muted">{dirtyPages.length ? `Unsaved changes: ${dirtyPages.map((k) => LAYOUT_PAGES[k].label).join(", ")}` : "All changes saved"}</span>
      </div>

      <ConfirmDialog
        open={askReset}
        onClose={() => setAskReset(false)}
        title={`Restore the default ${def.label.toLowerCase()}?`}
        confirmLabel="Restore default"
        tone="primary"
        onConfirm={() => { setList(resolveLayout(page, undefined)); setAskReset(false); }}
      >
        Every section comes back in its original order. Nothing changes on the website until you save.
      </ConfirmDialog>
    </form>
  );
}
