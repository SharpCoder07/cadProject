"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, PlugZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/field";
import { Alert, Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { saveRazorpayAction, testRazorpayAction } from "@/app/admin/billing/actions";

interface Initial {
  enabled: boolean;
  keyId: string;
  mode: "live" | "test" | null;
  hasKeySecret: boolean;
  keySecretReadable: boolean;
  hasWebhookSecret: boolean;
}

export function RazorpayForm({ initial, webhookUrl }: { initial: Initial; webhookUrl: string }) {
  const [f, setF] = useState({ keyId: initial.keyId, keySecret: "", webhookSecret: "", enabled: initial.enabled });
  const [copied, setCopied] = useState(false);
  const save = useServerAction(saveRazorpayAction, { onSuccess: () => setF((x) => ({ ...x, keySecret: "", webhookSecret: "" })) });
  const test = useServerAction(testRazorpayAction, { refresh: false });
  const err = (k: string) => save.fieldErrors[k]?.[0] ?? test.fieldErrors[k]?.[0];
  const mode = f.keyId.startsWith("rzp_live_") ? "live" : f.keyId.startsWith("rzp_test_") ? "test" : null;

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          title="Razorpay"
          description="Find the keys in the Razorpay Dashboard → Account & Settings → API keys."
          actions={mode && <Badge tone={mode === "live" ? "success" : "warning"}>{mode === "live" ? "Live mode" : "Test mode"}</Badge>}
        />
        <form onSubmit={(e) => { e.preventDefault(); void save.run(f); }}>
          <div className="space-y-4 p-5">
            {initial.hasKeySecret && !initial.keySecretReadable && <Alert tone="warning" title="The stored key secret can't be read">The app&apos;s secret key changed since it was saved. Enter the key secret again.</Alert>}
            <Field label="Key ID" htmlFor="rp-key" error={err("keyId")} hint="Starts with rzp_test_ while you're testing, rzp_live_ when you take real payments.">
              <Input id="rp-key" value={f.keyId} onChange={(e) => setF({ ...f, keyId: e.target.value.trim() })} placeholder="rzp_live_xxxxxxxxxxxxxx" autoComplete="off" />
            </Field>
            <Field label="Key secret" htmlFor="rp-secret" error={err("keySecret")} hint={initial.hasKeySecret ? "A key secret is stored. Leave blank to keep it." : "Shown once in Razorpay when you generate the key."}>
              <Input id="rp-secret" type="password" value={f.keySecret} onChange={(e) => setF({ ...f, keySecret: e.target.value })} placeholder={initial.hasKeySecret ? "••••••••" : ""} autoComplete="new-password" />
            </Field>
            <div className="rounded-xl ring-1 ring-line">
              <div className="px-4 py-3.5">
                <Switch label={<span className="font-medium">Take payments from vendors</span>} hint="When off, vendors see the plans but can't pay online." checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t border-line p-5">
            <div>
              <p className="text-sm font-semibold text-ink">Webhook</p>
              <p className="mt-0.5 text-sm text-muted">Confirms payments even if a vendor closes the browser before returning. In Razorpay go to Account &amp; Settings → Webhooks → Add new webhook, and use:</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2">
              <code className="min-w-0 flex-1 truncate font-mono text-[13px]">{webhookUrl}</code>
              <button type="button" className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink" aria-label="Copy webhook URL" onClick={() => void navigator.clipboard.writeText(webhookUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-sm text-muted">Active events: <code className="text-ink">payment.captured</code> and <code className="text-ink">order.paid</code>. Choose a secret there and paste the same one below.</p>
            <Field label="Webhook secret" htmlFor="rp-wh" hint={initial.hasWebhookSecret ? "A webhook secret is stored. Leave blank to keep it." : "Without it, payments are only confirmed when the vendor returns from checkout."}>
              <Input id="rp-wh" type="password" value={f.webhookSecret} onChange={(e) => setF({ ...f, webhookSecret: e.target.value })} placeholder={initial.hasWebhookSecret ? "••••••••" : ""} autoComplete="new-password" />
            </Field>
            {webhookUrl.includes("localhost") && <Alert tone="info">Razorpay can&apos;t reach localhost. Webhooks start working once the site is on its public address (set APP_URL).</Alert>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4">
            <a href="https://dashboard.razorpay.com/app/keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
              Open Razorpay dashboard <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" loading={test.pending} onClick={() => void test.run(f)}><PlugZap className="h-4 w-4" aria-hidden /> Test connection</Button>
              <Button size="sm" type="submit" loading={save.pending}>Save payment settings</Button>
            </div>
          </div>
        </form>
      </Panel>
      <Alert tone="info" title="Good to know">
        Plans are one-time payments for a fixed period (no auto-debit); vendors renew by buying again, and an early renewal starts when the current plan ends. Make sure automatic capture is on in Razorpay (Account &amp; Settings → Payment capture) — the site also captures authorized payments itself. Refunds are made from the Razorpay dashboard.
      </Alert>
    </div>
  );
}
