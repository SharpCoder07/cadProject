"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { BulkBar, useSelection } from "./bulk-table";
import { useBulkAction } from "./use-action";

type Result = { ok: true; data: unknown; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export interface BulkItem {
  label: string;
  /** A server action that takes `{ id, ...extra }`; it runs once per selected row. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each page passes its own action
  action: (input: any) => Promise<Result>;
  extra?: Record<string, unknown>;
  /** Past tense for the summary toast, e.g. "Published" → "Published 3 items". */
  done: string;
  danger?: boolean;
  /** Ask first (always on for danger actions). */
  confirm?: string;
  /** Show the "goes to the recycle bin" note (default: on for danger actions labelled Delete). */
  recycleBin?: boolean;
}

/**
 * Bulk action bar for list pages that use SelectionProvider + RowCheckbox/AllCheckbox. Shows when
 * rows are ticked; runs the chosen action for every ticked row and shows one summary toast.
 */
export function BulkActionBar({ items, noun = "item" }: { items: BulkItem[]; noun?: string }) {
  const bulk = useBulkAction();
  const { clear } = useSelection();
  const [ask, setAsk] = useState<{ item: BulkItem; ids: string[] } | null>(null);
  const go = (item: BulkItem, ids: string[]) => void bulk.run(ids, (id) => item.action({ id, ...item.extra }), item.done, () => { clear(); setAsk(null); });
  return (
    <>
      <BulkBar>
        {(ids) =>
          items.map((item) => (
            <Button
              key={item.label}
              variant={item.danger ? "danger" : "secondary"}
              size="sm"
              loading={bulk.pending && !ask}
              onClick={() => (item.danger || item.confirm ? setAsk({ item, ids }) : go(item, ids))}
            >
              {item.label}
            </Button>
          ))
        }
      </BulkBar>
      <ConfirmDialog
        open={ask !== null}
        onClose={() => setAsk(null)}
        title={ask ? `${ask.item.label} ${ask.ids.length} ${ask.ids.length === 1 ? noun : `${noun}s`}?` : ""}
        confirmLabel={ask?.item.label ?? "Confirm"}
        tone={ask?.item.danger ? "danger" : "primary"}
        busy={bulk.pending}
        recycleBin={ask ? (ask.item.recycleBin ?? (Boolean(ask.item.danger) && /delete/i.test(ask.item.label))) : false}
        onConfirm={() => ask && go(ask.item, ask.ids)}
      >
        {ask?.item.confirm}
      </ConfirmDialog>
    </>
  );
}
