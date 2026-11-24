"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { saveErrorAction } from "../actions";

export function ErrorStatusForm({ id, status, note, canManage }: { id: string; status: "PENDING" | "RESOLVED"; note: string | null; canManage: boolean }) {
  const [text, setText] = useState(note ?? "");
  const save = useServerAction(saveErrorAction);
  if (!canManage) return <p className="p-5 text-sm text-muted">{note ? <>Note: {note}</> : "Your role can view errors but not change their status."}</p>;
  return (
    <div className="space-y-3 p-5">
      <Field label="Note" htmlFor="err-note" hint="What caused it, what was fixed, or who's on it." error={save.fieldErrors.note}>
        <Textarea id="err-note" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {status === "PENDING" ? (
          <>
            <Button size="sm" variant="secondary" loading={save.pending} onClick={() => void save.run({ id, status: "PENDING", note: text || null })}>Save note</Button>
            <Button size="sm" loading={save.pending} onClick={() => void save.run({ id, status: "RESOLVED", note: text || null })}>Mark resolved</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" loading={save.pending} onClick={() => void save.run({ id, status: "RESOLVED", note: text || null })}>Save note</Button>
            <Button size="sm" variant="secondary" loading={save.pending} onClick={() => void save.run({ id, status: "PENDING", note: text || null })}>Mark pending</Button>
          </>
        )}
      </div>
      <p className="text-xs text-muted">If a resolved error happens again, it goes back to Pending on its own.</p>
    </div>
  );
}
