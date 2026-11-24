"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { LEAD_SOURCES, LeadTypeKey } from "@/lib/validation/leads";
import { checkAnswers, type Answers, type FormDef } from "@/lib/forms";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { FormFields, useFormDef } from "./form-fields";
import { useT } from "./texts";

export interface LeadFormConfig {
  consentText: string;
  /** Kept for older callers; the options now come from Admin › Pages › Forms. */
  companySizes?: string[];
  successMessage: string;
  submitLabel: string;
  requireCompany?: boolean;
}

/** Sends a form set up in Admin › Pages › Forms to /api/leads. Shared by the enquiry and partner forms. */
export function useLeadSubmit(form: "enquiry" | "listSoftware" | "becomeReseller", def: FormDef, opts: { compact?: boolean; softwareSlugs?: string[]; source: (typeof LEAD_SOURCES)[number]; type?: LeadTypeKey }) {
  const t = useT();
  const [values, setValues] = useState<Answers>({});
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const startedAt = useMemo(() => Date.now(), []);
  const tracking = useRef<Record<string, string | null>>({});
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    tracking.current = { sourceUrl: window.location.href.slice(0, 500), utmSource: sp.get("utm_source"), utmMedium: sp.get("utm_medium"), utmCampaign: sp.get("utm_campaign") };
  }, []);

  const change = (id: string, v: string | boolean) => {
    setValues((x) => ({ ...x, [id]: v }));
    if (errors[id]) setErrors((e) => ({ ...e, [id]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const { errors: local } = checkAnswers(def, values, t, { compact: opts.compact });
    if (!consent) local.consent = t("forms.errConsent");
    setErrors(local);
    if (Object.keys(local).length) return setServerError(t("forms.errCheck"));
    setPending(true);
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ form, answers: values, compact: Boolean(opts.compact), softwareSlugs: opts.softwareSlugs ?? [], source: opts.source, type: opts.type, ...tracking.current, consent: true, website: honeypot.current?.value ?? "", startedAt }),
    }).catch(() => null);
    setPending(false);
    if (!res) return setServerError(t("forms.errNetwork"));
    const body = (await res.json().catch(() => ({}))) as { referenceNo?: string; error?: string; fieldErrors?: Record<string, string[]> };
    if (!res.ok) {
      setErrors(Object.fromEntries(Object.entries(body.fieldErrors ?? {}).map(([k, v]) => [k, v[0]])));
      return setServerError(body.error ?? t("forms.errFailed"));
    }
    setDone(body.referenceNo ?? "");
  }

  const honeypotField = (
    <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden>
      <label>
        {t("forms.honeypot")} <input ref={honeypot} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  );
  return { t, values, change, consent, setConsent, errors, serverError, pending, done, submit, honeypotField };
}

/** Enquiry form (“Get free quote” pop-up, product, city and contact pages, Enquiry form block). */
export function LeadForm({ config, softwareSlugs = [], source, type, requirementPlaceholder, compact = false, onDone }: { config: LeadFormConfig; softwareSlugs?: string[]; source: (typeof LEAD_SOURCES)[number]; /** What the buyer is asking for (quote, demo…); set by the button that opened the form. */ type?: LeadTypeKey; requirementPlaceholder?: string; compact?: boolean; onDone?: () => void }) {
  const def = useFormDef("enquiry");
  const s = useLeadSubmit("enquiry", def, { compact, softwareSlugs, source, type });
  const notified = useRef(false);
  useEffect(() => {
    if (s.done !== null && !notified.current) {
      notified.current = true;
      onDone?.();
    }
  }, [s.done, onDone]);

  if (s.done !== null) {
    return (
      <div className="flex flex-col items-center py-6 text-center" role="status">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden />
        <p className="mt-3 font-medium">{config.successMessage}</p>
        {s.done && <p className="mt-1 text-sm text-muted">{s.t("forms.reference", { ref: s.done })}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={s.submit} noValidate className="space-y-4">
      {s.serverError && <Alert tone="danger">{s.serverError}</Alert>}
      <FormFields def={def} values={s.values} errors={s.errors} onChange={s.change} idPrefix="lead" compact={compact} placeholders={{ message: requirementPlaceholder }} />
      {s.honeypotField}
      <Checkbox label={config.consentText} checked={s.consent} onChange={(e) => s.setConsent(e.target.checked)} aria-invalid={!!s.errors.consent || undefined} />
      {s.errors.consent && <p className="-mt-2 text-xs text-danger">{s.errors.consent}</p>}
      <Button type="submit" variant="accent" size="lg" loading={s.pending} className="w-full">
        {config.submitLabel}
      </Button>
    </form>
  );
}
