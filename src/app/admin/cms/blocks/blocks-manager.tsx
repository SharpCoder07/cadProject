"use client";

import { useEffect, useState } from "react";
import { Blocks, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { BLOCK_META, BLOCK_TYPES, defaultBlockData, type BlockType } from "@/lib/blocks/schemas";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { ListPanel, PanelEmpty, showingAll } from "@/components/admin/list-panel";
import { BLOCK_FIELDS } from "@/components/admin/blocks/block-fields";
import { BlockForm } from "@/components/admin/blocks/block-form";
import { useBulkAction, useServerAction } from "@/components/admin/use-action";
import { SelectionBar } from "@/components/admin/bulk-table";
import { deleteBlockAction, saveBlockAction } from "../actions";

interface Block { id: string; name: string; type: string; data: Record<string, unknown>; usages: number }

const ADD_EVENT = "blocks:add";

/** "New block" button for the page header (top right). */
export function NewBlockButton() {
  return (
    <Button size="sm" onClick={() => window.dispatchEvent(new Event(ADD_EVENT))}>
      <Plus className="h-4 w-4" aria-hidden /> New block
    </Button>
  );
}

export function BlocksManager({ blocks }: { blocks: Block[] }) {
  const [editing, setEditing] = useState<{ id: string | null; name: string; type: string; data: Record<string, unknown> } | null>(null);
  const save = useServerAction(saveBlockAction, { onSuccess: () => setEditing(null) });
  const del = useServerAction(deleteBlockAction);
  const [ask, confirmDialog] = useConfirm();
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term ? blocks.filter((b) => `${b.name} ${BLOCK_META[b.type as BlockType]?.label ?? b.type}`.toLowerCase().includes(term)) : blocks;
  // Bulk select: delete several blocks at once (blocks still used on a page are skipped).
  const [picked, setPicked] = useState<string[]>([]);
  const bulk = useBulkAction();
  const allOn = shown.length > 0 && shown.every((b) => picked.includes(b.id));
  const pick = (id: string, on: boolean) => setPicked((x) => (on ? [...x, id] : x.filter((i) => i !== id)));
  const bulkDelete = () =>
    void ask({ title: `Delete ${picked.length} ${picked.length === 1 ? "block" : "blocks"}?`, message: "Blocks still used on a page are skipped; remove them from those sections first.", recycleBin: true }).then(
      (yes) => yes && void bulk.run(picked, (id) => deleteBlockAction({ id }), "Deleted", () => setPicked([])),
    );
  useEffect(() => {
    const onAdd = () => setEditing({ id: null, name: "", type: "CTA", data: defaultBlockData("CTA") });
    window.addEventListener(ADD_EVENT, onAdd);
    return () => window.removeEventListener(ADD_EVENT, onAdd);
  }, []);
  return (
    <>
      {confirmDialog}
      <SelectionBar count={picked.length} onClear={() => setPicked([])}>
        <Button size="sm" variant="danger" loading={bulk.pending} onClick={bulkDelete}>Delete</Button>
      </SelectionBar>
      <ListPanel
        title="All blocks"
        meta={showingAll(shown.length)}
        actions={
          blocks.length > 0 && (
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search blocks</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQ("")}
                placeholder="Search blocks…"
                autoComplete="off"
                className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear search">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </label>
          )
        }
      >
      {blocks.length === 0 ? (
        <PanelEmpty icon={<Blocks className="h-5 w-5" />} title="No reusable blocks yet" action={<Button size="sm" variant="secondary" onClick={() => setEditing({ id: null, name: "", type: "CTA", data: defaultBlockData("CTA") })}><Plus className="h-4 w-4" aria-hidden /> New block</Button>}>Create a block once — such as a promotional call-to-action — and place it on many pages.</PanelEmpty>
      ) : shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Nothing matches “{q.trim()}”.</p>
      ) : (
        <>
        <div className="flex items-center gap-3 border-b border-line bg-bg/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted sm:px-5">
          <input type="checkbox" checked={allOn} onChange={(e) => setPicked(e.target.checked ? [...new Set([...picked, ...shown.map((b) => b.id)])] : picked.filter((id) => !shown.some((b) => b.id === id)))} aria-label="Select all" className="h-4 w-4 shrink-0 rounded border-line text-primary" />
          <span>Block</span>
        </div>
        <ul className="divide-y divide-line">
          {shown.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg/60 sm:px-5">
              <input type="checkbox" checked={picked.includes(b.id)} onChange={(e) => pick(b.id, e.target.checked)} aria-label={`Select ${b.name}`} className="h-4 w-4 shrink-0 rounded border-line text-primary" />
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint-ink"><Blocks className="h-4 w-4" aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{b.name}</span><span className="text-xs text-muted">{BLOCK_META[b.type as BlockType]?.label}</span></span>
              <Badge tone={b.usages ? "success" : "neutral"}>{b.usages ? `Used on ${b.usages} section${b.usages === 1 ? "" : "s"}` : "Not used"}</Badge>
              <button type="button" onClick={() => setEditing({ id: b.id, name: b.name, type: b.type, data: b.data })} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink" aria-label={`Edit ${b.name}`}><Pencil className="h-4 w-4" /></button>
              <button type="button" onClick={() => void ask({ title: `Delete “${b.name}”?`, message: b.usages ? "It is still used on some pages; remove it from those sections first." : undefined, recycleBin: true }).then((yes) => yes && void del.run({ id: b.id }))} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${b.name}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
        </>
      )}
      </ListPanel>
      <Dialog open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? "Edit block" : "New block"} size="xl">
        {editing && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save.run({ id: editing.id, data: { name: editing.name, type: editing.type, data: editing.data } }); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" htmlFor="rb-name" error={save.fieldErrors.name} required><Input id="rb-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Type" htmlFor="rb-type" hint={editing.id ? "A block’s type can’t change after it’s created." : undefined}>
                <Select id="rb-type" value={editing.type} disabled={Boolean(editing.id)} onChange={(e) => setEditing({ ...editing, type: e.target.value, data: defaultBlockData(e.target.value as BlockType) })}>
                  {BLOCK_TYPES.map((t) => <option key={t} value={t}>{BLOCK_META[t].label}</option>)}
                </Select>
              </Field>
            </div>
            <BlockForm fields={BLOCK_FIELDS[editing.type as BlockType] ?? []} value={editing.data} idPrefix="rb" onChange={(data) => setEditing({ ...editing, data })} />
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={save.pending}>Save block</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
