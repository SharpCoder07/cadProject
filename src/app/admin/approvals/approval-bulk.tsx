"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { BulkBar } from "@/components/admin/bulk-table";
import { useBulkAction } from "@/components/admin/use-action";
import { decideRequestAction } from "./actions";

/** Bulk bar for Approvals: approve several waiting requests, or reject them with one reason. */
export function ApprovalBulk() {
  const bulk = useBulkAction();
  const [approve, setApprove] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [reject, setReject] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [note, setNote] = useState("");
  return (
    <>
      <BulkBar>
        {(ids, clear) => (
          <>
            <Button size="sm" onClick={() => setApprove({ ids, clear })}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => { setNote(""); setReject({ ids, clear }); }}>Reject</Button>
          </>
        )}
      </BulkBar>
      <ConfirmDialog
        open={approve !== null}
        onClose={() => setApprove(null)}
        tone="primary"
        busy={bulk.pending}
        title={`Approve ${approve?.ids.length ?? 0} ${approve?.ids.length === 1 ? "request" : "requests"}?`}
        confirmLabel="Approve and apply"
        onConfirm={() => approve && void bulk.run(approve.ids, (id) => decideRequestAction({ id, decision: "APPROVE" }), "Approved", () => { approve.clear(); setApprove(null); })}
      >
        Each change is applied to the website straight away, and the vendors are told.
      </ConfirmDialog>
      <Dialog open={reject !== null} onClose={() => setReject(null)} size="sm" title={`Reject ${reject?.ids.length ?? 0} ${reject?.ids.length === 1 ? "request" : "requests"}?`} description="The vendors see this reason.">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reject && note.trim()) void bulk.run(reject.ids, (id) => decideRequestAction({ id, decision: "REJECT", note: note.trim() }), "Rejected", () => { reject.clear(); setReject(null); });
          }}
        >
          <Field label="Reason" htmlFor="bulk-reject-note" required hint="One reason, sent with every rejected request.">
            <Textarea id="bulk-reject-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button size="sm" variant="secondary" onClick={() => setReject(null)}>Cancel</Button>
            <Button size="sm" type="submit" variant="danger" loading={bulk.pending} disabled={!note.trim()}>Reject</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
