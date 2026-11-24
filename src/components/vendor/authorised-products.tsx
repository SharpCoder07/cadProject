"use client";

import Link from "next/link";
import { useState } from "react";
import { Award, Clock, Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { RelationPicker } from "@/components/admin/relation-picker";
import { useServerAction } from "@/components/admin/use-action";
import { useConfirm } from "@/components/ui/dialog";

type Result = { ok: true; data: unknown; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export interface AuthorisedRow {
  softwareId: string;
  name: string;
  slug: string;
  vendorName: string | null;
  logoUrl: string | null;
  partnerLevel: string | null;
  /** Portal: a pending request for this product. */
  pending?: "CREATE" | "UPDATE" | "DELETE" | null;
}

/**
 * Products a reseller is authorised to sell. Staff ("admin") change it directly;
 * reseller users ("portal") send each change to the Super Admin for approval.
 */
export function AuthorisedProducts({
  mode,
  rows,
  canEdit = true,
  save,
  remove,
}: {
  mode: "admin" | "portal";
  rows: AuthorisedRow[];
  canEdit?: boolean;
  save: (input: { softwareId: string; partnerLevel: string | null; note?: string | null }) => Promise<Result>;
  remove: (input: { softwareId: string; note?: string | null }) => Promise<Result>;
}) {
  const [pick, setPick] = useState<string[]>([]);
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ id: string; level: string } | null>(null);
  const add = useServerAction(save, { onSuccess: () => { setPick([]); setLevel(""); setNote(""); } });
  const update = useServerAction(save, { onSuccess: () => setEditing(null) });
  const del = useServerAction(remove);
  const portal = mode === "portal";
  const [ask, confirmDialog] = useConfirm();
  const confirmRemove = async (r: AuthorisedRow) => {
    const yes = await ask(
      portal
        ? { title: `Ask to stop reselling ${r.name}?`, message: "The Super Admin reviews the request. The product stays listed until it is approved.", confirmLabel: "Send request" }
        : { title: `Remove ${r.name}?`, message: "This reseller will no longer show as an authorised reseller on the product page.", confirmLabel: "Remove", recycleBin: true },
    );
    if (yes) void del.run({ softwareId: r.softwareId });
  };

  return (
    <Panel>
      <PanelHeader
        title="Authorised products"
        description={portal ? "Products you're approved to resell. They show your company as an authorised reseller on the product page." : "Products this reseller may sell. Shown on each product page under “Authorised resellers”."}
      />
      {canEdit && (
        <form
          className="grid gap-3 border-b border-line p-5 md:grid-cols-[1fr_12rem_auto] md:items-end"
          onSubmit={(e) => { e.preventDefault(); if (pick[0]) void add.run({ softwareId: pick[0], partnerLevel: level.trim() || null, note: note.trim() || null }); }}
        >
          <Field label="Product" htmlFor="ap-product" error={add.fieldErrors.softwareId?.[0]}>
            <RelationPicker id="ap-product" type="software" value={pick} onChange={setPick} placeholder="Search products…" exclude={rows.map((r) => r.softwareId)} />
          </Field>
          <Field label="Partner level (optional)" htmlFor="ap-level">
            <Input id="ap-level" className="h-9" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. Gold Partner" maxLength={60} />
          </Field>
          <Button type="submit" size="sm" className="h-9" loading={add.pending} disabled={!pick[0]}><Plus className="h-4 w-4" aria-hidden /> {portal ? "Request" : "Add"}</Button>
          {portal && (
            <Field label="Note for the reviewer (optional)" htmlFor="ap-note" className="md:col-span-3">
              <Input id="ap-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Certified partner since 2021, certificate no. …" maxLength={500} />
            </Field>
          )}
        </form>
      )}
      {rows.length === 0 ? (
        <div className="flex flex-col items-center px-5 py-10 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-ink/5 text-muted"><Package className="h-5 w-5" aria-hidden /></span>
          <p className="mt-3 font-medium text-ink">No authorised products yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{portal ? <>Search for a product above, or <Link href="/reseller/browse" className="font-medium text-mint-ink underline">browse all products</Link>, and send it for approval.</> : "Add the products this reseller is approved to sell."}</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.softwareId} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                {r.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small logo
                  <img src={r.logoUrl} alt="" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-sm font-bold text-muted">{r.name.slice(0, 1)}</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <Link href={`/software/${r.slug}`} target="_blank" className="font-semibold text-ink hover:text-mint-ink">{r.name}</Link>
                <span className="block text-xs text-muted">{r.vendorName ? `by ${r.vendorName}` : "—"}</span>
              </span>
              {editing?.id === r.softwareId ? (
                <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void update.run({ softwareId: r.softwareId, partnerLevel: editing.level.trim() || null }); }}>
                  <Input aria-label="Partner level" value={editing.level} onChange={(e) => setEditing({ ...editing, level: e.target.value })} placeholder="Partner level" maxLength={60} className="w-44" autoFocus />
                  <Button type="submit" size="sm" loading={update.pending}>Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
                </form>
              ) : (
                <>
                  {r.partnerLevel && <Badge tone="success"><Award className="h-3 w-3" aria-hidden /> {r.partnerLevel}</Badge>}
                  {r.pending === "CREATE" && <Badge tone="warning"><Clock className="h-3 w-3" aria-hidden /> Waiting for approval</Badge>}
                  {r.pending === "UPDATE" && <Badge tone="warning"><Clock className="h-3 w-3" aria-hidden /> Change waiting for approval</Badge>}
                  {r.pending === "DELETE" && <Badge tone="warning"><Clock className="h-3 w-3" aria-hidden /> Removal waiting for approval</Badge>}
                  {canEdit && r.pending !== "CREATE" && (
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => setEditing({ id: r.softwareId, level: r.partnerLevel ?? "" })}>Edit level</Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className={portal ? "text-danger" : "w-8 px-0 text-danger"}
                        title={portal ? undefined : "Remove"}
                        loading={del.pending}
                        disabled={r.pending === "DELETE"}
                        onClick={() => void confirmRemove(r)}
                        aria-label={`Remove ${r.name}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />{portal && " Request removal"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {confirmDialog}
    </Panel>
  );
}
