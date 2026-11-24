"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { PasswordChecklist, passwordOk } from "@/components/auth/password-checklist";
import { proposeOwnNameAction, proposeOwnPasswordAction } from "../actions";

export function NameForm({ name, email }: { name: string; email: string }) {
  const [value, setValue] = useState(name);
  const save = useServerAction(proposeOwnNameAction);
  return (
    <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save.run({ name: value }); }}>
      <Field label="Full name" htmlFor="va-name" error={save.fieldErrors.name} required>
        <Input id="va-name" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="name" maxLength={80} />
      </Field>
      <Field label="Email" htmlFor="va-email" hint="Ask the Super Admin if your email needs to change.">
        <Input id="va-email" value={email} readOnly disabled />
      </Field>
      <div className="flex justify-end sm:col-span-2">
        <Button size="sm" type="submit" loading={save.pending} disabled={!value.trim() || value.trim() === name}>Send for approval</Button>
      </div>
    </form>
  );
}

function Secret({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function VendorPasswordForm({ email, name }: { email?: string; name?: string } = {}) {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [mismatch, setMismatch] = useState(false);
  const send = useServerAction(proposeOwnPasswordAction, { onSuccess: () => setF({ current: "", next: "", confirm: "" }) });
  const strong = passwordOk(f.next, { email, name });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (f.next !== f.confirm) return setMismatch(true); setMismatch(false); void send.run({ current: f.current, next: f.next }); }}>
      <Field label="Current password" htmlFor="vp-current" error={send.fieldErrors.current} required><Secret id="vp-current" value={f.current} onChange={(v) => setF({ ...f, current: v })} autoComplete="current-password" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="vp-next" required><Secret id="vp-next" value={f.next} onChange={(v) => setF({ ...f, next: v })} autoComplete="new-password" /></Field>
        <Field label="Confirm new password" htmlFor="vp-confirm" error={mismatch ? "The two passwords don't match." : undefined} required><Secret id="vp-confirm" value={f.confirm} onChange={(v) => setF({ ...f, confirm: v })} autoComplete="new-password" /></Field>
      </div>
      <PasswordChecklist password={f.next} email={email} name={name} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-muted">Keep using your current password until the Super Admin approves. Then other devices are signed out.</p>
        <Button size="sm" type="submit" loading={send.pending} disabled={!f.current || !strong || !f.confirm}>Send for approval</Button>
      </div>
    </form>
  );
}
