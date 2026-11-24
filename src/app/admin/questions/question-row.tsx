"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { answerQuestionAction, deleteQuestionAction, setQuestionStatusAction } from "./actions";

/** Answer box and actions for one question. */
export function QuestionAnswer({ id, answer, status }: { id: string; answer: string | null; status: string }) {
  const [text, setText] = useState(answer ?? "");
  const [editing, setEditing] = useState(!answer);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useServerAction(answerQuestionAction, { onSuccess: () => setEditing(false) });
  const setStatus = useServerAction(setQuestionStatusAction);
  const del = useServerAction(deleteQuestionAction, { onSuccess: () => setConfirmDelete(false) });

  return (
    <div className="mt-3">
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save.run({ id, answer: text });
          }}
          className="space-y-2"
        >
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a clear, factual answer. It appears on the product page under the question." aria-label="Answer" />
          {save.fieldErrors.answer && <p className="text-xs text-danger">{save.fieldErrors.answer[0]}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" loading={save.pending} disabled={text.trim().length < 2}>{answer ? "Save answer" : "Answer & publish"}</Button>
            {answer && <Button size="sm" variant="ghost" onClick={() => { setText(answer); setEditing(false); }}>Cancel</Button>}
          </div>
        </form>
      ) : (
        <div className="rounded-control border border-line bg-bg p-3 text-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Answer</p>
          <p className="mt-1 whitespace-pre-line">{answer}</p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {!editing && <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>Edit answer</Button>}
        {status === "APPROVED" && <Button size="sm" variant="ghost" loading={setStatus.pending} onClick={() => void setStatus.run({ id, status: "REJECTED" })}>Hide</Button>}
        {status === "REJECTED" && answer && <Button size="sm" variant="ghost" loading={setStatus.pending} onClick={() => void setStatus.run({ id, status: "APPROVED" })}>Publish again</Button>}
        {status === "PENDING" && <Button size="sm" variant="ghost" loading={setStatus.pending} onClick={() => void setStatus.run({ id, status: "REJECTED" })}>Reject</Button>}
        <Button size="sm" variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
      </div>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => void del.run({ id })} title="Delete this question?" confirmLabel="Delete" busy={del.pending} recycleBin>
        The question and its answer disappear from the product page.
      </ConfirmDialog>
    </div>
  );
}
