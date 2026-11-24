"use client";

import { Field, Input, Select, Textarea } from "@/components/ui/field";

export interface OfferDraft {
  softwareId: string;
  title: string;
  discount: string;
  description: string;
  couponCode: string;
  terms: string;
  url: string;
  /** datetime-local values in the browser's time zone */
  startsAt: string;
  endsAt: string;
}

/** ISO date → value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export const emptyOffer = (softwareId = ""): OfferDraft => ({ softwareId, title: "", discount: "", description: "", couponCode: "", terms: "", url: "", startsAt: toLocalInput(new Date()), endsAt: "" });

/** Payload for the server: local date-times converted to ISO so time zones never shift them. */
export const offerPayload = (d: OfferDraft) => ({
  ...d,
  startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : "",
  endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : "",
});

export function OfferFields({ draft, onChange, products, errors, lockProduct }: { draft: OfferDraft; onChange: (d: OfferDraft) => void; products: { id: string; name: string; note?: string }[]; errors: Record<string, string[]>; lockProduct?: boolean }) {
  const set = <K extends keyof OfferDraft>(k: K, v: OfferDraft[K]) => onChange({ ...draft, [k]: v });
  const err = (k: string) => errors[k]?.[0];
  return (
    <div className="space-y-4">
      <Field label="Product" htmlFor="o-product" error={err("softwareId")} required>
        <Select id="o-product" value={draft.softwareId} onChange={(e) => set("softwareId", e.target.value)} disabled={lockProduct}>
          <option value="">Choose a product…</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.note ? ` (${p.note})` : ""}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <Field label="Offer title" htmlFor="o-title" error={err("title")} required><Input id="o-title" value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Diwali sale" maxLength={100} /></Field>
        <Field label="Discount" htmlFor="o-discount" error={err("discount")} required><Input id="o-discount" value={draft.discount} onChange={(e) => set("discount", e.target.value)} placeholder="20% off" maxLength={60} /></Field>
      </div>
      <Field label="Details" htmlFor="o-desc" error={err("description")} hint="What the buyer gets, in a sentence or two.">
        <Textarea id="o-desc" rows={2} value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={500} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coupon code" htmlFor="o-code" error={err("couponCode")} hint="Optional"><Input id="o-code" value={draft.couponCode} onChange={(e) => set("couponCode", e.target.value.toUpperCase())} placeholder="DIWALI20" maxLength={40} className="font-mono" /></Field>
        <Field label="Offer link" htmlFor="o-url" error={err("url")} hint="Optional. Defaults to the product page."><Input id="o-url" type="url" value={draft.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="o-start" error={err("startsAt")} required><Input id="o-start" type="datetime-local" value={draft.startsAt} onChange={(e) => set("startsAt", e.target.value)} /></Field>
        <Field label="Ends" htmlFor="o-end" error={err("endsAt")} hint="Leave empty for no end date."><Input id="o-end" type="datetime-local" value={draft.endsAt} onChange={(e) => set("endsAt", e.target.value)} /></Field>
      </div>
      <Field label="Terms" htmlFor="o-terms" error={err("terms")} hint="Optional, e.g. new customers only.">
        <Textarea id="o-terms" rows={2} value={draft.terms} onChange={(e) => set("terms", e.target.value)} maxLength={1000} />
      </Field>
    </div>
  );
}
