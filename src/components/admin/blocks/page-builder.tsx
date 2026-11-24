"use client";

import { useState } from "react";
import { ChevronDown, Copy, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { BLOCK_META, BLOCK_TYPES, defaultBlockData, type BlockType } from "@/lib/blocks/schemas";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { SortableList } from "../sortable";
import { useServerAction } from "../use-action";
import { BLOCK_FIELDS } from "./block-fields";
import { BlockForm } from "./block-form";
import { saveSectionsAction } from "@/app/admin/cms/pages/actions";

export interface BuilderSection {
  key: string;
  id?: string;
  type: string;
  label: string | null;
  isEnabled: boolean;
  data: Record<string, unknown>;
  reusableBlockId: string | null;
  reusableName?: string;
}

let keySeq = 0;
const newKey = () => `new-${Date.now()}-${keySeq++}`;

/** Drag-and-drop section editor. Edits are local until “Save sections”, which saves the whole list atomically. */
export function PageBuilder({ pageId, initial, reusable, canDelete = true }: { pageId: string; initial: BuilderSection[]; reusable: { id: string; name: string; type: string }[]; /** Role may delete sections (lib/section-delete.ts); otherwise only hide. */ canDelete?: boolean }) {
  const [sections, setSections] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const save = useServerAction(saveSectionsAction, { onSuccess: () => { setDirty(false); setMessage(""); } });

  const update = (key: string, patch: Partial<BuilderSection>) => {
    setSections((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const add = (sec: BuilderSection) => {
    setSections((s) => [...s, sec]);
    setOpen(sec.key);
    setDirty(true);
    setAdding(false);
  };

  return (
    <div>
      {confirmDialog}
      <div className="sticky top-14 z-20 -mx-1 mb-4 flex flex-wrap items-center gap-2 bg-bg/95 px-1 py-2 backdrop-blur">
        <Button size="sm" onClick={() => setAdding(true)} variant="secondary"><Plus className="h-4 w-4" aria-hidden /> Add section</Button>
        <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Change note (optional)" className="h-10 max-w-xs" aria-label="Change note" />
        <Button size="sm"
          className="ml-auto"
          loading={save.pending}
          disabled={!dirty}
          onClick={() => void save.run({ pageId, revisionMessage: message || null, sections: sections.map((s) => ({ id: s.id, type: s.type, label: s.label, isEnabled: s.isEnabled, data: s.data, reusableBlockId: s.reusableBlockId })) })}
        >
          Save sections
        </Button>
        {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
      </div>

      {sections.length === 0 && <p className="rounded-panel border border-dashed border-line p-10 text-center text-sm text-muted">This page has no sections. Add one to start.</p>}

      <SortableList
        items={sections}
        getId={(s) => s.key}
        onReorder={(next) => { setSections(next); setDirty(true); }}
        renderItem={(s, i, handle) => {
          const meta = BLOCK_META[s.type as BlockType];
          const expanded = open === s.key;
          return (
            <div className={cn("rounded-panel border bg-surface", s.isEnabled ? "border-line" : "border-dashed border-line opacity-70")}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                {handle}
                <span className="w-6 text-center text-xs text-muted">{i + 1}</span>
                <button type="button" onClick={() => setOpen(expanded ? null : s.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={expanded}>
                  <span className="truncate text-sm font-medium">{s.label || meta?.label || s.type}</span>
                  {s.label && <span className="hidden text-xs text-muted sm:inline">{meta?.label}</span>}
                  {s.reusableBlockId && <Badge tone="primary">Reusable: {s.reusableName ?? "block"}</Badge>}
                  {!s.isEnabled && <Badge>Hidden</Badge>}
                  <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted transition-transform", expanded && "rotate-180")} aria-hidden />
                </button>
                <button type="button" onClick={() => update(s.key, { isEnabled: !s.isEnabled })} className="rounded p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={s.isEnabled ? "Hide section" : "Show section"} title={s.isEnabled ? "Hide" : "Show"}>
                  {s.isEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => add({ ...s, key: newKey(), id: undefined, label: s.label ? `${s.label} (copy)` : null })} className="rounded p-1.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Duplicate section" title="Duplicate">
                  <Copy className="h-4 w-4" />
                </button>
                {(canDelete || !s.id) && <button type="button" onClick={async () => { if (await confirm({ title: "Remove this section?", message: s.id ? "It goes when you click Save sections. Leave without saving to keep it." : "This new section hasn’t been saved yet, so it is simply removed.", confirmLabel: "Remove", recycleBin: Boolean(s.id) })) { setSections((x) => x.filter((y) => y.key !== s.key)); setDirty(true); } }} className="rounded p-1.5 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Remove section" title="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>}
              </div>
              {expanded && (
                <div className="space-y-4 border-t border-line p-4">
                  <Input value={s.label ?? ""} onChange={(e) => update(s.key, { label: e.target.value || null })} placeholder="Internal label (optional)" className="max-w-sm" aria-label="Internal label" />
                  {s.reusableBlockId ? (
                    <p className="text-sm text-muted">
                      This section shows the reusable block “{s.reusableName}”. Edit it under Content → Reusable blocks; changes apply on every page that uses it.
                    </p>
                  ) : (
                    <BlockForm fields={BLOCK_FIELDS[s.type as BlockType] ?? []} value={s.data} idPrefix={s.key} onChange={(data) => update(s.key, { data })} />
                  )}
                </div>
              )}
            </div>
          );
        }}
      />

      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a section" size="xl">
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {BLOCK_TYPES.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => add({ key: newKey(), type: t, label: null, isEnabled: true, data: defaultBlockData(t) as Record<string, unknown>, reusableBlockId: null })} className="h-full w-full rounded-panel border border-line p-3 text-left hover:border-mint hover:bg-mint-soft">
                <span className="block text-sm font-medium">{BLOCK_META[t].label}</span>
                <span className="mt-0.5 block text-xs text-muted">{BLOCK_META[t].description}</span>
              </button>
            </li>
          ))}
        </ul>
        {reusable.length > 0 && (
          <>
            <p className="mb-2 mt-6 text-sm font-semibold">Reusable blocks</p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {reusable.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => add({ key: newKey(), type: b.type, label: null, isEnabled: true, data: {}, reusableBlockId: b.id, reusableName: b.name })} className="w-full rounded-panel border border-line p-3 text-left hover:border-mint hover:bg-mint-soft">
                    <span className="block text-sm font-medium">{b.name}</span>
                    <span className="text-xs text-muted">{BLOCK_META[b.type as BlockType]?.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Dialog>
    </div>
  );
}
