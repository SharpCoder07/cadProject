"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Ban, Heart, Mail, Pencil, Plus, Search, Tag, Trash2, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Badge, type BadgeTone } from "@/components/ui/misc";
import { AdminTable } from "@/components/admin/page-header";
import { ListPanel, PanelEmpty, showingAll } from "@/components/admin/list-panel";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { useServerAction } from "@/components/admin/use-action";
import { OfferFields, emptyOffer, offerPayload, toLocalInput, type OfferDraft } from "@/components/offers/offer-form";
import { deleteOfferAction, endOfferAction, saveOfferAction } from "./actions";

export interface OfferRow {
  id: string;
  softwareId: string;
  product: string;
  productSlug: string;
  vendor: string | null;
  title: string;
  discount: string;
  description: string;
  couponCode: string;
  terms: string;
  url: string;
  startsAt: string;
  endsAt: string | null;
  phase: "draft" | "scheduled" | "live" | "ended";
  createdBy: string | null;
  announced: boolean;
  favourites: number;
}

export const PHASE: Record<OfferRow["phase"], [string, BadgeTone]> = { draft: ["Draft", "neutral"], scheduled: ["Scheduled", "primary"], live: ["Live", "success"], ended: ["Ended", "neutral"] };

const ADD_EVENT = "offers:add";

/** "New offer" button for the page header (top right); opens the dialog in OffersManager. */
export function NewOfferButton() {
  return (
    <Button size="sm" onClick={() => window.dispatchEvent(new Event(ADD_EVENT))}>
      <Plus className="h-4 w-4" aria-hidden /> New offer
    </Button>
  );
}

