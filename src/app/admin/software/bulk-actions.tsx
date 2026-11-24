"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useServerAction } from "@/components/admin/use-action";
import { BulkBar } from "@/components/admin/bulk-table";
import { deleteSoftwareAction, setFlagAction, setStatusAction } from "./actions";
import type { SoftwareFlag } from "@/lib/validation/software";

const FLAGS: { flag: SoftwareFlag; label: string }[] = [
  { flag: "isFeatured", label: "Featured" },
  { flag: "isPopular", label: "Popular" },
  { flag: "isTrending", label: "Trending" },
  { flag: "isRecommended", label: "Recommended" },
  { flag: "isSponsored", label: "Sponsored" },
];

export function SoftwareBulkActions({ canPublish, canDelete, canEdit }: { canPublish: boolean; canDelete: boolean; canEdit: boolean }) {
  const status = useServerAction(setStatusAction);
  const flag = useServerAction(setFlagAction);
  const del = useServerAction(deleteSoftwareAction);
  const [confirm, setConfirm] = useState<string[] | null>(null);

  return (
    <BulkBar>
      {(ids, clear) => (
        <>
          {canPublish && (
            <>
              <Button size="sm" loading={status.pending} onClick={() => void status.run({ ids, status: "PUBLISHED" }).then((r) => r.ok && clear())}>Publish</Button>
              <Button size="sm" variant="secondary" onClick={() => void status.run({ ids, status: "DRAFT" }).then((r) => r.ok && clear())}>Unpublish</Button>
              <Button size="sm" variant="secondary" onClick={() => void status.run({ ids, status: "ARCHIVED" }).then((r) => r.ok && clear())}>Archive</Button>
            </>
          )}
          {canEdit && (
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Set a flag</span>
              <select
                className="h-8 rounded-control border border-line bg-surface px-2 text-sm"
                defaultValue=""
                disabled={flag.pending}
                onChange={(e) => {
                  const [f, v] = e.target.value.split(":") as [SoftwareFlag, string];
                  e.target.value = "";
                  if (f) void flag.run({ ids, flag: f, value: v === "on" });
                }}
              >
                <option value="" disabled>Set flag…</option>
                {FLAGS.map((f) => (
                  <optgroup key={f.flag} label={f.label}>
                    <option value={`${f.flag}:on`}>Mark {f.label.toLowerCase()}</option>
                    <option value={`${f.flag}:off`}>Remove {f.label.toLowerCase()}</option>
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          {canDelete && <Button size="sm" variant="danger" onClick={() => setConfirm(ids)}>Delete</Button>}
          <ConfirmDialog
            open={confirm !== null}
            onClose={() => setConfirm(null)}
            title={`Delete ${confirm?.length ?? 0} ${confirm?.length === 1 ? "product" : "products"}?`}
            confirmLabel="Delete"
            recycleBin
            busy={del.pending}
            onConfirm={() => void del.run({ ids: confirm ?? [] }).then((r) => { if (r.ok) { setConfirm(null); clear(); } })}
          >
            They’re taken off the website straight away. Their pricing, screenshots, FAQs and reviews are kept with them, so restoring brings everything back. Just want to hide them for now? Use Archive instead.
          </ConfirmDialog>
        </>
      )}
    </BulkBar>
  );
}
