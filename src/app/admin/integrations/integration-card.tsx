"use client";

import { useState } from "react";
import { CheckCircle2, CircleDashed, KeyRound, Mail, Send, Slack, Webhook } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { Alert, Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import type { HookViews } from "@/server/integrations";
import { saveSlackAction, saveWebhookAction, testSlackAction, testWebhookAction } from "./actions";

function Status({ on, label }: { on: boolean; label?: string }) {
  return on ? <Badge tone="success"><CheckCircle2 className="h-3 w-3" aria-hidden /> {label ?? "On"}</Badge> : <Badge><CircleDashed className="h-3 w-3" aria-hidden /> {label ?? "Off"}</Badge>;
}

function Title({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted" aria-hidden />{children}</span>;
}

function Saved({ source, host }: { source: "admin" | "env" | "none"; host: string | null }) {
  if (source === "none") return null;
  return (
    <p className="text-xs text-muted">
      {source === "env" ? "Currently using the URL from the server's .env file" : "A URL is saved (encrypted)"}
      {host && <> · sends to <code className="rounded bg-ink/5 px-1.5 py-0.5">{host}</code></>}. Leave the field blank to keep it.
    </p>
  );
}

export function EmailCard({ mode }: { mode: "db" | "off" | "env-console" | "env" }) {
  const text = {
    db: "Sending through the SMTP server saved in Email settings.",
    off: "An SMTP server is saved but sending is switched off, so no emails go out.",
    "env-console": "Not set up yet. Emails are only printed in the server log, nothing is actually sent.",
    env: "Sending with the server's .env settings. Saving an SMTP server in Email settings takes over.",
  }[mode];
  return (
    <Panel>
      <PanelHeader title={<Title icon={Mail}>Email delivery</Title>} description="Lead alerts, invitations, password resets and verification emails." actions={<Status on={mode === "db" || mode === "env"} label={mode === "db" || mode === "env" ? "Sending" : "Not sending"} />} />
      <div className="space-y-4 p-5 text-sm">
        {mode === "env-console" || mode === "off" ? <Alert tone="warning">{text}</Alert> : <p className="text-muted">{text}</p>}
        <div className="flex justify-end border-t border-line pt-4">
          <ButtonLink size="sm" href="/admin/settings/email" variant={mode === "db" ? "secondary" : "primary"}>{mode === "db" ? "Open email settings" : "Set up email"}</ButtonLink>
        </div>
      </div>
    </Panel>
  );
}

const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");

export function WebhookCard({ view }: { view: HookViews["webhook"] }) {
  const [f, setF] = useState({ isEnabled: view.isEnabled, includeMessage: view.includeMessage, url: "", secret: "", clearSecret: false });
  const save = useServerAction(saveWebhookAction, { onSuccess: () => setF((x) => ({ ...x, url: "", secret: "", clearSecret: false })) });
  const test = useServerAction(testWebhookAction, { refresh: false });
  const err = (k: string) => save.fieldErrors[k]?.[0] ?? test.fieldErrors[k]?.[0];
  return (
    <Panel>
      <PanelHeader title={<Title icon={Webhook}>Lead webhook</Title>} description="Sends every new lead to your CRM or automation tool (Zoho, HubSpot, Zapier, Make, n8n…)." actions={<Status on={view.isEnabled && view.source !== "none"} />} />
      <form className="space-y-4 p-5 text-sm" onSubmit={(e) => { e.preventDefault(); void save.run(f); }}>
        {view.unreadable && <Alert tone="warning">The saved URL can&apos;t be read because the app&apos;s secret key changed. Enter it again.</Alert>}
        <Field label="Webhook URL" htmlFor="wh-url" error={err("url")} hint="The address your CRM or automation tool gives you for receiving data.">
          <Input id="wh-url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder={view.source === "none" ? "https://hooks.zapier.com/hooks/catch/…" : "•••••••• (saved)"} autoComplete="off" spellCheck={false} />
        </Field>
        <Saved source={view.source} host={view.host} />
        <Field
          label="Signing secret (optional)"
          htmlFor="wh-secret"
          error={err("secret")}
          hint={f.secret ? "Copy this now and paste it in your receiving tool. It won't be shown again after saving." : view.hasSecret && !f.clearSecret ? "A secret is saved. Leave blank to keep it." : "Each lead is signed with this (X-Cadgram-Signature header) so the receiver can check it came from Cadgram."}
        >
          <div className="flex gap-2">
            <Input id="wh-secret" value={f.secret} onChange={(e) => setF({ ...f, secret: e.target.value, clearSecret: false })} placeholder={view.hasSecret && !f.clearSecret ? "••••••••" : ""} autoComplete="off" spellCheck={false} className="flex-1 font-mono text-xs" />
            <Button size="sm" variant="secondary" onClick={() => setF({ ...f, secret: randomSecret(), clearSecret: false })}><KeyRound className="h-4 w-4" aria-hidden /> Generate</Button>
          </div>
        </Field>
        {view.hasSecret && !f.secret && (
          <label className="-mt-2 flex items-center gap-2 text-xs text-muted"><input type="checkbox" className="h-3.5 w-3.5 rounded border-line" checked={f.clearSecret} onChange={(e) => setF({ ...f, clearSecret: e.target.checked })} /> Remove the saved secret</label>
        )}
        <div className="divide-y divide-line rounded-xl ring-1 ring-line">
          <div className="px-4 py-3.5"><Switch label={<span className="font-medium">Include the visitor&apos;s message</span>} hint="Turn off to keep the free-text message inside Cadgram." checked={f.includeMessage} onChange={(e) => setF({ ...f, includeMessage: e.target.checked })} /></div>
          <div className="px-4 py-3.5"><Switch label={<span className="font-medium">Send new leads to this webhook</span>} checked={f.isEnabled} onChange={(e) => setF({ ...f, isEnabled: e.target.checked })} /></div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button size="sm" variant="secondary" loading={test.pending} onClick={() => void test.run(f)}><Send className="h-4 w-4" aria-hidden /> Send test lead</Button>
          <Button size="sm" type="submit" loading={save.pending}>Save</Button>
        </div>
      </form>
    </Panel>
  );
}

export function SlackCard({ view }: { view: HookViews["slack"] }) {
  const [f, setF] = useState({ isEnabled: view.isEnabled, mention: view.mention, url: "" });
  const save = useServerAction(saveSlackAction, { onSuccess: () => setF((x) => ({ ...x, url: "" })) });
  const test = useServerAction(testSlackAction, { refresh: false });
  const err = (k: string) => save.fieldErrors[k]?.[0] ?? test.fieldErrors[k]?.[0];
  return (
    <Panel>
      <PanelHeader title={<Title icon={Slack}>Slack lead alerts</Title>} description="Posts a short message in a Slack channel for every new lead." actions={<Status on={view.isEnabled && view.source !== "none"} />} />
      <form className="space-y-4 p-5 text-sm" onSubmit={(e) => { e.preventDefault(); void save.run(f); }}>
        {view.unreadable && <Alert tone="warning">The saved URL can&apos;t be read because the app&apos;s secret key changed. Enter it again.</Alert>}
        <Field
          label="Slack webhook URL"
          htmlFor="sl-url"
          error={err("url")}
          hint={<>In Slack: <b>Apps → Incoming Webhooks → Add to Slack</b>, pick a channel (e.g. #leads) and copy the Webhook URL.</>}
        >
          <Input id="sl-url" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder={view.source === "none" ? "https://hooks.slack.com/services/…" : "•••••••• (saved)"} autoComplete="off" spellCheck={false} />
        </Field>
        <Saved source={view.source} host={view.host} />
        <Field label="Mention on high-priority leads (optional)" htmlFor="sl-mention" error={err("mention")} hint="<!channel> notifies everyone in the channel, <!here> only people online, or a person as <@U123ABC>.">
          <Input id="sl-mention" value={f.mention} onChange={(e) => setF({ ...f, mention: e.target.value })} placeholder="<!channel>" autoComplete="off" spellCheck={false} />
        </Field>
        <div className="rounded-xl px-4 py-3.5 ring-1 ring-line"><Switch label={<span className="font-medium">Post new leads to Slack</span>} checked={f.isEnabled} onChange={(e) => setF({ ...f, isEnabled: e.target.checked })} /></div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          <Button size="sm" variant="secondary" loading={test.pending} onClick={() => void test.run(f)}><Send className="h-4 w-4" aria-hidden /> Send test message</Button>
          <Button size="sm" type="submit" loading={save.pending}>Save</Button>
        </div>
      </form>
    </Panel>
  );
}
