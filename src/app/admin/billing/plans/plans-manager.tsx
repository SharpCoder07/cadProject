"use client";

import { useEffect, useState } from "react";
import { CreditCard, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { formatINR, INTERVAL_LABEL, INTERVAL_PER, INTERVALS, type Interval } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { AdminTable } from "@/components/admin/page-header";
import { ListPanel, PanelEmpty, showingAll } from "@/components/admin/list-panel";
import { useBulkAction, useServerAction } from "@/components/admin/use-action";
import { SelectionBar } from "@/components/admin/bulk-table";
import { deletePlanAction, savePlanAction, setPlanVisibleAction } from "../actions";

export interface PlanRow {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: Interval;
  features: string[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  audience: "VENDOR" | "RESELLER";
  activeCount: number;
}

type Draft = Omit<PlanRow, "activeCount" | "features" | "id"> & { id: string | null; features: string };
const EMPTY: Draft = { id: null, name: "", description: "", price: 0, interval: "YEAR", features: "", isActive: true, isFeatured: false, sortOrder: 0, audience: "VENDOR" };

const ADD_EVENT = "plans:add";

/** "New plan" button for the page header (top right). */
export function NewPlanButton() {
  return (
    <Button size="sm" onClick={() => window.dispatchEvent(new Event(ADD_EVENT))}>
      <Plus className="h-4 w-4" aria-hidden /> New plan
    </Button>
  );
}

export function PlansManager({ plans }: { plans: PlanRow[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [remove, setRemove] = useState<PlanRow | null>(null);
  const save = useServerAction(savePlanAction, { onSuccess: () => setDraft(null) });
  const del = useServerAction(deletePlanAction, { onSuccess: () => setRemove(null) });
  const err = (k: string) => save.fieldErrors[k]?.[0];
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const openNew = () => { save.setFieldErrors({}); setDraft({ ...EMPTY, sortOrder: plans.length }); };
  useEffect(() => {
    window.addEventListener(ADD_EVENT, openNew);
    return () => window.removeEventListener(ADD_EVENT, openNew);
  });
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = term ? plans.filter((p) => `${p.name} ${p.description} ${p.features.join(" ")}`.toLowerCase().includes(term)) : plans;
  // Bulk select: show, hide or delete several plans at once.
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkDelete, setBulkDelete] = useState(false);
  const bulk = useBulkAction();
  const done = () => { setPicked([]); setBulkDelete(false); };
  const pick = (id: string, on: boolean) => setPicked((x) => (on ? [...x, id] : x.filter((i) => i !== id)));
  const allOn = shown.length > 0 && shown.every((p) => picked.includes(p.id));

  return (
    <>
      <SelectionBar count={picked.length} onClear={() => setPicked([])}>
        <Button size="sm" variant="secondary" loading={bulk.pending} onClick={() => void bulk.run(picked, (id) => setPlanVisibleAction({ id, isActive: true }), "Showed", done)}>Show</Button>
        <Button size="sm" variant="secondary" loading={bulk.pending} onClick={() => void bulk.run(picked, (id) => setPlanVisibleAction({ id, isActive: false }), "Hid", done)}>Hide</Button>
        <Button size="sm" variant="danger" onClick={() => setBulkDelete(true)}>Delete</Button>
      </SelectionBar>
      <ListPanel
        title="All plans"
        meta={showingAll(shown.length)}
        actions={
          plans.length > 0 && (
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search plans</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQ("")}
                placeholder="Search plans…"
                autoComplete="off"
                className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear search">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </label>
          )
        }
      >
      {plans.length === 0 ? (
        <PanelEmpty icon={<CreditCard className="h-5 w-5" />} title="No plans yet" action={<Button size="sm" variant="secondary" onClick={openNew}><Plus className="h-4 w-4" aria-hidden /> New plan</Button>}>Create a plan so vendors can buy access to buyer contact details.</PanelEmpty>
      ) : shown.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Nothing matches “{q.trim()}”.</p>
      ) : (
        <AdminTable bare minWidth={46}>
          <thead><tr><th className="w-10"><input type="checkbox" checked={allOn} onChange={(e) => setPicked(e.target.checked ? [...new Set([...picked, ...shown.map((p) => p.id)])] : picked.filter((id) => !shown.some((p) => p.id === id)))} aria-label="Select all" className="h-4 w-4 rounded border-line text-primary" /></th><th>Plan</th><th>For</th><th>Price</th><th>Billing</th><th className="text-right">Active subscribers</th><th>Shown</th><th /></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={picked.includes(p.id)} onChange={(e) => pick(p.id, e.target.checked)} aria-label={`Select ${p.name}`} className="h-4 w-4 rounded border-line text-primary" /></td>
                <td>
                  <span className="font-medium text-ink">{p.name}</span>
                  {p.isFeatured && <Badge tone="accent" className="ml-2"><Sparkles className="mr-1 h-3 w-3" aria-hidden />Popular</Badge>}
                  {p.description && <span className="block max-w-sm truncate text-xs text-muted">{p.description}</span>}
                </td>
                <td><Badge tone={p.audience === "RESELLER" ? "primary" : "neutral"}>{p.audience === "RESELLER" ? "Resellers" : "Vendors"}</Badge></td>
                <td className="tabular-nums">{formatINR(Math.round(p.price * 100))}</td>
                <td className="text-muted">{INTERVAL_LABEL[p.interval]}</td>
                <td className="text-right tabular-nums">{p.activeCount}</td>
                <td><Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Visible" : "Hidden"}</Badge></td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${p.name}`} onClick={() => { save.setFieldErrors({}); setDraft({ ...p, features: p.features.join("\n") }); }}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`} onClick={() => setRemove(p)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
      </ListPanel>

      <Dialog open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Edit plan" : "New plan"} description="Price changes apply to new purchases only.">
        {draft && (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save.run({ ...draft, price: Number(draft.price), features: draft.features.split("\n").map((f) => f.trim()).filter(Boolean) });
            }}
          >
            <Field label="Who can buy it" htmlFor="plan-audience" hint="Vendors and resellers each see only their own plans.">
              <Select id="plan-audience" value={draft.audience} onChange={(e) => set("audience", e.target.value as Draft["audience"])}>
                <option value="VENDOR">Software vendors</option>
                <option value="RESELLER">Resellers</option>
              </Select>
            </Field>
            <Field label="Plan name" htmlFor="plan-name" error={err("name")} required><Input id="plan-name" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="Growth" /></Field>
            <Field label="Short description" htmlFor="plan-desc" error={err("description")}><Input id="plan-desc" value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="For vendors getting regular enquiries" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price (₹, including GST)" htmlFor="plan-price" error={err("price")} required>
                <Input id="plan-price" type="number" min={1} step="0.01" value={draft.price || ""} onChange={(e) => set("price", Number(e.target.value))} placeholder="9999" />
              </Field>
              <Field label="Billing period" htmlFor="plan-interval">
                <Select id="plan-interval" value={draft.interval} onChange={(e) => set("interval", e.target.value as Interval)}>
                  {INTERVALS.map((i) => <option key={i} value={i}>{INTERVAL_LABEL[i]}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Features" htmlFor="plan-features" hint={`One per line. "Buyer email and phone on every lead" is always listed first.`} error={err("features")}>
              <Textarea id="plan-features" rows={4} value={draft.features} onChange={(e) => set("features", e.target.value)} placeholder={"Priority listing in category pages\nMonthly lead report"} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-3 rounded-xl p-3 ring-1 ring-line">
                <Switch label="Visible to vendors" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} />
                <Switch label="Mark as most popular" checked={draft.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
              </div>
              <Field label="Order" htmlFor="plan-order" hint="Lower first"><Input id="plan-order" type="number" min={0} value={draft.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></Field>
            </div>
            {draft.price > 0 && <p className="text-sm text-muted">{draft.audience === "RESELLER" ? "Resellers" : "Vendors"} will see <strong className="text-ink">{formatINR(Math.round(draft.price * 100))}</strong> per {INTERVAL_PER[draft.interval]}.</p>}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={save.pending}>{draft.id ? "Save plan" : "Create plan"}</Button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={bulkDelete}
        onClose={() => setBulkDelete(false)}
        onConfirm={() => void bulk.run(picked, (id) => deletePlanAction({ id }), "Deleted", done)}
        busy={bulk.pending}
        title={`Delete ${picked.length} ${picked.length === 1 ? "plan" : "plans"}?`}
        confirmLabel="Delete"
        recycleBin
      >
        Plans that vendors have bought before are hidden instead of deleted, so their past payments keep their plan.
      </ConfirmDialog>
      <ConfirmDialog open={remove !== null} onClose={() => setRemove(null)} onConfirm={() => remove && void del.run({ id: remove.id })} busy={del.pending} title={`Delete ${remove?.name ?? "plan"}?`} confirmLabel="Delete" recycleBin>
        If vendors have bought this plan before, it&apos;s hidden instead so their billing history stays intact. Active subscriptions keep running until they end.
      </ConfirmDialog>
    </>
  );
}
