"use client";

import { useState } from "react";
import { Info, KeyRound, Pencil, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { PERMISSIONS, SYSTEM_ROLES, grantableFor, vendorPermissionLabel as permissionLabel, type Permission } from "@/server/rbac/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm, usePrompt } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { proposeAccessAction, proposeInviteAction, proposeRemovalAction, proposeResetAction } from "../actions";

type Kind = "VENDOR" | "RESELLER";
const VENDOR_PRESETS = (["VENDOR", "VENDOR_EDITOR", "VENDOR_VIEWER"] as const).map((k) => ({ key: k as string, name: SYSTEM_ROLES[k].name, perms: SYSTEM_ROLES[k].permissions }));
const RESELLER_PRESETS: { key: string; name: string; perms: readonly Permission[] }[] = [
  { key: "VENDOR_RESELLER", name: "Reseller Admin", perms: SYSTEM_ROLES.VENDOR_RESELLER.permissions },
  { key: "leads", name: "Sales (leads only)", perms: ["vendor.portal", "vendor.leads"] },
  { key: "catalogue", name: "Catalogue (products only)", perms: ["vendor.portal", "vendor.authorised", "media.manage", "media.create"] },
];
const PRESETS: Record<Kind, typeof RESELLER_PRESETS> = { VENDOR: VENDOR_PRESETS, RESELLER: RESELLER_PRESETS };
const CHOOSABLE: Record<Kind, Permission[]> = {
  VENDOR: grantableFor("VENDOR").filter((p) => p !== "vendor.portal"),
  RESELLER: grantableFor("RESELLER").filter((p) => p !== "vendor.portal"),
};
const DEFAULT_PERMS: Record<Kind, Permission[]> = { VENDOR: [...SYSTEM_ROLES.VENDOR_EDITOR.permissions], RESELLER: ["vendor.portal", "vendor.leads"] };

/** Preset roles plus individual permissions. Portal access is always included. */
export function PermissionPicker({ value, onChange, kind = "VENDOR" }: { value: Permission[]; onChange: (v: Permission[]) => void; kind?: Kind }) {
  const set = new Set(value);
  const same = (perms: readonly Permission[]) => perms.filter((p) => p !== "vendor.portal").sort().join() === value.filter((p) => p !== "vendor.portal").sort().join();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS[kind].map((r) => (
          <button key={r.key} type="button" onClick={() => onChange([...r.perms])} className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", same(r.perms) ? "bg-action text-action-fg ring-action" : "bg-surface text-ink ring-line hover:ring-ink/30")}>
            {r.name}
          </button>
        ))}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {CHOOSABLE[kind].map((p) => (
          <li key={p}>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 ring-1 ring-line hover:bg-bg">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line text-primary" checked={set.has(p)} onChange={(e) => onChange(e.target.checked ? [...value, p] : value.filter((x) => x !== p))} />
              <span className="text-sm">
                <span className="block font-medium">{permissionLabel(p)}</span>
                <span className="block text-xs text-muted">{PERMISSIONS[p]}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InviteButton({ kind = "VENDOR" }: { kind?: Kind }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", permissions: DEFAULT_PERMS[kind], note: "" });
  const invite = useServerAction(proposeInviteAction, { onSuccess: () => { setOpen(false); setForm({ name: "", email: "", permissions: DEFAULT_PERMS[kind], note: "" }); } });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" aria-hidden /> Add a user</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add a user" description="The Super Admin approves the invitation; then they get an email to set their password." size="lg">
        <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void invite.run({ ...form, note: form.note || null }); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="t-name" error={invite.fieldErrors.name} required><Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Work email" htmlFor="t-email" error={invite.fieldErrors.email} required><Input id="t-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          </div>
          <Field label="What they can do"><PermissionPicker kind={kind} value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} /></Field>
          <Field label="Note for the Super Admin (optional)" htmlFor="t-note"><Textarea id="t-note" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" type="submit" loading={invite.pending}>Send for approval</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function MemberActions({ id, name, permissions, isSelf, canReset, kind = "VENDOR" }: { id: string; name: string; permissions: Permission[]; isSelf: boolean; canReset: boolean; kind?: Kind }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name, permissions, note: "" });
  const access = useServerAction(proposeAccessAction, { onSuccess: () => setOpen(false) });
  const reset = useServerAction(proposeResetAction);
  const remove = useServerAction(proposeRemovalAction);
  const [confirm, confirmDialog] = useConfirm();
  const [ask, promptDialog] = usePrompt();
  return (
    <div className="flex flex-nowrap justify-end gap-1.5">
      {confirmDialog}
      {promptDialog}
      <Button size="sm" variant="secondary" className="w-8 px-0" aria-label={`Edit access for ${name}`} title="Edit name and access" onClick={() => { setForm({ name, permissions, note: "" }); setOpen(true); }}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
      {canReset && <Button size="sm" variant="secondary" className="w-8 px-0" aria-label={`Reset password for ${name}`} loading={reset.pending} title="Request a password reset link (after approval)" onClick={async () => { if (await confirm({ title: `Request a password reset link for ${name}?`, message: "After the Super Admin approves it, they get an email to set a new password.", confirmLabel: "Request reset", tone: "primary" })) void reset.run({ id }); }}>{!reset.pending && <KeyRound className="h-3.5 w-3.5" aria-hidden />}</Button>}
      {!isSelf && (
        <Button size="sm" variant="secondary" className="w-8 px-0 text-danger hover:border-danger/40 hover:bg-danger/5" aria-label={`Remove ${name}`} title="Request removal" loading={remove.pending} onClick={async () => { const note = await ask({ title: `Request removal of ${name}?`, message: "They'll lose access once the Super Admin approves it.", label: "Reason (optional)", placeholder: "e.g. Left the company", multiline: true, confirmLabel: "Request removal", tone: "danger" }); if (note !== null) void remove.run({ id, note: note.trim() || null }); }}>
          {!remove.pending && <Trash2 className="h-3.5 w-3.5" aria-hidden />}
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={`Edit ${name}`} description="Changes apply after the Super Admin approves them." size="lg">
        <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void access.run({ id, name: form.name, permissions: form.permissions, note: form.note || null }); }}>
          <Field label="Full name" htmlFor={`m-name-${id}`} error={access.fieldErrors.name} required><Input id={`m-name-${id}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="What they can do"><PermissionPicker kind={kind} value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} /></Field>
          {isSelf && !form.permissions.includes("vendor.team.manage") && <p className="text-sm text-warning">You&apos;re removing your own team-management access.</p>}
          <Field label="Note for the Super Admin (optional)" htmlFor={`m-note-${id}`}><Textarea id={`m-note-${id}`} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" type="submit" loading={access.pending}>Send for approval</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

const CHANGE_LABEL: Record<string, string> = { CREATE: "Adding this user", UPDATE: "Change to name or access", DELETE: "Removing this user", PASSWORD: "Password reset", PUBLISH: "Change", UNPUBLISH: "Change" };

/** Small red "i" button next to the status when the last change was rejected; the reason opens in a popup. */
export function RejectedChange({ name, action, note, when }: { name: string; action: string; note: string | null; when: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Last change was rejected. Click to see why." aria-label={`Last change for ${name} was rejected. See why`} className="grid h-6 w-6 place-items-center rounded-full bg-danger/10 text-danger transition hover:bg-danger/20">
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Change rejected" description={`The Super Admin rejected a change for ${name}.`} size="md">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted">What was requested</dt>
            <dd className="mt-0.5 text-ink">{CHANGE_LABEL[action] ?? "Change"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Reason</dt>
            <dd className="mt-1 whitespace-pre-line rounded-control bg-bg px-3 py-2.5 text-ink">{note || "No reason was given."}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Rejected on</dt>
            <dd className="mt-0.5 text-ink">{when}</dd>
          </div>
        </dl>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
          <Link href="/vendor/requests?status=REJECTED" className="text-sm font-medium text-primary hover:underline">See all rejected requests</Link>
          <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Dialog>
    </>
  );
}
