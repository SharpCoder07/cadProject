"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { Badge, type BadgeTone } from "@/components/ui/misc";
import { ListPanel, PILL_TRACK, PanelEmpty, pillTab, showingAll } from "@/components/admin/list-panel";
import { AdminTable } from "@/components/admin/page-header";
import { cn } from "@/lib/utils";
import { DecisionNote } from "../requests/decision-note";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { useServerAction } from "@/components/admin/use-action";
import { OfferFields, emptyOffer, offerPayload, toLocalInput, type OfferDraft } from "@/components/offers/offer-form";
import { proposeOfferAction, removeOfferAction } from "./actions";

interface Row {
  id: string;
  softwareId: string;
  product: string;
  productSlug: string;
  title: string;
  discount: string;
  description: string;
  couponCode: string;
  terms: string;
  url: string;
  startsAt: string;
  endsAt: string | null;
  phase: "draft" | "scheduled" | "live" | "ended";
  request: { action: string; status: string; note: string | null } | null;
}

const PHASE: Record<Row["phase"], [string, BadgeTone]> = { draft: ["Not live yet", "neutral"], scheduled: ["Scheduled", "primary"], live: ["Live", "success"], ended: ["Ended", "neutral"] };
const PENDING: Record<string, string> = { CREATE: "Waiting for approval", UPDATE: "Changes waiting for approval", DELETE: "Removal waiting for approval" };

const TABS: [ "all" | Row["phase"], string][] = [["all", "All"], ["live", "Live"], ["scheduled", "Scheduled"], ["draft", "Not live yet"], ["ended", "Ended"]];

const ADD_EVENT = "vendor-offers:add";

/** "New offer" button for the page header (top right); opens the dialog in VendorOffers. */
export function NewVendorOfferButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button size="sm" disabled={disabled} onClick={() => window.dispatchEvent(new Event(ADD_EVENT))}>
      <Plus className="h-4 w-4" aria-hidden /> New offer
    </Button>
  );
}

