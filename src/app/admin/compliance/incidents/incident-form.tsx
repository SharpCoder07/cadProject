"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { saveIncidentAction } from "../actions";

export interface IncidentValues {
  title: string; description: string; severity: string; status: string;
  detectedAt: string; occurredAt: string; containedAt: string; resolvedAt: string;
  personalDataAffected: boolean; dataCategories: string; affectedCount: string;
  reportable: string; decisionNote: string; reportedToBoardAt: string; reportedToCertInAt: string; usersNotifiedAt: string;
  rootCause: string; remediation: string; assignedToId: string;
}

const iso = (v: string) => (v ? new Date(v).toISOString() : null);
const sel = "h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink";

/** Record or update an incident. Dates are entered in your local time. */
export function IncidentForm({ id, initial, people, editable }: { id: string | null; initial: IncidentValues; people: { id: string; name: string }[]; editable: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [note, setNote] = useState("");
  const run = useServerAction(saveIncidentAction, { onSuccess: (newId) => { setNote(""); if (!id) router.push(`/admin/compliance/incidents/${newId}`); } });
  const set = <K extends keyof IncidentValues>(k: K, v: IncidentValues[K]) => setF((x) => ({ ...x, [k]: v }));
  const fe = (k: string) => run.fieldErrors[k];
  const dt = (k: keyof IncidentValues, label: string, hint?: string) => (
    <Field label={label} htmlFor={`in-${k}`} error={fe(k)} hint={hint}>
      <Input id={`in-${k}`} type="datetime-local" value={f[k] as string} disabled={!editable} onChange={(e) => set(k, e.target.value as never)} />
    </Field>
  );
  const submit = () =>
    run.run({
      id,
      note: note || null,
      data: {
        ...f,
        detectedAt: iso(f.detectedAt),
        occurredAt: iso(f.occurredAt),
        containedAt: iso(f.containedAt),
        resolvedAt: iso(f.resolvedAt),
        reportedToBoardAt: iso(f.reportedToBoardAt),
        reportedToCertInAt: iso(f.reportedToCertInAt),
        usersNotifiedAt: iso(f.usersNotifiedAt),
        dataCategories: f.dataCategories.split(",").map((x) => x.trim()).filter(Boolean),
        affectedCount: f.affectedCount === "" ? null : Number(f.affectedCount),
        assignedToId: f.assignedToId || null,
        decisionNote: f.decisionNote || null,
        rootCause: f.rootCause || null,
        remediation: f.remediation || null,
      },
    });

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">What happened</h2>
        <Field label="Title" htmlFor="in-title" error={fe("title")}><Input id="in-title" value={f.title} disabled={!editable} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Description" htmlFor="in-desc" error={fe("description")}><Textarea id="in-desc" rows={4} value={f.description} disabled={!editable} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Severity" htmlFor="in-sev"><select id="in-sev" className={sel} value={f.severity} disabled={!editable} onChange={(e) => set("severity", e.target.value)}>{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select></Field>
          <Field label="Status" htmlFor="in-status" error={fe("status")}><select id="in-status" className={sel} value={f.status} disabled={!editable} onChange={(e) => set("status", e.target.value)}>{["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</select></Field>
          <Field label="Assigned to" htmlFor="in-assignee"><select id="in-assignee" className={sel} value={f.assignedToId} disabled={!editable} onChange={(e) => set("assignedToId", e.target.value)}><option value="">Nobody</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {dt("detectedAt", "Detected")}
          {dt("occurredAt", "Started (if known)")}
          {dt("containedAt", "Contained")}
          {dt("resolvedAt", "Resolved")}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Personal data</h2>
        <Switch label="Personal data was or may have been affected" checked={f.personalDataAffected} disabled={!editable} onChange={(e) => set("personalDataAffected", e.target.checked)} />
        {f.personalDataAffected && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kinds of data" htmlFor="in-cats" hint="Comma separated, e.g. names, emails, phone numbers"><Input id="in-cats" value={f.dataCategories} disabled={!editable} onChange={(e) => set("dataCategories", e.target.value)} /></Field>
            <Field label="People affected (estimate)" htmlFor="in-count" error={fe("affectedCount")}><Input id="in-count" type="number" min={0} value={f.affectedCount} disabled={!editable} onChange={(e) => set("affectedCount", e.target.value)} /></Field>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-warning/40 bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Reporting decision</h2>
        <p className="text-sm text-muted">Legal review: whether and when to report (for example to the Data Protection Board, CERT-In or the people affected) depends on the incident and the rules in force. Decide with your lawyer and record it here.</p>
        <Field label="Must it be reported?" htmlFor="in-rep" error={fe("reportable")}>
          <select id="in-rep" className={sel} value={f.reportable} disabled={!editable} onChange={(e) => set("reportable", e.target.value)}>
            <option value="undecided">Not decided yet</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
        <Field label="Reasoning" htmlFor="in-dn"><Textarea id="in-dn" rows={3} value={f.decisionNote} disabled={!editable} onChange={(e) => set("decisionNote", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {dt("reportedToBoardAt", "Reported to the Data Protection Board")}
          {dt("reportedToCertInAt", "Reported to CERT-In")}
          {dt("usersNotifiedAt", "People affected told")}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-ink">Cause and fix</h2>
        <Field label="Root cause" htmlFor="in-rc"><Textarea id="in-rc" rows={3} value={f.rootCause} disabled={!editable} onChange={(e) => set("rootCause", e.target.value)} /></Field>
        <Field label="What was done / will be done" htmlFor="in-rem"><Textarea id="in-rem" rows={3} value={f.remediation} disabled={!editable} onChange={(e) => set("remediation", e.target.value)} /></Field>
        {id && <Field label="Add a note to the history (optional)" htmlFor="in-note"><Textarea id="in-note" rows={2} value={note} disabled={!editable} onChange={(e) => setNote(e.target.value)} /></Field>}
      </section>

      {run.fieldErrors.data && <p className="text-sm text-danger">{run.fieldErrors.data[0]}</p>}
      {editable && <Button loading={run.pending} onClick={() => void submit()}><Save className="h-4 w-4" aria-hidden />{id ? "Save changes" : "Record incident"}</Button>}
    </div>
  );
}
