"use client";

import { useState } from "react";
import { ChevronRight, CornerDownRight, Plus, Trash2 } from "lucide-react";
import type { MenuItemInput } from "@/lib/validation/cms";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/field";
import { SortableList } from "@/components/admin/sortable";
import { RelationPicker } from "@/components/admin/relation-picker";
import { useServerAction } from "@/components/admin/use-action";
import { saveMenuAction } from "../actions";

type Item = MenuItemInput & { _k: string };
let seq = 0;
const k = () => `m${Date.now()}${seq++}`;
const withKeys = (items: MenuItemInput[]): Item[] => items.map((i) => ({ ...i, _k: i.id ?? k(), children: withKeys(i.children) }));
const strip = (items: Item[]): MenuItemInput[] => items.map(({ _k, id: _id, ...rest }) => ({ ...rest, children: strip(rest.children as Item[]) }));

function ItemRow({ item, depth, onChange, onRemove, onIndent, onOutdent, handle }: { item: Item; depth: number; onChange: (i: Item) => void; onRemove: () => void; onIndent?: () => void; onOutdent?: () => void; handle: React.ReactNode }) {
  const kind = item.pageId ? "page" : item.categoryId ? "category" : "url";
  const [mode, setMode] = useState<"url" | "page" | "category">(kind);
  return (
    <div className="admin-card p-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="pt-2">{handle}</div>
        <Input value={item.label} onChange={(e) => onChange({ ...item, label: e.target.value })} placeholder="Label" aria-label="Label" className="h-9 w-40" />
        <Select value={mode} onChange={(e) => { const m = e.target.value as typeof mode; setMode(m); onChange({ ...item, url: m === "url" ? item.url : null, pageId: null, categoryId: null }); }} className="h-9 w-32" aria-label="Link type">
          <option value="url">Link</option><option value="page">Page</option><option value="category">Category</option>
        </Select>
        <div className="min-w-[12rem] flex-1">
          {mode === "url" && <Input value={item.url ?? ""} onChange={(e) => onChange({ ...item, url: e.target.value })} placeholder="/compare or https://…" aria-label="URL" className="h-9" />}
          {mode === "page" && <RelationPicker type="page" value={item.pageId ? [item.pageId] : []} onChange={(ids) => onChange({ ...item, pageId: ids[0] ?? null })} placeholder="Find a page" />}
          {mode === "category" && <RelationPicker type="category" value={item.categoryId ? [item.categoryId] : []} onChange={(ids) => onChange({ ...item, categoryId: ids[0] ?? null })} placeholder="Find a category" />}
        </div>
        <Input value={item.badge ?? ""} onChange={(e) => onChange({ ...item, badge: e.target.value || null })} placeholder="Badge" aria-label="Badge" className="h-9 w-20" />
        <div className="flex items-center gap-1">
          {onOutdent && <button type="button" onClick={onOutdent} className="rounded p-1.5 text-muted hover:bg-ink/5" title="Move up a level" aria-label="Move up a level"><ChevronRight className="h-4 w-4 rotate-180" /></button>}
          {onIndent && depth < 2 && <button type="button" onClick={onIndent} className="rounded p-1.5 text-muted hover:bg-ink/5" title="Nest under previous item" aria-label="Nest under previous item"><CornerDownRight className="h-4 w-4" /></button>}
          <button type="button" onClick={onRemove} className="rounded p-1.5 text-muted hover:text-danger" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-2 flex gap-4 pl-8">
        <Checkbox label="Open in new tab" checked={item.openInNewTab} onChange={(e) => onChange({ ...item, openInNewTab: e.target.checked })} />
        <Checkbox label="Visible" checked={item.isActive} onChange={(e) => onChange({ ...item, isActive: e.target.checked })} />
      </div>
    </div>
  );
}

function Level({ items, depth, onChange, onOutdent }: { items: Item[]; depth: number; onChange: (items: Item[]) => void; onOutdent?: (item: Item) => void }) {
  return (
    <SortableList
      items={items}
      getId={(i) => i._k}
      onReorder={onChange}
      renderItem={(item, index, handle) => (
        <div>
          <ItemRow
            item={item}
            depth={depth}
            handle={handle}
            onChange={(next) => onChange(items.map((x) => (x._k === item._k ? next : x)))}
            onRemove={() => onChange(items.filter((x) => x._k !== item._k))}
            onIndent={index > 0 ? () => {
              const prev = items[index - 1]!;
              onChange(items.filter((x) => x._k !== item._k).map((x) => (x._k === prev._k ? { ...x, children: [...(x.children as Item[]), item] } : x)));
            } : undefined}
            onOutdent={onOutdent ? () => onOutdent(item) : undefined}
          />
          {item.children.length > 0 && (
            <div className="ml-8 mt-2">
              <Level
                items={item.children as Item[]}
                depth={depth + 1}
                onChange={(children) => onChange(items.map((x) => (x._k === item._k ? { ...x, children } : x)))}
                onOutdent={(child) => {
                  const without = items.map((x) => (x._k === item._k ? { ...x, children: (x.children as Item[]).filter((c) => c._k !== child._k) } : x));
                  without.splice(index + 1, 0, child);
                  onChange(without);
                }}
              />
            </div>
          )}
        </div>
      )}
    />
  );
}

export function MenuEditor({ menuKey, name, initial }: { menuKey: string; name: string; initial: MenuItemInput[] }) {
  const [items, setItems] = useState<Item[]>(withKeys(initial));
  const save = useServerAction(saveMenuAction);
  return (
    <div>
      <Level items={items} depth={0} onChange={setItems} />
      <div className="mt-4 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setItems([...items, { _k: k(), label: "", url: "", pageId: null, categoryId: null, badge: null, openInNewTab: false, isActive: true, children: [] }])}><Plus className="h-4 w-4" aria-hidden /> Add item</Button>
        <Button size="sm" className="ml-auto" loading={save.pending} onClick={() => void save.run({ key: menuKey, name, items: strip(items) })}>Save menu</Button>
      </div>
    </div>
  );
}
