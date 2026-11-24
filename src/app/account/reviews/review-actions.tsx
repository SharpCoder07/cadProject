"use client";

import { useState } from "react";
import { Pencil, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { cn } from "@/lib/utils";
import { deleteMyReviewAction, updateMyReviewAction } from "../actions";

export interface MyReview {
  id: string;
  product: string;
  status: string;
  rating: number;
  ratingEase: number | null;
  ratingValue: number | null;
  ratingSupport: number | null;
  ratingFeatures: number | null;
  title: string;
  body: string;
  pros: string | null;
  cons: string | null;
  authorRole: string | null;
  companyName: string | null;
  companySize: string | null;
}

const SUB = [
  ["ratingEase", "Ease of use"],
  ["ratingValue", "Value for money"],
  ["ratingSupport", "Customer support"],
  ["ratingFeatures", "Features"],
] as const;
type SubKey = (typeof SUB)[number][0];

function RatingInput({ label, value, onChange, required, clearable }: { label: string; value: number; onChange: (v: number) => void; required?: boolean; clearable?: boolean }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </legend>
      <div className="mt-1 flex items-center gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={value === n} onClick={() => onChange(n)} className="rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Star className={cn("h-6 w-6", n <= value ? "text-accent" : "text-line")} fill="currentColor" strokeWidth={0} aria-hidden />
            <span className="sr-only">{n} star{n > 1 ? "s" : ""}</span>
          </button>
        ))}
        {clearable && value > 0 && (
          <button type="button" onClick={() => onChange(0)} className="ml-1 text-xs text-muted hover:text-ink">
            Clear
          </button>
        )}
      </div>
    </fieldset>
  );
}

/** Edit and Delete buttons for one row of "My reviews". */
export function ReviewRowActions({ review, minBodyLength, companySizes, autoApprove }: { review: MyReview; minBodyLength: number; companySizes: string[]; autoApprove: boolean }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rating, setRating] = useState(review.rating);
  const [sub, setSub] = useState<Record<SubKey, number>>({
    ratingEase: review.ratingEase ?? 0,
    ratingValue: review.ratingValue ?? 0,
    ratingSupport: review.ratingSupport ?? 0,
    ratingFeatures: review.ratingFeatures ?? 0,
  });
  const save = useServerAction(updateMyReviewAction, { onSuccess: () => setEditing(false) });
  const remove = useServerAction(deleteMyReviewAction, { onSuccess: () => setDeleting(false) });
  const fe = (k: string) => save.fieldErrors[k];

  function open() {
    setRating(review.rating);
    setSub({ ratingEase: review.ratingEase ?? 0, ratingValue: review.ratingValue ?? 0, ratingSupport: review.ratingSupport ?? 0, ratingFeatures: review.ratingFeatures ?? 0 });
    save.setFieldErrors({});
    setEditing(true);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim();
    void save.run({
      id: review.id,
      rating,
      ratingEase: sub.ratingEase || null,
      ratingValue: sub.ratingValue || null,
      ratingSupport: sub.ratingSupport || null,
      ratingFeatures: sub.ratingFeatures || null,
      title: text("title"),
      body: text("body"),
      pros: text("pros"),
      cons: text("cons"),
      authorRole: text("authorRole"),
      companyName: text("companyName"),
      companySize: text("companySize"),
    });
  }

  return (
    <>
      <div className="flex justify-end gap-1 whitespace-nowrap">
        <Button size="sm" variant="ghost" onClick={open} aria-label={`Edit your review of ${review.product}`}>
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
        </Button>
        <Button size="sm" variant="ghost" className="text-danger hover:bg-danger/10" onClick={() => setDeleting(true)} aria-label={`Delete your review of ${review.product}`}>
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
        </Button>
      </div>

      <Dialog open={editing} onClose={() => setEditing(false)} title={`Edit your review of ${review.product}`} size="lg">
        <form onSubmit={submit} className="space-y-4">
          {!autoApprove && (
            <Alert tone={review.status === "APPROVED" ? "warning" : "info"}>
              {review.status === "APPROVED"
                ? "Your review is published. After you save, it's hidden from the product page until our team approves the changes."
                : "Our team checks the changes before the review appears on the product page."}
            </Alert>
          )}
          <RatingInput label="Overall rating" value={rating} onChange={setRating} required />
          {fe("rating") && <p className="text-xs text-danger">{fe("rating")?.[0]}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {SUB.map(([k, label]) => (
              <RatingInput key={k} label={label} value={sub[k]} onChange={(v) => setSub((s) => ({ ...s, [k]: v }))} clearable />
            ))}
          </div>
          <Field label="Review title" htmlFor="er-title" error={fe("title")} required>
            <Input id="er-title" name="title" defaultValue={review.title} maxLength={120} required />
          </Field>
          <Field label="Your experience" htmlFor="er-body" error={fe("body")} hint={`At least ${minBodyLength} characters.`} required>
            <Textarea id="er-body" name="body" defaultValue={review.body} rows={5} maxLength={5000} required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="What did you like?" htmlFor="er-pros" error={fe("pros")}>
              <Textarea id="er-pros" name="pros" defaultValue={review.pros ?? ""} rows={2} maxLength={1500} />
            </Field>
            <Field label="What could be better?" htmlFor="er-cons" error={fe("cons")}>
              <Textarea id="er-cons" name="cons" defaultValue={review.cons ?? ""} rows={2} maxLength={1500} />
            </Field>
            <Field label="Job title" htmlFor="er-role" error={fe("authorRole")}>
              <Input id="er-role" name="authorRole" defaultValue={review.authorRole ?? ""} maxLength={80} />
            </Field>
            <Field label="Company" htmlFor="er-company" error={fe("companyName")}>
              <Input id="er-company" name="companyName" defaultValue={review.companyName ?? ""} maxLength={120} autoComplete="organization" />
            </Field>
            <Field label="Company size" htmlFor="er-size" error={fe("companySize")}>
              <Select id="er-size" name="companySize" defaultValue={review.companySize ?? ""}>
                <option value="">Prefer not to say</option>
                {[...new Set([...companySizes, ...(review.companySize ? [review.companySize] : [])])].map((s) => (
                  <option key={s} value={s}>{s} employees</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={save.pending}>
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={save.pending}>
              Save changes
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={() => void remove.run({ id: review.id })} title="Delete this review?" confirmLabel="Delete review" busy={remove.pending}>
        Your review of <strong>{review.product}</strong> will be removed from the website and from your account. This can&apos;t be undone, but you can write a new review of the product later.
      </ConfirmDialog>
    </>
  );
}
