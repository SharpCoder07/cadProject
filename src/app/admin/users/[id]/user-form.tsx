"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { resendInviteAction, setUserStatusAction, updateUserAction } from "../actions";
import { isVendorRoleKey } from "@/server/rbac/permissions";

export function UserForm({ user, roles, vendors, isSelf, canChangeRole = true }: { /** Only the Super Admin changes roles (and so permissions). */ canChangeRole?: boolean; user: { id: string; name: string; email: string; roleId: string; vendorId: string | null; status: string }; roles: { id: string; name: string; key: string }[]; vendors: { id: string; name: string; kind: "VENDOR" | "RESELLER" }[]; isSelf: boolean }) {
  const [form, setForm] = useState({ name: user.name, roleId: user.roleId, vendorId: user.vendorId ?? "" });
  const [link, setLink] = useState<string | null>(null);
  const save = useServerAction(updateUserAction);
  const status = useServerAction(setUserStatusAction);
  const [confirm, confirmDialog] = useConfirm();
  const resend = useServerAction(resendInviteAction, { onSuccess: (d) => setLink(d.inviteLink) });
  const roleKey = roles.find((r) => r.id === form.roleId)?.key ?? "";
  const isVendor = isVendorRoleKey(roleKey);
  const isReseller = roleKey === "VENDOR_RESELLER";
  return (
    <div className="space-y-5">
      <form id={`user-form-${user.id}`} className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void save.run({ id: user.id, name: form.name, roleId: form.roleId, vendorId: isVendor ? form.vendorId || null : null }); }}>
        <Field label="Name" htmlFor="u-name" error={save.fieldErrors.name}><Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Email" htmlFor="u-email" hint="Email addresses can’t be changed; invite a new user instead."><Input id="u-email" value={user.email} disabled /></Field>
        <Field label="Role" htmlFor="u-role" hint={isSelf ? "You can’t change your own role." : "Changing the role signs the user out so new permissions apply."}>
          <Select id="u-role" value={form.roleId} disabled={isSelf || !canChangeRole} title={!canChangeRole ? "Only the Super Admin can change roles" : undefined} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select>
        </Field>
        {isVendor && <Field label={isReseller ? "Reseller" : "Vendor"} htmlFor="u-vendor"><Select id="u-vendor" value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })}><option value="">Choose…</option>{vendors.filter((v) => roleKey.startsWith("VENDOR_CUSTOM") || (v.kind === "RESELLER") === isReseller).map((v) => <option key={v.id} value={v.id}>{v.name}{v.kind === "RESELLER" ? " (reseller)" : ""}</option>)}</Select></Field>}
      </form>
      {/* Save and the account actions share one row. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button type="submit" form={`user-form-${user.id}`} size="sm" loading={save.pending}>Save user</Button>
        {user.status === "INVITED" && <Button size="sm" variant="secondary" loading={resend.pending} onClick={() => void resend.run({ id: user.id })}>Resend invitation</Button>}
        {!isSelf && user.status === "ACTIVE" && <Button size="sm" variant="danger" className="ml-auto" loading={status.pending} onClick={async () => { if (await confirm({ title: `Suspend ${user.name}?`, message: "They’ll be signed out immediately and can’t sign in until you reactivate the account.", confirmLabel: "Suspend" })) void status.run({ id: user.id, status: "SUSPENDED" }); }}>Suspend account</Button>}
        {!isSelf && user.status === "SUSPENDED" && <Button size="sm" variant="secondary" className="ml-auto" loading={status.pending} onClick={() => void status.run({ id: user.id, status: "ACTIVE" })}>Reactivate account</Button>}
      </div>
      {confirmDialog}
      {link && <Alert title="Email delivery isn’t configured">Share this one-time link: <code className="mt-1 block break-all text-xs">{link}</code></Alert>}
    </div>
  );
}
