"use client";

import { useState } from "react";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { REQUEST_TYPES, typesFor, type CaseKind } from "@/lib/compliance/cases";
import { submitCaseAction } from "@/app/(site)/privacy-center/actions";
import { useT } from "@/components/site/texts";

/**
 * Data request / complaint form (Privacy center and Account › Privacy center). Works without the admin toast
 * provider, so it can sit on the public website.
 */
export function CaseForm({ kind: initialKind = "DATA_REQUEST", account, fixedKind, initialType }: { kind?: CaseKind; account?: { name: string; email: string } | null; fixedKind?: boolean; initialType?: string }) {
  const t = useT();
  const [kind, setKind] = useState<CaseKind>(initialKind);
  const firstType = (k: CaseKind) => typesFor(k)[0]!.value;
  const [type, setType] = useState<string>(initialType && typesFor(initialKind).some((x) => x.value === initialType) ? initialType : firstType(initialKind));
  const [f, setF] = useState({ name: account?.name ?? "", email: account?.email ?? "", phone: "", subject: "", details: "", website: "", contentUrl: "", declaration: false });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ referenceNo: string; verified: boolean } | null>(null);
  const types = typesFor(kind);
  const hint = kind === "DATA_REQUEST" ? REQUEST_TYPES.find((x) => x.value === type)?.hint : null;

  const switchKind = (k: CaseKind) => {
    setKind(k);
    setType(firstType(k));
    setErrors({});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const base = { name: f.name, email: f.email, phone: f.phone, details: f.details, website: f.website };
    const payload = kind === "DATA_REQUEST" ? { kind, type, ...base } : kind === "GRIEVANCE" ? { kind, type, subject: f.subject, ...base } : { kind, type, contentUrl: f.contentUrl, declaration: f.declaration, ...base };
    const r = await submitCaseAction(payload as never).catch(() => ({ ok: false as const, error: t("privacyCenter.errNetwork") }));
    setPending(false);
    if (r.ok) setDone(r.data);
    else {
      setError(r.error);
      setErrors("fieldErrors" in r && r.fieldErrors ? r.fieldErrors : {});
    }
  };

  if (done) {
    return (
      <div role="status" className="rounded-2xl border border-success/30 bg-success/5 p-6 text-center">
        {done.verified ? <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden /> : <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />}
        <p className="mt-3 text-lg font-bold text-ink">{done.verified ? t("privacyCenter.doneTitle") : t("privacyCenter.checkEmailTitle")}</p>
        <p className="mt-1 text-sm text-muted">{done.verified ? t("privacyCenter.doneText", { reference: done.referenceNo }) : t("privacyCenter.checkEmailText", { reference: done.referenceNo, email: f.email })}</p>
      </div>
    );
  }

  const fe = (k: string) => errors[k];
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!fixedKind && (
        <div role="tablist" aria-label={t("privacyCenter.formTitle")} className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
          {(["DATA_REQUEST", "GRIEVANCE", "CONTENT_COMPLAINT"] as const).map((k) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => switchKind(k)} className={`rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${kind === k ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-ink"}`}>
              {k === "DATA_REQUEST" ? t("privacyCenter.tabRequest") : k === "GRIEVANCE" ? t("privacyCenter.tabGrievance") : t("privacyCenter.tabContent")}
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <Field label={kind === "DATA_REQUEST" ? t("privacyCenter.requestType") : kind === "GRIEVANCE" ? t("privacyCenter.grievanceType") : t("privacyCenter.contentType")} htmlFor="cf-type" hint={hint || undefined}>
        <select id="cf-type" value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full rounded-control border border-line bg-surface px-3 text-sm text-ink">
          {types.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("privacyCenter.name")} htmlFor="cf-name" error={fe("name")}>
          <Input id="cf-name" value={f.name} autoComplete="name" maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label={t("privacyCenter.email")} htmlFor="cf-email" error={fe("email")} hint={account ? t("privacyCenter.emailAccountHint") : undefined}>
          <Input id="cf-email" type="email" value={f.email} autoComplete="email" disabled={Boolean(account)} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
      </div>
      <Field label={t("privacyCenter.phone")} htmlFor="cf-phone" error={fe("phone")}>
        <Input id="cf-phone" type="tel" value={f.phone} autoComplete="tel" maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </Field>
      {kind === "GRIEVANCE" && (
        <Field label={t("privacyCenter.subject")} htmlFor="cf-subject" error={fe("subject")}>
          <Input id="cf-subject" value={f.subject} maxLength={160} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        </Field>
      )}
      {kind === "CONTENT_COMPLAINT" && (
        <Field label={t("privacyCenter.contentUrl")} htmlFor="cf-url" error={fe("contentUrl")}>
          <Input id="cf-url" type="url" inputMode="url" placeholder="https://" value={f.contentUrl} maxLength={500} onChange={(e) => setF({ ...f, contentUrl: e.target.value })} />
        </Field>
      )}
      <Field label={kind === "DATA_REQUEST" ? t("privacyCenter.detailsRequest") : kind === "GRIEVANCE" ? t("privacyCenter.detailsGrievance") : t("privacyCenter.detailsContent")} htmlFor="cf-details" error={fe("details")}>
        <Textarea id="cf-details" rows={5} value={f.details} maxLength={5000} onChange={(e) => setF({ ...f, details: e.target.value })} />
      </Field>
      {kind === "CONTENT_COMPLAINT" && (
        <div>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" checked={f.declaration} onChange={(e) => setF({ ...f, declaration: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-line text-primary" />
            <span>{t("privacyCenter.declaration")}</span>
          </label>
          {fe("declaration") && <p className="mt-1 text-xs text-danger">{fe("declaration")?.[0]}</p>}
        </div>
      )}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <p className="text-xs text-muted">{account ? t("privacyCenter.noteSignedIn") : t("privacyCenter.noteVerify")}</p>
      <Button type="submit" loading={pending} className="w-full sm:w-auto">{t("privacyCenter.submit")}</Button>
    </form>
  );
}
