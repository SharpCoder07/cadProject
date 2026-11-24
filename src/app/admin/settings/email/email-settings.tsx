"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Eye, PlugZap, RotateCcw, Send } from "lucide-react";
import { TEMPLATES, fillTokens, wrapEmail, type TemplateKey } from "@/server/email/templates";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Alert, Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { resetTemplateAction, saveNotificationsAction, saveSmtpAction, saveTemplateAction, sendTestAction, testSmtpAction } from "./actions";
import { useConfirm } from "@/components/ui/dialog";

type Encryption = "ssl" | "starttls" | "none";
export interface SmtpView {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  encryption: Encryption;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  hasPassword: boolean;
  passwordReadable: boolean;
}

const DEFAULT_PORT: Record<Encryption, number> = { ssl: 465, starttls: 587, none: 25 };

/** A card row with a label, hint and a switch on the right. */
function ToggleRow({ label, hint, checked, onChange, disabled }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="px-4 py-3.5">
      <Switch label={<span className="font-medium">{label}</span>} hint={hint} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export function SmtpForm({ initial, envDriver }: { initial: SmtpView; envDriver: string }) {
  const [f, setF] = useState({ ...initial, password: "", clearPassword: false });
  const save = useServerAction(saveSmtpAction, { onSuccess: () => setF((x) => ({ ...x, password: "", hasPassword: x.clearPassword ? false : x.hasPassword || Boolean(x.password), clearPassword: false })) });
  const test = useServerAction(testSmtpAction, { refresh: false });
  const err = (k: string) => save.fieldErrors[k]?.[0] ?? test.fieldErrors[k]?.[0];
  const payload = () => ({ host: f.host, port: f.port, username: f.username, password: f.password, clearPassword: f.clearPassword, encryption: f.encryption, fromName: f.fromName, fromAddress: f.fromAddress, replyTo: f.replyTo, enabled: f.enabled });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Panel>
      <PanelHeader title="SMTP server" description="The password is encrypted before it's stored." />
      <form onSubmit={(e) => { e.preventDefault(); void save.run(payload()); }}>
        <div className="space-y-4 p-5">
          {!initial.host && envDriver !== "console" && <Alert tone="info">Email currently goes through the server&apos;s environment settings ({envDriver}). Saving a host here takes over from them.</Alert>}
          {initial.hasPassword && !initial.passwordReadable && <Alert tone="warning" title="The stored password can't be read">The app&apos;s secret key changed since it was saved. Enter the password again.</Alert>}
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <Field label="Host" htmlFor="smtp-host" error={err("host")}><Input id="smtp-host" value={f.host} onChange={(e) => set("host", e.target.value)} placeholder="smtp.yourprovider.com" autoComplete="off" /></Field>
            <Field label="Port" htmlFor="smtp-port" error={err("port")}><Input id="smtp-port" type="number" min={1} max={65535} value={f.port} onChange={(e) => set("port", Number(e.target.value))} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Username" htmlFor="smtp-user" error={err("username")}><Input id="smtp-user" value={f.username} onChange={(e) => set("username", e.target.value)} placeholder="enquiry@yourcompany.in" autoComplete="off" /></Field>
            <Field
              label="Password"
              htmlFor="smtp-pass"
              hint={f.clearPassword ? "The stored password will be removed when you save." : initial.hasPassword ? "A password is stored. Leave blank to keep it." : "For Gmail or Google Workspace, use an app password."}
            >
              <Input id="smtp-pass" type="password" value={f.password} onChange={(e) => setF((x) => ({ ...x, password: e.target.value, clearPassword: false }))} placeholder={initial.hasPassword && !f.clearPassword ? "••••••••" : ""} autoComplete="new-password" />
            </Field>
          </div>
          {initial.hasPassword && !f.password && (
            <label className="-mt-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" className="h-3.5 w-3.5 rounded border-line" checked={f.clearPassword} onChange={(e) => set("clearPassword", e.target.checked)} /> Remove the stored password</label>
          )}
          <Field label="Encryption" htmlFor="smtp-enc">
            <Select id="smtp-enc" value={f.encryption} onChange={(e) => { const enc = e.target.value as Encryption; setF((x) => ({ ...x, encryption: enc, port: Object.values(DEFAULT_PORT).includes(x.port) ? DEFAULT_PORT[enc] : x.port })); }}>
              <option value="ssl">SSL/TLS (usually port 465)</option>
              <option value="starttls">STARTTLS (usually port 587)</option>
              <option value="none">None (usually port 25, not recommended)</option>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From name" htmlFor="smtp-from-name" error={err("fromName")} required><Input id="smtp-from-name" value={f.fromName} onChange={(e) => set("fromName", e.target.value)} placeholder="Cadgram Enquiry" /></Field>
            <Field label="From address" htmlFor="smtp-from" error={err("fromAddress")} hint="Leave blank to use the username."><Input id="smtp-from" type="email" value={f.fromAddress} onChange={(e) => set("fromAddress", e.target.value)} placeholder="enquiry@yourcompany.in" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Reply-to" htmlFor="smtp-reply" error={err("replyTo")} hint="Lead notifications already reply to the lead's own address."><Input id="smtp-reply" type="email" value={f.replyTo} onChange={(e) => set("replyTo", e.target.value)} /></Field>
          </div>
          <div className="rounded-xl ring-1 ring-line">
            <ToggleRow label="Send email using these settings" hint="When off, nothing is sent. Useful while you're still setting up." checked={f.enabled} onChange={(v) => set("enabled", v)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4">
          <Button size="sm" variant="secondary" loading={test.pending} onClick={() => void test.run(payload())}><PlugZap className="h-4 w-4" aria-hidden /> Test connection</Button>
          <Button size="sm" type="submit" loading={save.pending}>Save email settings</Button>
        </div>
      </form>
    </Panel>
  );
}

export function NotificationsForm({ initial, canEdit }: { initial: { notifyEmails: string[]; emailSalesOnNewLead: boolean; emailAssignee: boolean; emailConfirmation: boolean; notifyVendor: boolean; notifyResellers: boolean }; canEdit: boolean }) {
  const [f, setF] = useState({ ...initial, notifyEmails: initial.notifyEmails.join(", ") });
  const save = useServerAction(saveNotificationsAction);
  return (
    <Panel>
      <PanelHeader title="Notifications" description="Who hears about new activity." />
      <form className="space-y-4 p-5" onSubmit={(e) => { e.preventDefault(); void save.run(f); }}>
        <fieldset disabled={!canEdit} className="space-y-4">
          <Field label="Sales notification addresses" htmlFor="n-emails" error={save.fieldErrors.notifyEmails?.[0]} hint="Comma separated. These receive every new lead.">
            <Input id="n-emails" value={f.notifyEmails} onChange={(e) => setF({ ...f, notifyEmails: e.target.value })} placeholder="sales@yourcompany.in, ops@yourcompany.in" />
          </Field>
          <div className="divide-y divide-line rounded-xl ring-1 ring-line">
            <ToggleRow label="Email sales when a lead is captured" checked={f.emailSalesOnNewLead} onChange={(v) => setF({ ...f, emailSalesOnNewLead: v })} />
            <ToggleRow label="Email a staff member when a lead is assigned to them" hint="Not sent when you assign a lead to yourself." checked={f.emailAssignee} onChange={(v) => setF({ ...f, emailAssignee: v })} />
            <ToggleRow label="Send a confirmation to the person who enquired" hint="Uses the “Confirmation to the lead” template below." checked={f.emailConfirmation} onChange={(v) => setF({ ...f, emailConfirmation: v })} />
            <ToggleRow label="Email the vendor of the product" hint="Every enquiry is emailed to the vendor's company email. Buyer email and phone stay masked until the vendor has an active plan." checked={f.notifyVendor} onChange={(v) => setF({ ...f, notifyVendor: v })} />
            <ToggleRow label="Email every reseller of the product" hint="Sent to each reseller's company email (or their users who can see leads). The lead also appears in their portal, masked until they have a plan." checked={f.notifyResellers} onChange={(v) => setF({ ...f, notifyResellers: v })} />
          </div>
        </fieldset>
        {canEdit ? (
          <div className="flex justify-end"><Button size="sm" type="submit" loading={save.pending}>Save notifications</Button></div>
        ) : (
          <p className="text-xs text-muted">You need permission to change website settings to edit these.</p>
        )}
      </form>
    </Panel>
  );
}

export function SendTest({ defaultTo }: { defaultTo: string }) {
  const [to, setTo] = useState(defaultTo);
  const send = useServerAction(sendTestAction, { refresh: false });
  return (
    <Panel>
      <PanelHeader title="Send a test" description="Confirms the whole path end to end, using the saved settings." />
      <form className="flex flex-col gap-2 p-5 sm:flex-row" onSubmit={(e) => { e.preventDefault(); void send.run({ to }); }}>
        <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" aria-label="Send the test to" className="flex-1" />
        <Button size="sm" type="submit" loading={send.pending} disabled={!to}><Send className="h-4 w-4" aria-hidden /> Send test</Button>
      </form>
      {send.fieldErrors.to && <p className="px-5 pb-4 text-xs text-danger">{send.fieldErrors.to[0]}</p>}
    </Panel>
  );
}

export interface TemplateView {
  key: TemplateKey;
  name: string;
  recipients: string;
  tokens: string[];
  required: boolean;
  subject: string;
  html: string;
  active: boolean;
  customised: boolean;
}

function TemplateItem({ t, siteName }: { t: TemplateView; siteName: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [f, setF] = useState({ subject: t.subject, html: t.html, active: t.active });
  const save = useServerAction(saveTemplateAction);
  const reset = useServerAction(resetTemplateAction, { onSuccess: () => setF({ subject: TEMPLATES[t.key].subject, html: TEMPLATES[t.key].html, active: true }) });
  const [confirm, confirmDialog] = useConfirm();
  const dirty = f.subject !== t.subject || f.html !== t.html || f.active !== t.active;
  const sample = useMemo(() => ({ site_name: siteName, admin_url: "#", review_url: "#", requests_url: "#", invite_link: "#", reset_link: "#", lead_details: "<p style=\"color:#6b7280\">[Lead details table]</p>", note_block: "", reason_block: "", ...TEMPLATES[t.key].sample }), [siteName, t.key]);
  const previewHtml = useMemo(() => wrapEmail(fillTokens(f.html, sample, "html"), siteName), [f.html, sample, siteName]);
  const insert = (token: string) => setF((x) => ({ ...x, html: `${x.html}{{${token}}}` }));

  return (
    <div className="rounded-xl ring-1 ring-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-semibold">
            {t.name}
            {!t.active && <Badge>Off</Badge>}
            {t.customised && <Badge tone="primary">Edited</Badge>}
          </span>
          <span className="block truncate font-mono text-xs text-muted">{t.subject}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <form className="space-y-4 border-t border-line p-4" onSubmit={(e) => { e.preventDefault(); void save.run({ key: t.key, ...f }); }}>
          <p className="text-xs text-muted">Sent to: {t.recipients}</p>
          <Field label="Subject" htmlFor={`tpl-s-${t.key}`} error={save.fieldErrors.subject?.[0]}><Input id={`tpl-s-${t.key}`} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
          <Field label="Body (HTML)" htmlFor={`tpl-b-${t.key}`} error={save.fieldErrors.html?.[0]}>
            <Textarea id={`tpl-b-${t.key}`} rows={9} value={f.html} onChange={(e) => setF({ ...f, html: e.target.value })} className="font-mono text-xs leading-relaxed" spellCheck={false} />
          </Field>
          <div className="rounded-xl bg-bg p-3 ring-1 ring-line">
            <p className="text-xs font-semibold">Available tokens <span className="font-normal text-muted">(click to add to the body)</span></p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {t.tokens.map((tok) => (
                <button key={tok} type="button" onClick={() => insert(tok)} className="rounded-md bg-surface px-2 py-1 font-mono text-[11px] ring-1 ring-line hover:ring-ink/30">{`{{${tok}}}`}</button>
              ))}
            </div>
          </div>
          <div className="rounded-xl ring-1 ring-line">
            <ToggleRow
              label="Template is active"
              hint={t.required ? "Needed for signing in, so it can't be switched off." : "When off, this particular email is not sent."}
              checked={f.active}
              disabled={t.required}
              onChange={(v) => setF({ ...f, active: v })}
            />
          </div>
          {preview && (
            <div className="overflow-hidden rounded-xl ring-1 ring-line">
              <p className="border-b border-line bg-bg px-3 py-2 text-xs"><span className="text-muted">Subject:</span> <strong>{fillTokens(f.subject, sample, "text")}</strong></p>
              <iframe title={`${t.name} preview`} sandbox="" srcDoc={previewHtml} className="h-80 w-full bg-white" />
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {confirmDialog}
              <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)}><Eye className="h-3.5 w-3.5" aria-hidden /> {preview ? "Hide preview" : "Preview"}</Button>
              {t.customised && <Button size="sm" variant="ghost" loading={reset.pending} onClick={async () => { if (await confirm({ title: "Replace this template with the default text?", message: "Your changes to this email are lost.", confirmLabel: "Reset to default" })) void reset.run({ key: t.key }); }}><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset to default</Button>}
            </div>
            <Button size="sm" type="submit" loading={save.pending} disabled={!dirty}>Save template</Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function TemplatesList({ templates, siteName }: { templates: TemplateView[]; siteName: string }) {
  return (
    <Panel>
      <PanelHeader title="Templates" description="Tokens in double braces are replaced when the email is sent." />
      <div className="space-y-2.5 p-5">
        {templates.map((t) => <TemplateItem key={t.key} t={t} siteName={siteName} />)}
      </div>
    </Panel>
  );
}
