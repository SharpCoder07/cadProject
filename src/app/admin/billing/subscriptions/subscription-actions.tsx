"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { formatINR, INTERVAL_PER, type Interval } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { useBulkAction, useServerAction } from "@/components/admin/use-action";
import { BulkBar } from "@/components/admin/bulk-table";
import { cancelSubscriptionAction, grantSubscriptionAction } from "../actions";

export function GrantSubscriptionButton({ vendors, plans }: { vendors: { id: string; name: string }[]; plans: { id: string; name: string; pricePaise: number; interval: Interval; isActive: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ vendorId: "", planId: plans[0]?.id ?? "", amount: 0, startsNow: false, note: "" });
  const grant = useServerAction(grantSubscriptionAction, { onSuccess: () => { setOpen(false); setF((x) => ({ ...x, vendorId: "", amount: 0, note: "" })); } });
  const plan = plans.find((p) => p.id === f.planId);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} disabled={!plans.length} title={plans.length ? undefined : "Create a plan first"}><Plus className="h-4 w-4" aria-hidden /> Add subscription</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a subscription" description="For plans paid offline (bank transfer, cheque) or given free, like a trial.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void grant.run(f); }}>
          <Field label="Vendor" htmlFor="g-vendor" error={grant.fieldErrors.vendorId?.[0]} required>
            <Select id="g-vendor" value={f.vendorId} onChange={(e) => setF({ ...f, vendorId: e.target.value })}>
              <option value="">Choose a vendor…</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Select>
          </Field>
          <Field label="Plan" htmlFor="g-plan" error={grant.fieldErrors.planId?.[0]} required>
            <Select id="g-plan" value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })}>
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatINR(p.pricePaise)} / {INTERVAL_PER[p.interval]}{p.isActive ? "" : " (hidden)"}</option>)}
            </Select>
          </Field>
          <Field label="Amount received (₹)" htmlFor="g-amount" hint="0 for a free plan. Recorded for your reports only." error={grant.fieldErrors.amount?.[0]}>
            <Input id="g-amount" type="number" min={0} step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
          </Field>
          <Checkbox checked={f.startsNow} onChange={(e) => setF({ ...f, startsNow: e.target.checked })} label="Start today" hint="Otherwise it starts when the vendor's current plan ends (or today if they have none)." />
          <Field label="Note" htmlFor="g-note" hint="Internal, e.g. the bank reference.">
            <Textarea id="g-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          </Field>
          {plan && <p className="text-sm text-muted">Access lasts one {INTERVAL_PER[plan.interval]}.</p>}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" type="submit" loading={grant.pending} disabled={!f.vendorId || !f.planId}>Add subscription</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function CancelSubscriptionButton({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const cancel = useServerAction(cancelSubscriptionAction, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen(true)}>Cancel</Button>
      <Dialog open={open} onClose={() => setOpen(false)} size="sm" title="Cancel this subscription?" description={label}>
        <div className="space-y-4">
          <p className="text-sm text-muted">The vendor loses access to buyer contact details straight away. If they paid online, refund them from the Razorpay dashboard.</p>
          <Field label="Reason" htmlFor="c-reason" hint="Saved with the subscription."><Input id="c-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Keep it</Button>
            <Button size="sm" variant="danger" loading={cancel.pending} onClick={() => void cancel.run({ id, reason })}>Cancel subscription</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

/** Bulk bar for Subscriptions: cancel several live subscriptions with one reason. */
export function SubscriptionBulk() {
  const bulk = useBulkAction();
  const [ask, setAsk] = useState<{ ids: string[]; clear: () => void } | null>(null);
  const [reason, setReason] = useState("");
  return (
    <>
      <BulkBar>{(ids, clear) => <Button size="sm" variant="danger" onClick={() => { setReason(""); setAsk({ ids, clear }); }}>Cancel subscriptions</Button>}</BulkBar>
      <Dialog open={ask !== null} onClose={() => setAsk(null)} size="sm" title={`Cancel ${ask?.ids.length ?? 0} ${ask?.ids.length === 1 ? "subscription" : "subscriptions"}?`}>
        <div className="space-y-4">
          <p className="text-sm text-muted">These vendors lose access to buyer contact details straight away. If they paid online, refund them from the Razorpay dashboard.</p>
          <Field label="Reason (internal)" htmlFor="bulk-cancel-reason">
            <Textarea id="bulk-cancel-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button size="sm" variant="secondary" onClick={() => setAsk(null)}>Keep them</Button>
            <Button size="sm" variant="danger" loading={bulk.pending} onClick={() => ask && void bulk.run(ask.ids, (id) => cancelSubscriptionAction({ id, reason: reason.trim() }), "Cancelled", () => { ask.clear(); setAsk(null); })}>Cancel subscriptions</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
