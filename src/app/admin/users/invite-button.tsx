"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Mail, RefreshCw, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { PasswordChecklist, passwordOk } from "@/components/auth/password-checklist";
import { cn } from "@/lib/utils";
import { createUserAction, inviteUserAction } from "./actions";
import { isVendorRoleKey } from "@/server/rbac/permissions";

/** A random password that meets the password rule (16 characters, all character kinds). */
function generatePassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?-+="];
  const all = sets.join("");
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0]! % chars.length]!;
  const chars = [...sets.map(pick), ...Array.from({ length: 12 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/**
 * Users › Add user: either send an invite (they set their own password from an email link), or create
 * the account with a password you set and share securely (optionally they must change it at first sign-in).
 */
export function InviteButton({ roles, vendors }: { roles: { id: string; name: string; key: string }[]; vendors: { id: string; name: string; kind: "VENDOR" | "RESELLER" }[] }) {
  const blank = { name: "", email: "", roleId: roles.find((r) => r.key === "CONTENT_EDITOR")?.id ?? roles[0]?.id ?? "", vendorId: "", password: "", mustChange: true };
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"invite" | "password">("invite");
  const [form, setForm] = useState(blank);
  const [link, setLink] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string; mustChange: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const invite = useServerAction(inviteUserAction, { onSuccess: (d) => { if (d.inviteLink) setLink(d.inviteLink); else setOpen(false); } });
  const create = useServerAction(createUserAction, { onSuccess: () => setCreated({ email: form.email.trim().toLowerCase(), password: form.password, mustChange: form.mustChange }) });
  const roleKey = roles.find((r) => r.id === form.roleId)?.key ?? "";
  const isVendor = isVendorRoleKey(roleKey);
  const isReseller = roleKey === "VENDOR_RESELLER";
  const pending = invite.pending || create.pending;
  const fe = mode === "invite" ? invite.fieldErrors : create.fieldErrors;
  const pwOk = passwordOk(form.password, { email: form.email, name: form.name });
  const signInUrl = typeof window === "undefined" ? "/login" : `${window.location.origin}/login`;
  const start = () => { setOpen(true); setLink(null); setCreated(null); setCopied(false); setForm(blank); };
  const copyDetails = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(`Sign in: ${signInUrl}\nEmail: ${created.email}\nPassword: ${created.password}`).catch(() => undefined);
    setCopied(true);
  };
  const submit = () => {
    const base = { name: form.name, email: form.email, roleId: form.roleId, vendorId: isVendor ? form.vendorId || null : null };
    if (mode === "invite") void invite.run(base);
    else void create.run({ ...base, password: form.password, mustChange: form.mustChange });
  };
  const choice = (m: typeof mode, Icon: typeof Mail, title: string, text: string) => (
    <button type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)} className={cn("flex flex-1 items-start gap-2.5 rounded-panel border p-3 text-left text-sm transition", mode === m ? "border-mint bg-mint-soft" : "border-line hover:bg-bg")}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", mode === m ? "text-mint-ink" : "text-muted")} aria-hidden />
      <span><span className="block font-semibold text-ink">{title}</span><span className="text-xs text-muted">{text}</span></span>
    </button>
  );
  return (
    <>
      <Button size="sm" onClick={start}><UserPlus className="h-4 w-4" aria-hidden /> Add user</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={created ? "User created" : "Add a user"} description={created ? undefined : "Invite them by email, or create the account with a password you share with them."}>
        {created ? (
          <div className="space-y-4">
            <Alert tone="warning" title="Share these details securely">
              The password is shown only now. Send it privately (in person, a phone call, or a secure messenger), not in the same message as the email address if you can avoid it. It isn&apos;t emailed or stored in readable form.
            </Alert>
            <dl className="grid grid-cols-[6rem_1fr] gap-y-2 rounded-panel border border-line bg-bg/50 p-4 text-sm">
              <dt className="text-muted">Sign in at</dt><dd className="break-all font-mono text-[13px]">{signInUrl}</dd>
              <dt className="text-muted">Email</dt><dd className="break-all font-mono text-[13px]">{created.email}</dd>
              <dt className="text-muted">Password</dt><dd className="break-all font-mono text-[13px]">{created.password}</dd>
            </dl>
            <p className="text-xs text-muted">
              At their first sign-in they set up two-step verification (staff and vendor accounts){created.mustChange ? " and then choose their own password" : ""}.
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => void copyDetails()}>{copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? "Copied" : "Copy details"}</Button>
              <Button size="sm" onClick={() => setOpen(false)}>Done</Button>
            </div>
          </div>
        ) : link ? (
          <Alert tone="info" title="Email delivery isn’t configured">Share this one-time link with them directly: <code className="mt-2 block break-all rounded bg-ink/5 p-2 text-xs">{link}</code></Alert>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
            <div className="flex flex-col gap-2 sm:flex-row" role="radiogroup" aria-label="How to set up the account">
              {choice("invite", Mail, "Send an invite", "They get an email link (valid 7 days) and set their own password.")}
              {choice("password", KeyRound, "Set a password", "You choose the password now and share it with them securely.")}
            </div>
            <Field label="Name" htmlFor="i-name" error={fe.name} required><Input id="i-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Email" htmlFor="i-email" error={fe.email} required><Input id="i-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Role" htmlFor="i-role"><Select id="i-role" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
            {isVendor && <Field label={isReseller ? "Reseller" : "Vendor"} htmlFor="i-vendor" error={fe.vendorId} required><Select id="i-vendor" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}><option value="">{isReseller ? "Choose a reseller" : "Choose a vendor"}</option>{vendors.filter((v) => (v.kind === "RESELLER") === isReseller).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>}
            {mode === "password" && (
              <>
                <Field label="Password" htmlFor="i-password" error={create.fieldErrors.password} required>
                  <div className="flex gap-2">
                    <Input id="i-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete="new-password" spellCheck={false} className="font-mono" maxLength={128} />
                    <Button size="sm" variant="secondary" onClick={() => setForm({ ...form, password: generatePassword() })} title="Generate a strong password"><RefreshCw className="h-4 w-4" aria-hidden /> Generate</Button>
                  </div>
                </Field>
                <PasswordChecklist password={form.password} email={form.email} name={form.name} />
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={form.mustChange} onChange={(e) => setForm({ ...form, mustChange: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-line" />
                  <span><span className="font-medium text-ink">Ask them to choose their own password at first sign-in</span><span className="block text-xs text-muted">Recommended, so only they know their password.</span></span>
                </label>
              </>
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" type="submit" loading={pending} disabled={mode === "password" && !pwOk}>{mode === "invite" ? "Send invite" : "Create user"}</Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
