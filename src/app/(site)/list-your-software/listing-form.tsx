"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { FormFields, useFormDef } from "@/components/site/form-fields";
import { useLeadSubmit } from "@/components/site/lead-form";

/**
 * Partner application form, saved as a lead so the team can follow it up in Admin → Leads.
 * Fields, wording and the thank-you message are set in Admin › Pages › Forms:
 * - "vendor": “List your software” (source LIST_SOFTWARE)
 * - "reseller": “Become a reseller” (source BECOME_RESELLER)
 */
export function ListingForm({ consentText, variant = "vendor" }: { consentText: string; variant?: "vendor" | "reseller" }) {
  const form = variant === "reseller" ? "becomeReseller" : "listSoftware";
  const def = useFormDef(form);
  const s = useLeadSubmit(form, def, { source: variant === "reseller" ? "BECOME_RESELLER" : "LIST_SOFTWARE" });

  if (s.done !== null) {
    return (
      <div className="flex flex-col items-center py-10 text-center" role="status">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-success/10"><CheckCircle2 className="h-8 w-8 text-success" aria-hidden /></span>
        <h2 className="mt-4 font-display text-xl font-semibold text-ink">{def.successTitle}</h2>
        {def.successText && <p className="mt-2 max-w-sm text-sm text-muted">{def.successText}</p>}
        {s.done && <p className="mt-3 rounded-control bg-bg px-3 py-1.5 text-sm text-ink">{s.t("forms.referenceLabel")} <strong>{s.done}</strong></p>}
      </div>
    );
  }

  return (
    <form onSubmit={s.submit} noValidate className="space-y-4">
      {s.serverError && <Alert tone="danger">{s.serverError}</Alert>}
      <FormFields def={def} values={s.values} errors={s.errors} onChange={s.change} idPrefix={`ls-${variant}`} />
      {s.honeypotField}
      <Checkbox label={consentText} checked={s.consent} onChange={(e) => s.setConsent(e.target.checked)} aria-invalid={!!s.errors.consent || undefined} />
      {s.errors.consent && <p className="-mt-2 text-xs text-danger">{s.errors.consent}</p>}
      <Button type="submit" variant="accent" size="lg" loading={s.pending} className="w-full">{def.submitLabel}</Button>
    </form>
  );
}
