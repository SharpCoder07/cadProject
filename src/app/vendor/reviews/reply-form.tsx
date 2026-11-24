"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { proposeReplyAction } from "../actions";
import { useConfirm } from "@/components/ui/dialog";

export function ReplyForm({ reviewId, current, pending }: { reviewId: string; current: string | null; pending: string | null }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(pending ?? current ?? "");
  const send = useServerAction(proposeReplyAction, { onSuccess: () => setOpen(false) });
  const [confirm, confirmDialog] = useConfirm();
  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        {confirmDialog}
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{current || pending ? "Edit reply" : "Write a public reply"}</Button>
        {current && <Button size="sm" variant="ghost" loading={send.pending} onClick={async () => { if (await confirm({ title: "Ask to remove your public reply?", message: "It stays on the website until the request is approved.", confirmLabel: "Request removal" })) void send.run({ reviewId, reply: null }); }}>Remove reply</Button>}
      </div>
    );
  }
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); void send.run({ reviewId, reply: text }); }}>
      <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Thank the reviewer or respond to their points. Shown publicly under the review once approved." aria-label="Your reply" />
      <div className="flex gap-2">
        <Button size="sm" type="submit" loading={send.pending} disabled={!text.trim()}>Send for approval</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}
