"use client";

import { useState } from "react";
import { LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_TYPES, LEAD_TYPE_LABEL, type LeadTypeKey } from "@/lib/validation/leads";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { addNoteAction, updateLeadAction } from "../actions";

const toLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

export function LeadControls({ id, status, priority, type, assignedToId, nextFollowUpAt, staff }: { id: string; status: string; priority: string; type: LeadTypeKey; assignedToId: string | null; nextFollowUpAt: string | null; staff: { id: string; name: string }[] }) {
  const [form, setForm] = useState({ status, priority, type, assignedToId: assignedToId ?? "", nextFollowUpAt: toLocal(nextFollowUpAt) });
  const update = useServerAction(updateLeadAction);
  return (
    <Panel>
      <PanelHeader title="Pipeline" />
      <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); void update.run({ id, status: form.status as (typeof LEAD_STATUSES)[number], priority: form.priority as "LOW" | "NORMAL" | "HIGH", type: form.type, assignedToId: form.assignedToId || null, nextFollowUpAt: form.nextFollowUpAt || null }); }}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Status" htmlFor="l-status"><Select id="l-status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}</Select></Field>
          <Field label="Priority" htmlFor="l-priority"><Select id="l-priority" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option></Select></Field>
          <Field label="Type" htmlFor="l-type"><Select id="l-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as LeadTypeKey })}>{LEAD_TYPES.map((t) => <option key={t} value={t}>{LEAD_TYPE_LABEL[t]}</option>)}</Select></Field>
        <Field label="Assigned to" htmlFor="l-assign"><Select id="l-assign" value={form.assignedToId} onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
        <Field label="Next follow-up (IST)" htmlFor="l-follow"><Input id="l-follow" type="datetime-local" value={form.nextFollowUpAt} onChange={(e) => setForm({ ...form, nextFollowUpAt: e.target.value })} /></Field>
        </div>
        <div className="flex justify-end">
          <Button size="sm" type="submit" loading={update.pending}>Update lead</Button>
        </div>
      </form>
    </Panel>
  );
}

/** Quick note box shown at the top of the Notes card. */
export function AddNote({ id }: { id: string }) {
  const [note, setNote] = useState("");
  const addNote = useServerAction(addNoteAction, { onSuccess: () => setNote("") });
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) void addNote.run({ leadId: id, body: note }); }}>
      <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Call summary, requirements, next steps…" aria-label="New note" />
      <div className="flex justify-end">
        <Button size="sm" type="submit" loading={addNote.pending} disabled={!note.trim()}>Add note</Button>
      </div>
    </form>
  );
}
