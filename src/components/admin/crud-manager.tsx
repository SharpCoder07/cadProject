"use client";

import { useEffect, useState } from "react";
import { Inbox, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Badge, EmptyState } from "@/components/ui/misc";
import { MediaField } from "./media-picker";
import { RelationPicker, type PickerType } from "./relation-picker";
import { RichTextEditor } from "./rich-text";
import { ComparisonSectionsEditor } from "./comparison-sections-editor";
import type { ComparisonSection } from "@/lib/comparison-sections";
import { SortableList } from "./sortable";
import { useBulkAction, useServerAction } from "./use-action";
import { SelectionBar } from "./bulk-table";
import { showingAll } from "./list-panel";
import { cn } from "@/lib/utils";

type Result<T = unknown> = { ok: true; data: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
type Values = Record<string, unknown>;

/** Field names like "seo.title" are saved as nested objects ({ seo: { title } }); "_"-prefixed keys are display-only. */
function nest(values: Values): Values {
  const out: Values = {};
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith("_")) continue;
    const parts = k.split(".");
    let node = out;
    parts.slice(0, -1).forEach((p) => { node[p] = (node[p] as Values | undefined) ?? {}; node = node[p] as Values; });
    node[parts[parts.length - 1]!] = v;
  }
  return out;
}
const noop = async (): Promise<Result> => ({ ok: true, data: null });

export interface CrudField {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "switch" | "datetime" | "media" | "rich" | "tags" | "picker" | "pickers" | "section" | "comparisonSections";
  /** For text/textarea: show a live character count against this limit. */
  max?: number;
  options?: { value: string; label: string }[];
  hint?: string;
  required?: boolean;
  placeholder?: string;
  picker?: PickerType;
  wide?: boolean;
  /** Optional preview URL key in row values for media fields. */
  previewKey?: string;
}

export interface CrudRow {
  id: string;
  /** Plain text, or rich content (logos, links) built on the server page. Status words become badges. */
  cells: (React.ReactNode | null)[];
  /** Text used by the quick search (defaults to the text cells). */
  searchText?: string;
  /** Name used in confirmations when the first cell is rich content. */
  name?: string;
  values: Values;
  active?: boolean;
}

const addEvent = (entity: string) => `crud-add:${entity}`;

/**
 * "Add …" button for the page header (top right, like Vendors). Opens the add dialog of the
 * CrudManager on the same page that has `addInHeader` and the same `entity`.
 */
export function CrudAddButton({ entity, label }: { entity: string; label: string }) {
  return (
    <Button size="sm" onClick={() => window.dispatchEvent(new Event(addEvent(entity)))}>
      <Plus className="h-4 w-4" aria-hidden /> {label}
    </Button>
  );
}

