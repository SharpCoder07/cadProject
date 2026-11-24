"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { decideRequestAction } from "../actions";
import { useConfirm } from "@/components/ui/dialog";

export function DecisionPanel({ id, destructive }: { id: string; destructive: boolean }) {
  const [note, setNote] = useState("");
  const decide = useServerAction(decideRequestAction);
  const [confirm, confirmDialog] = useConfirm();
  return (
    <div className="space-y-3 p-5">
      <Field label="Note to the vendor" htmlFor="decision-note" hint="Required when rejecting. Sent to the person who made the request." error={decide.fieldErrors.note}>
        <Textarea id="decision-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="e.g. Please add pricing for the Enterprise plan." />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" variant="secondary" loading={decide.pending} onClick={() => void decide.run({ id, decision: "REJECT", note: note || null })}>
          <X className="h-4 w-4" aria-hidden /> Reject
        </Button>
        <Button size="sm" variant={destructive ? "danger" : "primary"} loading={decide.pending} onClick={async () => { if (!destructive || (await confirm({ title: "Approve and apply this change now?", message: "This can't be undone.", confirmLabel: "Approve" }))) void decide.run({ id, decision: "APPROVE", note: note || null }); }}>
          <Check className="h-4 w-4" aria-hidden /> Approve
        </Button>
      </div>
      {confirmDialog}
      <p className="text-xs text-muted">Approving applies the change immediately and tells the vendor.</p>
    </div>
  );
}
