"use client";

import { SelectionBar } from "@/components/admin/bulk-table";
import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/misc";
import { AdminTable } from "@/components/admin/page-header";
import { ROW_ICON } from "@/components/admin/list-panel";
import { useServerAction } from "@/components/admin/use-action";
import { cn } from "@/lib/utils";
import { deleteBinAction, emptyBinAction, restoreBinAction } from "../actions";

export interface BinRow {
  id: string;
  typeLabel: string;
  label: string;
  relatedCount: number;
  deletedByName: string | null;
  deletedAt: string;
  purgeAt: string;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const daysLeft = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));

export function BinTable({ items }: { items: BinRow[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [forever, setForever] = useState<string[] | null>(null);
  const clear = () => setPicked(new Set());
  const restore = useServerAction(restoreBinAction, { onSuccess: clear });
  const del = useServerAction(deleteBinAction, { onSuccess: () => { setForever(null); clear(); } });
  const allOn = items.length > 0 && items.every((i) => picked.has(i.id));
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const busy = restore.pending || del.pending;

  return (
    <>
      <SelectionBar count={picked.size} onClear={clear} slot="bin-bulk-bar">
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => void restore.run({ ids: [...picked] })}>Restore</Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => setForever([...picked])}>Delete for good</Button>
      </SelectionBar>
      <AdminTable bare minWidth={52}>
        <thead>
          <tr>
            <th className="w-10">
              <input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(items.map((i) => i.id)))} className="h-4 w-4 rounded border-line accent-[rgb(var(--color-action))]" />
            </th>
            <th>Item</th>
            <th>Deleted</th>
            <th>Removed for good</th>
            <th className="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => {
            const left = daysLeft(i.purgeAt);
            return (
              <tr key={i.id} className={cn(picked.has(i.id) && "bg-mint-soft/40")}>
                <td>
                  <input type="checkbox" aria-label={`Select ${i.label}`} checked={picked.has(i.id)} onChange={() => toggle(i.id)} className="h-4 w-4 rounded border-line accent-[rgb(var(--color-action))]" />
                </td>
                <td className="min-w-0">
                  <span className="block truncate font-medium text-ink" title={i.label}>{i.label}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <Badge>{i.typeLabel}</Badge>
                    {i.relatedCount > 0 && <span>+ {i.relatedCount} related record{i.relatedCount === 1 ? "" : "s"}</span>}
                  </span>
                </td>
                <td className="whitespace-nowrap text-muted">
                  <span className="block">{fmt(i.deletedAt)}</span>
                  <span className="text-xs">by {i.deletedByName ?? "System"}</span>
                </td>
                <td className="whitespace-nowrap">
                  <span className={cn("text-sm", left <= 7 ? "font-semibold text-danger" : "text-muted")}>{left === 0 ? "Today" : `In ${left} day${left === 1 ? "" : "s"}`}</span>
                </td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button type="button" disabled={busy} onClick={() => void restore.run({ ids: [i.id] })} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-ink transition hover:bg-surface hover:shadow-[0_1px_3px_rgb(16_24_40/0.08)] hover:ring-1 hover:ring-line disabled:opacity-50">
                      <RotateCcw className="h-4 w-4" aria-hidden /> Restore
                    </button>
                    <button type="button" disabled={busy} onClick={() => setForever([i.id])} className={cn(ROW_ICON, "hover:text-danger")} title="Delete for good" aria-label={`Delete ${i.label} for good`}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </AdminTable>
      <ConfirmDialog
        open={forever !== null}
        onClose={() => setForever(null)}
        onConfirm={() => forever && void del.run({ ids: forever })}
        busy={del.pending}
        title={forever && forever.length > 1 ? `Delete ${forever.length} items for good?` : "Delete for good?"}
        confirmLabel="Delete for good"
      >
        This can&apos;t be undone. Uploaded files in these items are removed from storage too.
      </ConfirmDialog>
    </>
  );
}

export function EmptyBinButton({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const empty = useServerAction(emptyBinAction, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" aria-hidden /> Empty bin
      </Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => void empty.run({})} busy={empty.pending} title={`Empty the recycle bin?`} confirmLabel={`Delete ${count} item${count === 1 ? "" : "s"} for good`}>
        Every item in the bin is removed for good. This can&apos;t be undone.
      </ConfirmDialog>
    </>
  );
}
