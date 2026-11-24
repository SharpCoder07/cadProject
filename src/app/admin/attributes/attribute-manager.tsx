"use client";

import { useState } from "react";
import { Pencil, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { SortableList } from "@/components/admin/sortable";
import { ListPanel, PanelEmpty, showingAll } from "@/components/admin/list-panel";

import { useServerAction } from "@/components/admin/use-action";
import { slugify } from "@/lib/utils";
import { deleteAttributeAction, reorderAttributesAction, saveAttributeAction } from "./actions";

type Type = "BOOLEAN" | "SELECT" | "MULTISELECT" | "NUMBER" | "TEXT";
interface Attr { id: string | null; key: string; label: string; type: Type; group: string; unit: string | null; description: string | null; isFilterable: boolean; isComparable: boolean; showOnDetail: boolean; options: { id?: string; value: string; label: string; _k: string }[]; usage?: number }

const TYPE_LABEL: Record<Type, string> = { BOOLEAN: "Yes / no", SELECT: "Single choice", MULTISELECT: "Multiple choice", NUMBER: "Number", TEXT: "Text" };
const blank: Attr = { id: null, key: "", label: "", type: "MULTISELECT", group: "General", unit: null, description: null, isFilterable: true, isComparable: true, showOnDetail: true, options: [] };

export function AttributeManager({ attributes }: { attributes: Attr[] }) {
  const [list, setList] = useState(attributes);
  const [edit, setEdit] = useState<Attr | null>(null);
  const save = useServerAction(saveAttributeAction, { onSuccess: () => setEdit(null) });
  const del = useServerAction(deleteAttributeAction);
  const [ask, confirmDialog] = useConfirm();
  const reorder = useServerAction(reorderAttributesAction, { success: "Order saved" });
  const hasOptions = edit?.type === "SELECT" || edit?.type === "MULTISELECT";

  return (
    <>
      {confirmDialog}
      <ListPanel
        title="All attributes"
        meta={`${showingAll(list.length)} · drag to reorder`}
        actions={<Button size="sm" onClick={() => setEdit({ ...blank })}><Plus className="h-4 w-4" aria-hidden /> Add attribute</Button>}
      >
      {list.length === 0 ? (
        <PanelEmpty icon={<SlidersHorizontal className="h-5 w-5" />} title="No attributes yet" action={<Button size="sm" variant="secondary" onClick={() => setEdit({ ...blank })}><Plus className="h-4 w-4" aria-hidden /> Add attribute</Button>}>Start with things buyers filter by: supported platforms, GST compliance, integrations, languages.</PanelEmpty>
      ) : (
      <div className="p-2">
      <SortableList
        items={list}
        getId={(a) => a.id!}
        onReorder={(next) => { setList(next); void reorder.run({ ids: next.map((a) => a.id!) }); }}
        renderItem={(a, _i, handle) => (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-bg">
            {handle}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-ink">{a.label}</span>
              <span className="block truncate text-xs text-muted">{a.group} · {TYPE_LABEL[a.type]}{a.options.length ? ` · ${a.options.length} options` : ""} · used by {a.usage ?? 0} products</span>
            </span>
            {a.isFilterable && <Badge tone="primary">Filter</Badge>}
            {a.isComparable && <Badge>Compare</Badge>}
            <button type="button" onClick={() => setEdit(a)} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink" aria-label={`Edit ${a.label}`}><Pencil className="h-4 w-4" /></button>
            <button type="button" onClick={() => void ask({ title: `Delete “${a.label}”?`, message: `It disappears from the filters, and its values on ${a.usage ?? 0} ${a.usage === 1 ? "product" : "products"} are removed with it.`, recycleBin: true }).then((yes) => yes && void del.run({ id: a.id! }))} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger" aria-label={`Delete ${a.label}`}><Trash2 className="h-4 w-4" /></button>
          </div>
        )}
      />
      </div>
      )}
      </ListPanel>
      <Dialog open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? "Edit attribute" : "Add attribute"} size="lg">
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); const { id, usage: _u, options, ...rest } = edit; void save.run({ id, data: { ...rest, options: options.map(({ _k, ...o }) => o) } }); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Label" htmlFor="a-label" error={save.fieldErrors.label} required><Input id="a-label" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value, key: edit.id ? edit.key : slugify(e.target.value).replace(/-/g, "_").slice(0, 40) })} /></Field>
              <Field label="Key" htmlFor="a-key" error={save.fieldErrors.key} hint="Internal identifier."><Input id="a-key" value={edit.key} disabled={Boolean(edit.id)} onChange={(e) => setEdit({ ...edit, key: e.target.value })} /></Field>
              <Field label="Type" htmlFor="a-type"><Select id="a-type" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as Type })}>{Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
              <Field label="Group" htmlFor="a-group" hint="Groups rows on product and comparison pages."><Input id="a-group" value={edit.group} onChange={(e) => setEdit({ ...edit, group: e.target.value })} /></Field>
              {edit.type === "NUMBER" && <Field label="Unit" htmlFor="a-unit"><Input id="a-unit" value={edit.unit ?? ""} onChange={(e) => setEdit({ ...edit, unit: e.target.value || null })} /></Field>}
              <Field label="Help text" htmlFor="a-desc" className="sm:col-span-2"><Textarea id="a-desc" rows={2} value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value || null })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Switch label="Use as filter" checked={edit.isFilterable} disabled={edit.type === "TEXT" || edit.type === "NUMBER"} onChange={(e) => setEdit({ ...edit, isFilterable: e.target.checked })} />
              <Switch label="Show in comparisons" checked={edit.isComparable} onChange={(e) => setEdit({ ...edit, isComparable: e.target.checked })} />
              <Switch label="Show on product page" checked={edit.showOnDetail} onChange={(e) => setEdit({ ...edit, showOnDetail: e.target.checked })} />
            </div>
            {save.fieldErrors.isFilterable && <p className="text-xs text-danger">{save.fieldErrors.isFilterable[0]}</p>}
            {hasOptions && (
              <div>
                <p className="mb-2 text-sm font-medium">Options</p>
                {save.fieldErrors.options && <p className="mb-2 text-xs text-danger">{save.fieldErrors.options[0]}</p>}
                <SortableList
                  items={edit.options}
                  getId={(o) => o._k}
                  onReorder={(options) => setEdit({ ...edit, options })}
                  renderItem={(o, i, handle) => (
                    <div className="flex items-center gap-2">
                      {handle}
                      <Input value={o.label} onChange={(e) => setEdit({ ...edit, options: edit.options.map((x, j) => (j === i ? { ...x, label: e.target.value, value: x.id ? x.value : slugify(e.target.value).slice(0, 60) } : x)) })} placeholder="Option label" aria-label="Option label" className="h-9" />
                      <span className="w-32 truncate text-xs text-muted">{o.value}</span>
                      <button type="button" onClick={() => setEdit({ ...edit, options: edit.options.filter((_, j) => j !== i) })} className="rounded p-1 text-muted hover:text-danger" aria-label="Remove option"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                />
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setEdit({ ...edit, options: [...edit.options, { value: "", label: "", _k: `o${Date.now()}` }] })}><Plus className="h-4 w-4" aria-hidden /> Add option</Button>
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={save.pending}>Save attribute</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