export function OffersManager({ offers, products, tabs }: { offers: OfferRow[]; products: { id: string; name: string; note?: string }[]; tabs?: ReactNode }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? offers.filter((o) => [o.title, o.product, o.vendor ?? "", o.couponCode, o.discount].some((t) => t.toLowerCase().includes(q))) : offers;
  }, [offers, query]);
  const [edit, setEdit] = useState<{ id: string | null; draft: OfferDraft } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "end" | "delete"; row: OfferRow } | null>(null);
  const save = useServerAction(saveOfferAction, { onSuccess: () => setEdit(null) });
  const end = useServerAction(endOfferAction, { onSuccess: () => setConfirm(null) });
  const del = useServerAction(deleteOfferAction, { onSuccess: () => setConfirm(null) });

  const open = (row?: OfferRow) => {
    save.setFieldErrors({});
    setEdit(
      row
        ? { id: row.id, draft: { softwareId: row.softwareId, title: row.title, discount: row.discount, description: row.description, couponCode: row.couponCode, terms: row.terms, url: row.url, startsAt: toLocalInput(row.startsAt), endsAt: toLocalInput(row.endsAt) } }
        : { id: null, draft: emptyOffer() },
    );
  };
  const submit = async (publish: boolean) => {
    if (!edit) return;
    await save.run({ ...offerPayload(edit.draft), id: edit.id, publish });
  };
  useEffect(() => {
    const onAdd = () => open();
    window.addEventListener(ADD_EVENT, onAdd);
    return () => window.removeEventListener(ADD_EVENT, onAdd);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open() only resets local state
  }, []);
  const editing = edit?.id ? offers.find((o) => o.id === edit.id) : null;

  return (
    <SelectionProvider>
      <BulkActionBar
        noun="offer"
        items={[
          { label: "End now", action: endOfferAction, done: "Ended", confirm: "Live and scheduled offers stop showing on the website straight away. Offers that already ended are skipped." },
          { label: "Delete", action: deleteOfferAction, done: "Deleted", danger: true },
        ]}
      />
      <ListPanel
        tabs={tabs}
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
        <PanelEmpty icon={<Tag className="h-5 w-5" />} title={query ? "No matching offers" : "No offers here"} action={!query && <Button size="sm" variant="secondary" onClick={() => open()}><Plus className="h-4 w-4" aria-hidden /> New offer</Button>}>
          {query ? "Try a different search." : "Create an offer to promote a product. Vendors can also propose offers on their own products."}
        </PanelEmpty>
      ) : (
        <AdminTable bare minWidth={62}>
          <thead><tr><th className="w-10"><AllCheckbox ids={shown.map((o) => o.id)} /></th><th>Offer</th><th>Product</th><th>When</th><th>Status</th><th>Favourites</th><th /></tr></thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id}>
                <td><RowCheckbox id={o.id} label={o.title} /></td>
                <td>
                  <span className="font-medium text-ink">{o.title}</span> <Badge tone="accent" className="ml-1">{o.discount}</Badge>
                  <span className="block text-xs text-muted">{o.couponCode ? <span className="font-mono">{o.couponCode}</span> : "No coupon"}{o.createdBy && ` · by ${o.createdBy}`}</span>
                </td>
                <td><Link href={`/software/${o.productSlug}`} target="_blank" className="hover:text-mint-ink">{o.product}</Link>{o.vendor && <span className="block text-xs text-muted">{o.vendor}</span>}</td>
                <td className="whitespace-nowrap text-xs text-muted">{formatDateTime(o.startsAt)}<br />{o.endsAt ? `to ${formatDateTime(o.endsAt)}` : "no end date"}</td>
                <td>
                  <Badge tone={PHASE[o.phase][1]}>{PHASE[o.phase][0]}</Badge>
                  {o.announced && <span className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-muted" title="Favourites were emailed"><Mail className="h-3 w-3" aria-hidden />sent</span>}
                </td>
                <td className="tabular-nums text-muted"><span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" aria-hidden />{o.favourites}</span></td>
                <td className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${o.title}`} onClick={() => open(o)}><Pencil className="h-4 w-4" /></Button>
                    {(o.phase === "live" || o.phase === "scheduled") && <Button size="icon" variant="ghost" aria-label={`End ${o.title}`} title="End now" onClick={() => setConfirm({ kind: "end", row: o })}><Ban className="h-4 w-4" /></Button>}
                    <Button size="icon" variant="ghost" aria-label={`Delete ${o.title}`} onClick={() => setConfirm({ kind: "delete", row: o })}><Trash2 className="h-4 w-4 text-danger" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
      </ListPanel>

      <Dialog open={edit !== null} onClose={() => setEdit(null)} size="lg" title={edit?.id ? "Edit offer" : "New offer"} description="Buyers who favourited the product are emailed once, when the offer goes live.">
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); void submit(true); }} className="space-y-4">
            <OfferFields draft={edit.draft} onChange={(draft) => setEdit({ ...edit, draft })} products={products} errors={save.fieldErrors} />
            <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              {(!editing || editing.phase === "draft") && <Button size="sm" variant="secondary" loading={save.pending} onClick={() => void submit(false)}>Save as draft</Button>}
              <Button size="sm" type="submit" loading={save.pending}>{editing && editing.phase !== "draft" ? "Save changes" : "Publish offer"}</Button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && void (confirm.kind === "end" ? end.run({ id: confirm.row.id }) : del.run({ id: confirm.row.id }))}
        busy={end.pending || del.pending}
        title={confirm?.kind === "end" ? `End “${confirm.row.title}” now?` : `Delete “${confirm?.row.title ?? ""}”?`}
        confirmLabel={confirm?.kind === "end" ? "End offer" : "Delete"}
        tone={confirm?.kind === "end" ? "primary" : "danger"}
        recycleBin={confirm?.kind !== "end"}
      >
        {confirm?.kind === "end" ? "It disappears from the product page straight away. You can still see it under Ended." : "It disappears from the product page straight away, and any pending vendor request for it is cancelled."}
      </ConfirmDialog>
    </SelectionProvider>
  );
}
