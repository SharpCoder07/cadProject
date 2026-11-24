"use client";

import { useState } from "react";
import { Check, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useConfirm } from "@/components/ui/dialog";
import { useServerAction } from "@/components/admin/use-action";
import { cancelDeletionAction, decideDeletionAction } from "../actions";

export function DeletionDecision({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const decide = useServerAction(decideDeletionAction);
  const [confirm, confirmDialog] = useConfirm();
  return (
    <div className="space-y-3 p-5">
      {confirmDialog}
      <Field label="Note to the requester" htmlFor="deletion-note" hint="Required when rejecting." error={decide.fieldErrors.note}>
        <Textarea id="deletion-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Keep this page, it still gets traffic." />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" loading={decide.pending} onClick={() => void decide.run({ id, decision: "REJECT", note: note || null })}><X className="h-4 w-4" aria-hidden /> Reject</Button>
        <Button size="sm" variant="danger" loading={decide.pending} onClick={async () => { if (await confirm({ title: "Approve and delete now?", message: "It's deleted with your authority. Deleted records go to the recycle bin.", confirmLabel: "Approve & delete" })) void decide.run({ id, decision: "APPROVE", note: note || null }); }}><Check className="h-4 w-4" aria-hidden /> Approve</Button>
      </div>
      <p className="text-xs text-muted">Both are recorded in the audit log, and the requester is told.</p>
    </div>
  );
}

export function WithdrawDeletion({ id, own }: { id: string; own: boolean }) {
  const cancel = useServerAction(cancelDeletionAction);
  return (
    <div className="border-t border-line p-5">
      <Button size="sm" variant="ghost" loading={cancel.pending} onClick={() => void cancel.run({ id })}><Undo2 className="h-4 w-4" aria-hidden /> {own ? "Withdraw my request" : "Withdraw"}</Button>
    </div>
  );
}