export function CrudManager({ columns, rows, fields, emptyValues, save, remove, reorder, toggle, newLabel = "Add", entity = "item", emptyText, dialogSize = "lg", addInHeader = false }: {
  columns: string[];
  rows: CrudRow[];
  fields: CrudField[];
  emptyValues: Values;
  save: (input: { id: string | null; data: Values }) => Promise<Result>;
  remove?: (input: { id: string }) => Promise<Result>;
  reorder?: (input: { ids: string[] }) => Promise<Result>;
  toggle?: (input: { id: string; isActive: boolean }) => Promise<Result>;
  newLabel?: string;
  entity?: string;
  emptyText?: string;
  dialogSize?: "md" | "lg" | "xl";
  /** The add button lives in the page header (<CrudAddButton entity=… />) instead of the panel. */
  addInHeader?: boolean;
}) {
  const [editing, setEditing] = useState<{ id: string | null; values: Values } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [order, setOrder] = useState(rows);
  useEffect(() => setOrder(rows), [rows]);
  useEffect(() => {
    if (!addInHeader) return;
    const open = () => setEditing({ id: null, values: emptyValues });
    window.addEventListener(addEvent(entity), open);
    return () => window.removeEventListener(addEvent(entity), open);
  }, [addInHeader, entity, emptyValues]);

  // ?edit=<id> opens that row's edit window (links from other admin pages).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("edit");
    const row = id ? rows.find((r) => r.id === id) : null;
    if (row) setEditing({ id: row.id, values: row.values });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on first load
  }, []);

  const saver = useServerAction(save, { onSuccess: () => setEditing(null), success: "Saved" });
  const remover = useServerAction<{ id: string }, unknown>(remove ?? noop, { onSuccess: () => setDeleting(null), success: "Deleted" });
  const reorderer = useServerAction<{ ids: string[] }, unknown>(reorder ?? noop, { success: "Order saved" });
  const toggler = useServerAction<{ id: string; isActive: boolean }, unknown>(toggle ?? noop);
  // Bulk select: show / hide / delete many rows at once.
  const bulk = useBulkAction();
  const selectable = Boolean(remove || toggle);
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkDelete, setBulkDelete] = useState(false);
  useEffect(() => setPicked((p) => p.filter((id) => rows.some((r) => r.id === id))), [rows]);
  const pick = (id: string, on: boolean) => setPicked((p) => (on ? [...new Set([...p, id])] : p.filter((x) => x !== id)));

  const set = (name: string, value: unknown) => setEditing((e) => (e ? { ...e, values: { ...e.values, [name]: value } } : e));
  const fe = (n: string) => saver.fieldErrors[n];

  const [q, setQ] = useState("");
  const textOf = (r: CrudRow) => r.searchText ?? r.cells.filter((c): c is string => typeof c === "string").join(" ");
  const nameOf = (r: CrudRow) => r.name ?? (typeof r.cells[0] === "string" ? r.cells[0] : entity);
  const visible = q.trim() ? rows.filter((r) => textOf(r).toLowerCase().includes(q.trim().toLowerCase())) : rows;
  const grid = { gridTemplateColumns: `minmax(0,1.6fr) repeat(${Math.max(columns.length - 1, 0)}, minmax(0,1fr))` };

  const cell = (c: React.ReactNode | null, i: number) => {
    if (typeof c === "string" && i > 0) {
      const tone = STATUS_TONE[c.toLowerCase()];
      if (tone) return <Badge tone={tone}>{c.charAt(0).toUpperCase() + c.slice(1)}</Badge>;
    }
    if (c === null || c === "") return <span className="text-muted/60">—</span>;
    return typeof c === "string" ? <span className={cn("block truncate", i === 0 ? "font-semibold text-ink" : "text-muted")}>{c}</span> : c;
  };

  const rowView = (r: CrudRow, handle?: React.ReactNode) => (
    <div className={cn("group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg/60 sm:px-5", r.active === false && "opacity-60", picked.includes(r.id) && "bg-mint-soft/50")}>
      {selectable && (
        <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => pick(r.id, e.target.checked)} aria-label={`Select ${nameOf(r)}`} className="h-4 w-4 shrink-0 rounded border-line text-primary" />
      )}
      {handle}
      <div className="grid min-w-0 flex-1 items-center gap-x-4 gap-y-1 text-sm sm:[grid-template-columns:var(--grid)]" style={{ ["--grid" as string]: grid.gridTemplateColumns }}>
        {r.cells.map((c, i) => (
          <div key={i} className="min-w-0">{cell(c, i)}</div>
        ))}
      </div>
      {toggle && r.active !== undefined && (
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={r.active} onChange={(e) => void toggler.run({ id: r.id, isActive: e.target.checked })} className="h-4 w-4 rounded border-line text-primary" />
          Active
        </label>
      )}
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => setEditing({ id: r.id, values: r.values })} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 transition hover:bg-surface hover:text-ink hover:shadow-[0_1px_3px_rgb(16_24_40/0.08)] hover:ring-1 hover:ring-line" aria-label={`Edit ${nameOf(r)}`} title="Edit">
          <Pencil className="h-4 w-4" />
        </button>
        {remove && (
          <button type="button" onClick={() => setDeleting(r.id)} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 transition hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${nameOf(r)}`} title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );

  const title = `${entity.charAt(0).toUpperCase()}${entity.slice(1)}s`;
  return (
    <div>
      {/* Same bulk bar as the other admin lists: above the list, sticky, small buttons. */}
      <SelectionBar count={picked.length} onClear={() => setPicked([])}>
        {toggle && (
          <>
            <Button size="sm" variant="secondary" loading={bulk.pending} onClick={() => void bulk.run(picked, (id) => toggle({ id, isActive: true }), "Showed", () => setPicked([]))}>Show</Button>
            <Button size="sm" variant="secondary" loading={bulk.pending} onClick={() => void bulk.run(picked, (id) => toggle({ id, isActive: false }), "Hid", () => setPicked([]))}>Hide</Button>
          </>
        )}
        {remove && <Button size="sm" variant="danger" onClick={() => setBulkDelete(true)}>Delete</Button>}
      </SelectionBar>
      <section className="overflow-hidden rounded-[20px] border border-line/80 bg-surface shadow-[0_1px_2px_rgb(var(--color-ink)/0.04),0_12px_32px_-24px_rgb(var(--color-ink)/0.25)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <h2 className="mr-auto text-[15px] font-bold text-ink">All {title.toLowerCase()}</h2>
          <p className="whitespace-nowrap text-xs text-muted" aria-live="polite">{showingAll(visible.length)}</p>
          {rows.length > 0 && (
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search {title.toLowerCase()}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQ("")}
                placeholder={`Search ${title.toLowerCase()}…`}
                className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear search">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </label>
          )}
          {!addInHeader && <Button size="sm" onClick={() => setEditing({ id: null, values: emptyValues })}><Plus className="h-4 w-4" aria-hidden /> {newLabel}</Button>}
        </div>
        {rows.length > 0 && (
          <div className="hidden items-center gap-3 border-b border-line bg-bg/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted sm:flex sm:px-5">
            {selectable && (
              <input
                type="checkbox"
                checked={visible.length > 0 && visible.every((r) => picked.includes(r.id))}
                onChange={(e) => setPicked(e.target.checked ? [...new Set([...picked, ...visible.map((r) => r.id)])] : picked.filter((id) => !visible.some((r) => r.id === id)))}
                aria-label="Select all"
                className="h-4 w-4 shrink-0 rounded border-line text-primary"
              />
            )}
            {reorder && <span className="w-6" />}
            <div className="grid flex-1 gap-x-4" style={grid}>{columns.map((c) => <span key={c} className="truncate">{c}</span>)}</div>
            {toggle && <span className="w-[3.75rem]" />}
            <span className={remove ? "w-[4.25rem]" : "w-8"} />
          </div>
        )}
        {rows.length === 0 ? (
          <EmptyState
            title={emptyText ?? `No ${entity}s yet`}
            icon={<span className="grid h-12 w-12 place-items-center rounded-2xl bg-bg ring-1 ring-line"><Inbox className="h-5 w-5" /></span>}
            action={<Button size="sm" variant="secondary" onClick={() => setEditing({ id: null, values: emptyValues })}><Plus className="h-4 w-4" aria-hidden /> {newLabel}</Button>}
          />
        ) : visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Nothing matches “{q.trim()}”.</p>
        ) : reorder && !q.trim() ? (
          <div className="divide-y divide-line">
            <SortableList items={order} getId={(r) => r.id} onReorder={(next) => { setOrder(next); void reorderer.run({ ids: next.map((r) => r.id) }); }} renderItem={(r, _i, handle) => rowView(r, handle)} />
          </div>
        ) : (
          <ul className="divide-y divide-line">{visible.map((r) => <li key={r.id}>{rowView(r)}</li>)}</ul>
        )}
      </section>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${entity}` : newLabel} size={dialogSize}>
        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); void saver.run({ id: editing.id, data: nest(editing.values) }); }} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((f) => {
                const v = editing.values[f.name];
                const id = `crud-${f.name}`;
                const control = (() => {
                  switch (f.type) {
                    case "text": return <Input id={id} value={(v as string) ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} aria-invalid={Boolean(fe(f.name))} />;
                    case "number": return <Input id={id} type="number" value={(v as number | null) ?? ""} onChange={(e) => set(f.name, e.target.value === "" ? null : Number(e.target.value))} />;
                    case "textarea": return <Textarea id={id} rows={4} value={(v as string) ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />;
                    case "select": return <Select id={id} value={(v as string) ?? ""} onChange={(e) => set(f.name, e.target.value || null)}>{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
                    case "switch": return <Switch label={f.label} hint={f.hint} checked={Boolean(v)} onChange={(e) => set(f.name, e.target.checked)} />;
                    case "datetime": return <Input id={id} type="datetime-local" value={(v as string) ?? ""} onChange={(e) => set(f.name, e.target.value || null)} />;
                    case "media": return <MediaField value={v as string | null} preview={f.previewKey ? (editing.values[f.previewKey] as string | null) : null} onChange={(mid, item) => { set(f.name, mid); if (f.previewKey) set(f.previewKey, item?.url ?? null); }} />;
                    case "rich": return <RichTextEditor value={(v as string) ?? ""} onChange={(html) => set(f.name, html)} />;
                    case "tags": return <Input id={id} value={Array.isArray(v) ? (v as string[]).join(", ") : ""} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />;
                    case "picker": return <RelationPicker type={f.picker ?? "software"} value={v ? [v as string] : []} onChange={(ids) => set(f.name, ids[0] ?? null)} />;
                    case "pickers": return <RelationPicker type={f.picker ?? "software"} multiple value={(v as string[]) ?? []} onChange={(ids) => set(f.name, ids)} />;
                    case "comparisonSections": return <ComparisonSectionsEditor value={(v as ComparisonSection[]) ?? []} onChange={(next) => set(f.name, next)} />;
                  }
                })();
                if (f.type === "section")
                  return (
                    <div key={f.name} className="border-t border-line pt-4 sm:col-span-2">
                      <p className="text-sm font-bold text-ink">{f.label}</p>
                      {f.hint && <p className="mt-0.5 text-xs text-muted">{f.hint}</p>}
                    </div>
                  );
                if (f.type === "switch") return <div key={f.name} className={cn(f.wide && "sm:col-span-2", "pt-1")}>{control}</div>;
                return (
                  <Field key={f.name} label={f.label} htmlFor={id} hint={f.max ? `${f.hint ? `${f.hint} · ` : ""}${String(v ?? "").length}/${f.max} characters` : f.hint} error={fe(f.name)} required={f.required} className={cn((f.wide || f.type === "rich" || f.type === "textarea" || f.type === "comparisonSections") && "sm:col-span-2")}>
                    {control}
                  </Field>
                );
              })}
            </div>
            {Object.keys(saver.fieldErrors).filter((k) => !fields.some((f) => f.name === k)).map((k) => (
              <p key={k} className="text-xs text-danger">{saver.fieldErrors[k]?.[0]}</p>
            ))}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={saver.pending}>Save</Button>
            </div>
          </form>
        )}
      </Dialog>
      <ConfirmDialog open={deleting !== null} onClose={() => setDeleting(null)} title={`Delete this ${entity}?`} confirmLabel="Delete" busy={remover.pending} recycleBin onConfirm={() => deleting && void remover.run({ id: deleting })}>
        It disappears from the website straight away.
      </ConfirmDialog>
      {remove && (
        <ConfirmDialog
          open={bulkDelete}
          onClose={() => setBulkDelete(false)}
          title={`Delete ${picked.length} ${picked.length === 1 ? entity : `${entity}s`}?`}
          confirmLabel="Delete"
          busy={bulk.pending}
          recycleBin
          onConfirm={() => void bulk.run(picked, (id) => remove({ id }), "Deleted", () => { setPicked([]); setBulkDelete(false); })}
        >
          They disappear from the website straight away.
        </ConfirmDialog>
      )}
    </div>
  );
}

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "primary"> = {
  published: "success", active: "success", live: "success", approved: "success", visible: "success",
  draft: "neutral", inactive: "neutral", hidden: "neutral", paused: "neutral",
  "in review": "warning", pending: "warning", scheduled: "primary",
  archived: "danger", rejected: "danger", expired: "danger", ended: "danger",
};

export const ActiveBadge = ({ active }: { active: boolean }) => (active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>);
