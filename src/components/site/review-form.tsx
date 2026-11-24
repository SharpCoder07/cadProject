"use client";

import Link from "next/link";
import { useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { useT } from "@/components/site/texts";

function RatingInput({ name, label, value, onChange, required }: { name: string; label: string; value: number; onChange: (v: number) => void; required?: boolean }) {
  const tx = useT();
  return (
    <fieldset>
      <legend className="text-sm font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </legend>
      <div className="mt-1 flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <Star className={cn("h-7 w-7 peer-focus-visible:ring-2 peer-focus-visible:ring-primary", n <= value ? "text-accent" : "text-line")} fill="currentColor" strokeWidth={0} aria-hidden />
            <span className="sr-only">{n > 1 ? tx("review.star", { n }) : tx("review.starOne")}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

type Me = { signedIn: boolean; canReview: boolean; name: string | null; existing: { status: string; createdAt: string } | null };

/**
 * "Write a review" on a product page. Reviews are written from a signed-in buyer account (name and
 * email come from the account; one review per product). Visitors are asked to sign in first.
 */
export function ReviewForm({ softwareSlug, minBodyLength, companySizes }: { softwareSlug: string; minBodyLength: number; companySizes: string[] }) {
  const tx = useT();
  const [rating, setRating] = useState(0);
  const [sub, setSub] = useState({ ratingEase: 0, ratingValue: 0, ratingSupport: 0, ratingFeatures: 0 });
  const [state, setState] = useState<{ status: "idle" | "busy" | "done"; error?: string; fields?: Record<string, string[]> }>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [checking, setChecking] = useState(false);
  const next = encodeURIComponent(`/software/${softwareSlug}#write-review`);

  const start = async () => {
    setChecking(true);
    const res = await fetch(`/api/reviews?slug=${encodeURIComponent(softwareSlug)}`, { credentials: "same-origin" }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as Me | null;
    setChecking(false);
    setMe(data ?? { signedIn: false, canReview: false, name: null, existing: null });
    setOpen(true);
  };

  if (state.status === "done") return <Alert tone="success" className="mt-4" title={tx("review.thanksTitle")}>{tx("review.thanksText")}</Alert>;
  if (!open || !me) {
    return (
      <Button variant="secondary" className="mt-4" loading={checking} onClick={() => void start()}>
        {tx("review.write")}
      </Button>
    );
  }
  if (!me.signedIn) {
    return (
      <div className="mt-4 rounded-panel border border-line bg-bg p-4">
        <p className="font-semibold text-ink">{tx("review.signInTitle")}</p>
        <p className="mt-1 text-sm text-muted">{tx("review.signInText")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/login?next=${next}`} className="inline-flex h-10 items-center rounded-control bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary/90">{tx("review.signIn")}</Link>
          <Link href={`/signup?next=${next}`} className="inline-flex h-10 items-center rounded-control border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-fg">{tx("review.signUp")}</Link>
        </div>
      </div>
    );
  }
  if (!me.canReview) {
    return <Alert tone="info" className="mt-4">{tx("review.notBuyer")}</Alert>;
  }
  if (me.existing) {
    return (
      <Alert tone="info" className="mt-4" title={tx("review.alreadyTitle")}>
        {me.existing.status === "APPROVED" ? tx("review.published") : me.existing.status === "PENDING" ? tx("review.pending") : tx("review.rejected")}{" "}
        <Link href="/account/reviews" className="font-semibold underline">{tx("review.editLink")}</Link>
      </Alert>
    );
  }

  const fe = (k: string) => state.fields?.[k]?.[0];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payload = {
      ...Object.fromEntries(form.entries()),
      softwareSlug,
      rating,
      ...Object.fromEntries(Object.entries(sub).map(([k, v]) => [k, v || null])),
    };
    setState({ status: "busy" });
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string[]> } | undefined;
    if (!res?.ok) return setState({ status: "idle", error: body?.error ?? tx("review.failed"), fields: body?.fieldErrors });
    setState({ status: "done" });
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <p className="text-sm text-muted">{tx("review.postingAs", { name: me.name ?? "" })}</p>
      <RatingInput name="rating-ui" label={tx("review.overall")} value={rating} onChange={setRating} required />
      {fe("rating") && <p className="text-xs text-danger">{fe("rating")}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ["ratingEase", tx("product.aspectEase")],
          ["ratingValue", tx("product.aspectValue")],
          ["ratingSupport", tx("product.aspectSupport")],
          ["ratingFeatures", tx("product.aspectFeatures")],
        ] as const).map(([k, label]) => (
          <RatingInput key={k} name={`${k}-ui`} label={label} value={sub[k]} onChange={(v) => setSub((s) => ({ ...s, [k]: v }))} />
        ))}
      </div>
      <Field label={tx("review.titleLabel")} htmlFor="rv-title" error={fe("title")} required>
        <Input id="rv-title" name="title" maxLength={120} />
      </Field>
      <Field label={tx("review.bodyLabel")} htmlFor="rv-body" error={fe("body")} hint={tx("review.bodyHint", { min: minBodyLength })} required>
        <Textarea id="rv-body" name="body" rows={5} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tx("review.prosLabel")} htmlFor="rv-pros"><Textarea id="rv-pros" name="pros" rows={2} /></Field>
        <Field label={tx("review.consLabel")} htmlFor="rv-cons"><Textarea id="rv-cons" name="cons" rows={2} /></Field>
        <Field label={tx("review.roleLabel")} htmlFor="rv-role"><Input id="rv-role" name="authorRole" /></Field>
        <Field label={tx("review.companyLabel")} htmlFor="rv-company"><Input id="rv-company" name="companyName" autoComplete="organization" /></Field>
        <Field label={tx("review.sizeLabel")} htmlFor="rv-size">
          <Select id="rv-size" name="companySize" defaultValue="">
            <option value="">{tx("forms.select")}</option>
            {companySizes.map((s) => <option key={s} value={s}>{tx("forms.sizeOption", { size: s })}</option>)}
          </Select>
        </Field>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Button type="submit" loading={state.status === "busy"}>{tx("review.submit")}</Button>
    </form>
  );
}
