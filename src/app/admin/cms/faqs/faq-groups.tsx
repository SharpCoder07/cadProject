"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, buttonClass } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { SortableList } from "@/components/admin/sortable";
import { useServerAction } from "@/components/admin/use-action";
import { deleteFaqGroupAction, restoreFaqAction, saveFaqGroupAction } from "../actions";
import { VersionHistory, type VersionRow } from "@/components/admin/version-history";

interface Item { key: string; question: string; answer: string; isActive: boolean }
interface Group { id: string | null; key: string; title: string; items: Item[]; versions?: VersionRow[] }

function GroupEditor({ group }: { group: Group }) {
  const [g, setG] = useState(group);
  const save = useServerAction(saveFaqGroupAction);
  const del = useServerAction(deleteFaqGroupAction);
  const [ask, confirmDialog] = useConfirm();
  const setItem = (k: string, patch: Partial<Item>) => setG({ ...g, items: g.items.map((i) => (i.key === k ? { ...i, ...patch } : i)) });
  return (
    <Panel>
      <PanelHeader
        title={g.title || "New FAQ group"}
        description={g.key ? `Use group key “${g.key}” in an FAQ section.` : undefined}
        actions={g.id && (
          <>
          <button
            type="button"
            disabled={del.pending}
            onClick={() => void ask({ title: "Delete this FAQ group?", message: "Its questions go with it. FAQ sections that use this group will show nothing until you pick another group.", recycleBin: true }).then((yes) => yes && void del.run({ id: g.id! }))}
            className={buttonClass("danger", "sm")}
          >
            Delete
          </button>
          {confirmDialog}
          </>
        )}
      />
      <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void save.run({ id: g.id, data: { key: g.key, title: g.title, items: g.items.map(({ question, answer, isActive }) => ({ question, answer, isActive })) } }); }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" htmlFor={`fg-t-${g.id}`} error={save.fieldErrors.title}><Input id={`fg-t-${g.id}`} value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} /></Field>
          <Field label="Key" htmlFor={`fg-k-${g.id}`} error={save.fieldErrors.key} hint="Lowercase, e.g. general"><Input id={`fg-k-${g.id}`} value={g.key} onChange={(e) => setG({ ...g, key: e.target.value })} /></Field>
        </div>
        <SortableList
          items={g.items}
          getId={(i) => i.key}
          onReorder={(items) => setG({ ...g, items })}
          renderItem={(item, _i, handle) => (
            <div className="flex gap-2 rounded-panel border border-line p-3">
              <div className="pt-1">{handle}</div>
              <div className="flex-1 space-y-2">
                <Input value={item.question} onChange={(e) => setItem(item.key, { question: e.target.value })} placeholder="Question" aria-label="Question" />
                <Textarea rows={2} value={item.answer} onChange={(e) => setItem(item.key, { answer: e.target.value })} placeholder="Answer" aria-label="Answer" />
                <Switch label="Visible" checked={item.isActive} onChange={(e) => setItem(item.key, { isActive: e.target.checked })} />
              </div>
              <button type="button" onClick={() => setG({ ...g, items: g.items.filter((x) => x.key !== item.key) })} className="grid h-8 w-8 shrink-0 place-items-center self-start rounded-lg bg-danger/10 text-danger transition hover:bg-danger hover:text-white" aria-label="Remove question" title="Remove question"><Trash2 className="h-4 w-4" /></button>
            </div>
          )}
        />
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setG({ ...g, items: [...g.items, { key: `n${Date.now()}`, question: "", answer: "", isActive: true }] })}><Plus className="h-4 w-4" aria-hidden /> Add question</Button>
          <Button size="sm" type="submit" loading={save.pending} className="ml-auto">Save group</Button>
        </div>
        {g.id && <VersionHistory compact what="FAQ group" restore={restoreFaqAction} versions={group.versions ?? []} />}
      </form>
    </Panel>
  );
}

export function FaqGroups({ groups }: { groups: Group[] }) {
  const [extra, setExtra] = useState<Group[]>([]);
  return (
    <div className="space-y-6">
      {/* Keyed by the latest version so a group reloads after a save or restore. */}
      {[...groups, ...extra].map((g, i) => <GroupEditor key={g.id ? `${g.id}:${g.versions?.[0]?.version ?? 0}` : `new-${i}`} group={g} />)}
      <Button size="sm" variant="secondary" onClick={() => setExtra((x) => [...x, { id: null, key: "", title: "", items: [] }])}><Plus className="h-4 w-4" aria-hidden /> New FAQ group</Button>
    </div>
  );
}
