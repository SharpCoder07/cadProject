"use client";

import { useState } from "react";
import { Download, Eraser, Send, UserCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { STATUS_LABEL, type CaseStatus } from "@/lib/compliance/cases";
import { assignCaseAction, eraseCaseDataAction, exportCaseDataAction, updateCaseAction, withdrawCaseConsentsAction } from "../actions";

export function CaseUpdateForm({ id, status, next, verified, content }: { id: string; status: CaseStatus; next: CaseStatus[]; verified: boolean; content?: { action: string | null; options: { value: string; label: string }[] } }) {
  const [to, setTo] = useState<CaseStatus | "">("");
  const [act, setAct] = useState<string>(content?.action ?? "");
  const [message, setMessage] = useState("");
  const [toRequester, setToRequester] = useState(false);
  const run = useServerAction(updateCaseAction, { onSuccess: () => { setMessage(""); setTo(""); setToRequester(false); } });
  const emails = toRequester || to === "RESOLVED" || to === "REJECTED";
  return (
    <div className="space-y-3">
      <Field label="Status" htmlFor="cu-status">
        <select id="cu-status" value={to} onChange={(e) => setTo(e.target.value as CaseStatus | "")} className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink">
          <option value="">Keep “{STATUS_LABEL[status]}”</option>
          {next.map((s) => <option key={s} value={s}>Move to “{STATUS_LABEL[s]}”</option>)}
        </select>
      </Field>
      {content && (
        <Field label="Action on the content" htmlFor="cu-act" hint="Take it down in the product, review or page editor first, then record it here.">
          <select id="cu-act" value={act} onChange={(e) => setAct(e.target.value)} className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink">
            <option value="">Not decided</option>
            {content.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      )}
      <Field label={emails ? "Message to the requester" : "Note"} htmlFor="cu-msg" error={run.fieldErrors.message} hint={to === "RESOLVED" || to === "REJECTED" ? "Required: explain the outcome (and, if declining, why). It's emailed and kept on record." : undefined}>
        <Textarea id="cu-msg" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} />
      </Field>
      {verified && to !== "RESOLVED" && to !== "REJECTED" && <Switch label="Email this to the requester" hint="Otherwise it's an internal note only staff see." checked={toRequester} onChange={(e) => setToRequester(e.target.checked)} />}
      <Button loading={run.pending} disabled={!to && !message.trim() && (act || null) === (content?.action ?? null)} onClick={() => void run.run({ id, data: { status: to || null, message, toRequester, actionTaken: content && act ? (act as "removed") : null } })}>
        <Send className="h-4 w-4" aria-hidden />{emails ? "Save and email" : "Save"}
      </Button>
    </div>
  );
}

export function AssignSelect({ id, current, people, me }: { id: string; current: string | null; people: { id: string; name: string }[]; me: string }) {
  const run = useServerAction(assignCaseAction);
  return (
    <div className="flex items-center gap-2">
      <select aria-label="Assigned to" value={current ?? ""} disabled={run.pending} onChange={(e) => void run.run({ id, assigneeId: e.target.value || null })} className="h-9 min-w-0 flex-1 rounded-control border border-line bg-surface px-2 text-sm text-ink">
        <option value="">Nobody</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {current !== me && <Button size="sm" variant="secondary" loading={run.pending} onClick={() => void run.run({ id, assigneeId: me })}><UserCheck className="h-4 w-4" aria-hidden />Me</Button>}
    </div>
  );
}

export function ExportButton({ id }: { id: string }) {
  const run = useServerAction(exportCaseDataAction, {
    onSuccess: ({ fileName, data }) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
  });
  return <Button variant="secondary" loading={run.pending} onClick={() => void run.run({ id })}><Download className="h-4 w-4" aria-hidden />Download their data (JSON)</Button>;
}

export function WithdrawConsentsButton({ id }: { id: string }) {
  const run = useServerAction(withdrawCaseConsentsAction);
  return <Button variant="secondary" loading={run.pending} onClick={() => void run.run({ id })}><Undo2 className="h-4 w-4" aria-hidden />Withdraw all optional consents</Button>;
}

export function EraseButton({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [enquiries, setEnquiries] = useState(false);
  const run = useServerAction(eraseCaseDataAction, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}><Eraser className="h-4 w-4" aria-hidden />Erase account data…</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Erase this person's data" description="This can't be undone.">
        <div className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Signs them out everywhere and removes favourites, notifications and devices.</li>
            <li>Replaces their name and email on the account, reviews and questions (“Former user”); the account can no longer sign in.</li>
            <li>Withdraws every consent.</li>
            <li>Keeps what serves as evidence: consent and acceptance history, this case and the audit log.</li>
          </ul>
          <p className="rounded-lg bg-warning/10 p-3 text-ink">Legal review: confirm with your lawyer what you must keep (for example invoices or records needed for a dispute) before erasing.</p>
          <Switch label="Also blank their contact details on past enquiries" hint="Vendors who received the enquiry keep their own copy outside the platform." checked={enquiries} onChange={(e) => setEnquiries(e.target.checked)} />
          <Field label="Type ERASE to confirm" htmlFor="erase-confirm" error={run.fieldErrors.confirm}>
            <Input id="erase-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="danger" loading={run.pending} disabled={confirm !== "ERASE"} onClick={() => void run.run({ id, enquiries, confirm })}>Erase</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