export function VendorOffers({ offers, products }: { offers: Row[]; products: { id: string; name: string; note?: string }[] }) {
  const [edit, setEdit] = useState<{ id: string | null; draft: OfferDraft; note: string } | null>(null);
  const [remove, setRemove] = useState<Row | null>(null);
  const [phase, setPhase] = useState<"all" | Row["phase"]>("all");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return offers.filter((o) => (phase === "all" || o.phase === phase) && (!q || [o.title, o.product, o.couponCode, o.discount].some((t) => t.toLowerCase().includes(q))));
  }, [offers, phase, query]);
  const [removeNote, setRemoveNote] = useState("");
  const propose = useServerAction(proposeOfferAction, { onSuccess: () => setEdit(null) });
  const del = useServerAction(removeOfferAction, { onSuccess: () => { setRemove(null); setRemoveNote(""); } });

  const open = (row?: Row) => {
    propose.setFieldErrors({});
    setEdit(row
      ? { id: row.id, note: "", draft: { softwareId: row.softwareId, title: row.title, discount: row.discount, description: row.description, couponCode: row.couponCode, terms: row.terms, url: row.url, startsAt: toLocalInput(row.startsAt), endsAt: toLocalInput(row.endsAt) } }
      : { id: null, note: "", draft: emptyOffer(products.length === 1 ? products[0]!.id : "") });
  };

  useEffect(() => {
    const onAdd = () => open();
    window.addEventListener(ADD_EVENT, onAdd);
    return () => window.removeEventListener(ADD_EVENT, onAdd);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open() only resets local state
  }, []);

  return (
    <SelectionProvider>
      <BulkActionBar noun="offer" items={[{ label: "Remove", action: removeOfferAction, extra: { note: null }, done: "Requested removal of", danger: true, recycleBin: false, confirm: "Live offers keep showing until the Super Admin approves. Offers not live yet are withdrawn straight away. Offers with a request already waiting are skipped." }]} />
      <ListPanel
        tabs={
          <nav aria-label="Filter offers" className={PILL_TRACK}>
            {TABS.map(([key, label]) => (
              <button key={key} type="button" onClick={() => setPhase(key)} aria-pressed={phase === key} className={pillTab(phase === key)}>
                {label}
                <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", phase === key ? "bg-mint-soft text-mint-ink" : "bg-surface text-muted")}>{key === "all" ? offers.length : offers.filter((o) => o.phase === key).length}</span>
              </button>
            ))}
          </nav>
        }
        meta={showingAll(shown.length)}
        actions={
          offers.length > 0 && (
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search offers</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                placeholder="Search offers…"
                autoComplete="off"
                className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </label>
          )
        }
      >
      {shown.length === 0 ? (
        <PanelEmpty title={offers.length === 0 ? "No offers yet" : query ? "No matching offers" : "No offers here"} icon={<Tag className="h-5 w-5" />}>
          {offers.length === 0 ? "Create an offer, such as a festive discount or a coupon code. Buyers see it on your product page, and buyers who favourited your product are emailed." : query ? "Try a different search." : "Try another tab."}
        </PanelEmpty>
      ) : (
        <AdminTable bare minWidth={56}>
          <thead><tr><th className="w-10"><AllCheckbox ids={shown.filter((o) => o.request?.status !== "PENDING").map((o) => o.id)} /></th><th>Offer</th><th>Product</th><th>When</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id}>
                <td>{o.request?.status !== "PENDING" && <RowCheckbox id={o.id} label={o.title} />}</td>
                <td>
                  <span className="font-medium text-ink">{o.title}</span> <Badge tone="accent" className="ml-1">{o.discount}</Badge>
                  <span className="block text-xs text-muted">{o.couponCode ? <span className="font-mono">{o.couponCode}</span> : "No coupon"}</span>
                </td>
                <td><Link href={`/software/${o.productSlug}`} target="_blank" className="hover:text-mint-ink">{o.product}</Link></td>
                <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(o.startsAt)}<br />{o.endsAt ? `to ${formatDateTime(o.endsAt)}` : "no end date"}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone={PHASE[o.phase][1]}>{PHASE[o.phase][0]}</Badge>
                    {o.request?.status === "REJECTED" && (
                      <DecisionNote rejected item={o.title} request={o.request.action === "DELETE" ? "Remove offer" : o.request.action === "CREATE" ? "New offer" : "Edit offer"} note={`${o.request.note ?? "No reason given."} You can edit and send it again.`} when={null} />
                    )}
                  </span>
                  {o.request?.status === "PENDING" && <span className="mt-1 block"><Badge tone="warning">{PENDING[o.request.action] ?? "Waiting for approval"}</Badge></span>}
                </td>
                <td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {o.phase !== "ended" && <Button size="sm" variant="secondary" className="w-8 px-0" aria-label={`Edit ${o.title}`} title="Edit" onClick={() => open(o)}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>}
                    <Button size="sm" variant="secondary" className="w-8 px-0 text-danger hover:border-danger/40 hover:bg-danger/5" aria-label={`${o.phase === "draft" ? "Withdraw" : "Remove"} ${o.title}`} title={o.phase === "draft" ? "Withdraw" : "Remove"} onClick={() => setRemove(o)}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
      </ListPanel>

      <Dialog open={edit !== null} onClose={() => setEdit(null)} size="lg" title={edit?.id ? "Edit offer" : "New offer"} description="Sent to our team for approval. A live offer keeps running unchanged until your edit is approved.">
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void propose.run({ ...offerPayload(edit.draft), id: edit.id, note: edit.note || null }); }}>
            <OfferFields draft={edit.draft} onChange={(draft) => setEdit({ ...edit, draft })} products={products} errors={propose.fieldErrors} />
            <Field label="Note for the reviewer" htmlFor="o-note" hint="Optional"><Textarea id="o-note" rows={2} value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={propose.pending}>Send for approval</Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={remove !== null} onClose={() => setRemove(null)} size="sm" title={remove?.phase === "draft" ? "Withdraw this offer?" : "Remove this offer?"} description={remove ? `${remove.title} — ${remove.product}` : undefined}>
        <div className="space-y-4">
          <p className="text-sm text-muted">{remove?.phase === "draft" ? "It hasn't been approved yet, so it's simply deleted." : "Removing a live or scheduled offer needs approval. It keeps running until then."}</p>
          {remove?.phase !== "draft" && <Field label="Reason" htmlFor="r-note" hint="Optional"><Textarea id="r-note" rows={2} value={removeNote} onChange={(e) => setRemoveNote(e.target.value)} /></Field>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRemove(null)}>Cancel</Button>
            <Button size="sm" variant="danger" loading={del.pending} onClick={() => remove && void del.run({ id: remove.id, note: removeNote || null })}>{remove?.phase === "draft" ? "Withdraw" : "Request removal"}</Button>
          </div>
        </div>
      </Dialog>
    </SelectionProvider>
  );
}
