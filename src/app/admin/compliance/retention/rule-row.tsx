"use client";

import { useState } from "react";
import { Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input, Switch } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { runRetentionRuleAction, saveRetentionRuleAction } from "../actions";

export interface RuleRowData { id: string; name: string; description: string; action: string; retentionDays: number | null; isActive: boolean; legalReviewed: boolean; legalNote: string | null; minDays: number; dueNow: number | null; lastRun: string | null; lastRunCount: number | null }

/** One retention rule: period, on/off, legal review, and Run now. */
export function RuleRow({ r, editable }: { r: RuleRowData; editable: boolean }) {
  const [f, setF] = useState({ days: r.retentionDays?.toString() ?? "", isActive: r.isActive, legalReviewed: r.legalReviewed, legalNote: r.legalNote ?? "" });
  const [confirmRun, setConfirmRun] = useState(false);
  const save = useServerAction(saveRetentionRuleAction);
  const run = useServerAction(runRetentionRuleAction, { onSuccess: () => setConfirmRun(false) });
  const dirty = f.days !== (r.retentionDays?.toString() ?? "") || f.isActive !== r.isActive || f.legalReviewed !== r.legalReviewed || f.legalNote !== (r.legalNote ?? "");
  return (
    <li className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {r.name}
          <span className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[11px] font-semibold capitalize text-ink/70 ring-1 ring-line">{r.action === "anonymise" ? "Anonymise" : "Delete"}</span>
          {r.isActive ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">On</span> : <span className="rounded-full bg-ink/[0.05] px-2 py-0.5 text-[11px] font-semibold text-ink/60 ring-1 ring-line">Off</span>}
          {!r.legalReviewed && <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning ring-1 ring-warning/25">Not legally reviewed</span>}
        </p>
        <p className="mt-0.5 text-sm text-muted">{r.description}</p>
        <p className="mt-2 text-xs text-muted">
          {r.retentionDays ? `${r.dueNow ?? "?"} record${r.dueNow === 1 ? "" : "s"} older than ${r.retentionDays} days today` : "No period set: nothing is removed."}
          {r.lastRun && ` · Last run ${r.lastRun} (${r.lastRunCount ?? 0})`}
        </p>
      </div>
      <div className="space-y-2.5">
        <label className="flex items-center gap-2 text-sm text-ink">
          Keep for
          <Input type="number" min={r.minDays} max={36500} value={f.days} disabled={!editable} onChange={(e) => setF({ ...f, days: e.target.value })} className="h-9 w-24" aria-label={`${r.name}: days to keep`} />
          days
          <span className="text-xs text-muted">(min {r.minDays})</span>
        </label>
        {save.fieldErrors.retentionDays && <p className="text-xs text-danger">{save.fieldErrors.retentionDays[0]}</p>}
        <Switch label="Run automatically every day" checked={f.isActive} disabled={!editable} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />
        <Switch label="Period confirmed by a lawyer" checked={f.legalReviewed} disabled={!editable} onChange={(e) => setF({ ...f, legalReviewed: e.target.checked })} />
        <Input value={f.legalNote} placeholder="Legal basis or review note" disabled={!editable} onChange={(e) => setF({ ...f, legalNote: e.target.value })} className="h-9" aria-label={`${r.name}: note`} />
        {editable && (
          <div className="flex gap-2">
            <Button size="sm" disabled={!dirty} loading={save.pending} onClick={() => void save.run({ id: r.id, data: { retentionDays: f.days ? Number(f.days) : null, isActive: f.isActive, legalReviewed: f.legalReviewed, legalNote: f.legalNote || null } })}><Save className="h-4 w-4" aria-hidden />Save</Button>
            <Button size="sm" variant="secondary" disabled={!r.isActive || dirty} onClick={() => setConfirmRun(true)}><Play className="h-4 w-4" aria-hidden />Run now</Button>
          </div>
        )}
      </div>
      <ConfirmDialog open={confirmRun} onClose={() => setConfirmRun(false)} onConfirm={() => void run.run({ id: r.id })} title={`Run “${r.name}” now?`} confirmLabel={r.action === "anonymise" ? "Anonymise" : "Delete"} busy={run.pending}>
        {r.dueNow ?? "Any"} record{r.dueNow === 1 ? "" : "s"} older than {r.retentionDays} days will be {r.action === "anonymise" ? "anonymised" : "deleted"}. This can&apos;t be undone (backups still hold them until they expire).
      </ConfirmDialog>
    </li>
  );
}
