"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2, Wand2, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { ListPanel, PILL_TRACK, pillTab } from "@/components/admin/list-panel";
import { useServerAction } from "@/components/admin/use-action";
import { saveCompareShowcaseAction } from "../../reviews/actions";

type Item = { comparisonId: string; label: string };
type List = { mode: "auto" | "manual"; hidden: boolean; limit: number; items: Item[] };
type Value = { trending: List; byCategory: List };
type Comparison = { id: string; slug: string; title: string; status: string; products: string[] };

const SECTIONS = [
  { key: "trending" as const, title: "Trending product comparisons", labelHint: "Small line under the products (automatic: the category name)" },
  { key: "byCategory" as const, title: "Popular comparisons by category", labelHint: "Card heading (automatic: the category name)" },
];

export function ShowcaseEditor({ initial, auto, comparisons }: { initial: Value; auto: { trending: string[]; byCategory: string[] }; comparisons: Comparison[] }) {
  const [value, setValue] = useState<Value>(initial);
  const save = useServerAction(saveCompareShowcaseAction);
  const dirty = JSON.stringify(value) !== JSON.stringify(initial);
  const update = (key: keyof Value, patch: Partial<List>) => setValue((v) => ({ ...v, [key]: { ...v[key], ...patch } }));

  return (
    <div className="space-y-5">
      {SECTIONS.map((sec) => (
        <SectionEditor key={sec.key} title={sec.title} labelHint={sec.labelHint} list={value[sec.key]} autoList={auto[sec.key]} comparisons={comparisons} onChange={(patch) => update(sec.key, patch)} />
      ))}
      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[0_12px_32px_-20px_rgb(0_0_0/0.4)] backdrop-blur">
        <span className="mr-auto text-sm text-muted">{dirty ? "You have unsaved changes." : "Saved."}</span>
        <Link href="/compare" target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">View compare page <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>
        <Button size="sm" variant="secondary" disabled={!dirty || save.pending} onClick={() => setValue(initial)}>Undo changes</Button>
        <Button size="sm" loading={save.pending} disabled={!dirty} onClick={() => void save.run({ value })}>Save</Button>
      </div>
    </div>
  );
}

function SectionEditor({ title, labelHint, list, autoList, comparisons, onChange }: { title: string; labelHint: string; list: List; autoList: string[]; comparisons: Comparison[]; onChange: (p: Partial<List>) => void }) {
  const [adding, setAdding] = useState("");
  const byId = useMemo(() => new Map(comparisons.map((c) => [c.id, c])), [comparisons]);
  const available = comparisons.filter((c) => !list.items.some((i) => i.comparisonId === c.id));
  const setItems = (items: Item[]) => onChange({ items });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.items.length) return;
    const next = [...list.items];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setItems(next);
  };

  return (
    <ListPanel
      title={title}
      meta={list.hidden ? "Hidden" : list.mode === "auto" ? `Automatic · ${Math.min(list.limit, autoList.length)} shown` : `Hand-picked · ${Math.min(list.limit, list.items.length)} shown`}
      tabs={
        <div className={PILL_TRACK} role="radiogroup" aria-label={`${title}: source`}>
          <button type="button" role="radio" aria-checked={list.mode === "auto"} className={pillTab(list.mode === "auto")} onClick={() => onChange({ mode: "auto" })}><Wand2 className="h-3.5 w-3.5" aria-hidden /> Automatic</button>
          <button type="button" role="radio" aria-checked={list.mode === "manual"} className={pillTab(list.mode === "manual")} onClick={() => onChange({ mode: "manual" })}><Hand className="h-3.5 w-3.5" aria-hidden /> Hand-picked</button>
        </div>
      }
    >
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cards to show" hint="1–12">
            <Input type="number" min={1} max={12} value={list.limit} onChange={(e) => onChange({ limit: Math.max(1, Math.min(12, Number(e.target.value) || 1)) })} />
          </Field>
          <div className="pt-6">
            <Switch label="Hide this section" hint="Removes it from the compare page." checked={list.hidden} onChange={(e) => onChange({ hidden: e.target.checked })} />
          </div>
        </div>

        {list.mode === "auto" ? (
          <div className="rounded-xl border border-line bg-bg/60 p-4">
            <p className="text-sm font-semibold text-ink">Showing now (from popularity)</p>
            {autoList.length ? (
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
                {autoList.slice(0, list.limit).map((t) => <li key={t}>{t}</li>)}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-muted">Nothing yet — categories need at least two published products.</p>
            )}
            <p className="mt-3 text-xs text-muted">Switch to <strong>Hand-picked</strong> to choose your own comparisons, with their introduction, sections and verdict.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.items.length === 0 && <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No comparisons picked yet. Add published comparisons below; the section stays empty until you do.</p>}
            {list.items.map((it, i) => {
              const c = byId.get(it.comparisonId);
              return (
                <div key={it.comparisonId} className="flex flex-wrap items-start gap-3 rounded-xl border border-line bg-surface p-3">
                  <span className="grid h-6 min-w-6 place-items-center rounded-md bg-bg px-1.5 text-xs font-bold text-muted">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {c?.title ?? "Deleted comparison"}
                      {c && c.status !== "PUBLISHED" && <Badge tone="warning">Not published — hidden on the website</Badge>}
                    </p>
                    {c && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                        <span>{c.products.join(" vs ")} · /compare/{c.slug}</span>
                        <Link href={`/admin/comparisons?edit=${c.id}`} className="font-semibold text-primary hover:underline">Edit content &amp; sections</Link>
                        <Link href={`/compare/${c.slug}`} target="_blank" className="inline-flex items-center gap-0.5 font-semibold text-primary hover:underline">View <ExternalLink className="h-3 w-3" aria-hidden /></Link>
                      </p>
                    )}
                    <Input className="mt-2" value={it.label} placeholder={labelHint} onChange={(e) => setItems(list.items.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)))} />
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></IconBtn>
                    <IconBtn label="Move down" disabled={i === list.items.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></IconBtn>
                    <IconBtn label="Remove" danger onClick={() => setItems(list.items.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Add a comparison" className="min-w-[16rem] flex-1">
                <Select value={adding} onChange={(e) => setAdding(e.target.value)}>
                  <option value="">Choose a comparison…</option>
                  {available.map((c) => <option key={c.id} value={c.id}>{c.title}{c.status !== "PUBLISHED" ? " (not published)" : ""}</option>)}
                </Select>
              </Field>
              <Button size="sm" variant="secondary" disabled={!adding || list.items.length >= 24} onClick={() => { setItems([...list.items, { comparisonId: adding, label: "" }]); setAdding(""); }}>
                <Plus className="h-4 w-4" aria-hidden /> Add
              </Button>
              <Link href="/admin/comparisons" className="pb-2 text-xs font-medium text-primary hover:underline">Create a new comparison</Link>
            </div>
          </div>
        )}
      </div>
    </ListPanel>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink disabled:opacity-30 ${danger ? "hover:text-danger" : ""}`}>
      {children}
    </button>
  );
}
