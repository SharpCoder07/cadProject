"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Cloud, HardDrive, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert, Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import type { StorageAdminView } from "@/server/storage/admin";
import { copyStorageBatchAction, finishStorageMoveAction, saveAzureAction, setActiveStorageAction, testAzureAction } from "./storage-actions";

type Driver = "local" | "azure";
const LABEL: Record<Driver, string> = { local: "Local storage", azure: "Azure Blob Storage" };

type Move = { from: Driver; to: Driver; phase: "confirm" | "copy" | "links" | "done" | "error"; copied: number; failed: string[]; rows?: number };

export function StoragePanel({ view }: { view: StorageAdminView }) {
  const active = view.active === "azure" ? "azure" : "local";
  return (
    <Panel className="xl:col-span-2">
      <PanelHeader
        title="Media storage"
        description="Where uploaded images and documents are saved."
        actions={<Badge tone="success"><CheckCircle2 className="h-3 w-3" aria-hidden /> New uploads → {view.active === "s3" ? "S3 (environment)" : LABEL[active]}</Badge>}
      />
      <div className="space-y-6 p-5">
        {view.source === "env" && view.envDriver !== "local" && (
          <Alert tone="info">Storage is currently set by the server&apos;s environment variables ({view.envDriver}). Saving anything here takes over from them.</Alert>
        )}
        {view.production && active === "local" && (
          <Alert tone="warning" title="Local storage in production">Files are saved on this server&apos;s disk. If your host replaces the disk on each deploy (most cloud and serverless hosts do), uploads will be lost. Use Azure Blob Storage instead.</Alert>
        )}
        <ActiveChoice view={view} active={active} />
        <AzureForm view={view} />
        <MoveFiles view={view} active={active} />
      </div>
    </Panel>
  );
}

function ActiveChoice({ view, active }: { view: StorageAdminView; active: Driver }) {
  const set = useServerAction(setActiveStorageAction);
  const options: { key: Driver; icon: typeof HardDrive; text: string; disabled?: string }[] = [
    { key: "local", icon: HardDrive, text: "Saved in public/uploads on this server. Good for development or a single server with a permanent disk." },
    { key: "azure", icon: Cloud, text: "Saved in your Azure storage account and served from Azure (or your CDN). Survives redeploys and scales with traffic.", disabled: view.azureReady ? undefined : "Connect Azure below first" },
  ];
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">Where new uploads go</h3>
      <p className="mt-0.5 text-xs text-muted">Switching only affects new uploads. To move files you already have, use “Move existing files” below.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const on = active === o.key;
          return (
            <div key={o.key} className={cn("flex flex-col rounded-xl p-4 ring-1", on ? "bg-mint-soft ring-mint" : "ring-line")}>
              <div className="flex items-center gap-2">
                <o.icon className={cn("h-4 w-4", on ? "text-mint-ink" : "text-muted")} aria-hidden />
                <span className="text-sm font-semibold text-ink">{LABEL[o.key]}</span>
                {on && <Badge tone="success" className="ml-auto">In use</Badge>}
              </div>
              <p className="mt-1.5 flex-1 text-xs text-muted">{o.text}</p>
              {!on && (
                <div className="mt-3">
                  <Button variant="secondary" size="sm" disabled={Boolean(o.disabled)} loading={set.pending} onClick={() => void set.run({ driver: o.key })}>
                    {o.disabled ?? `Use ${LABEL[o.key].toLowerCase()}`}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AzureForm({ view }: { view: StorageAdminView }) {
  const [f, setF] = useState({ account: view.account, key: "", container: view.container, publicUrl: view.publicUrl });
  const [help, setHelp] = useState(!view.account);
  const save = useServerAction(saveAzureAction, { onSuccess: () => setF((x) => ({ ...x, key: "" })) });
  const test = useServerAction(testAzureAction, { refresh: false });
  const err = (k: string) => save.fieldErrors[k]?.[0] ?? test.fieldErrors[k]?.[0];
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <section className="rounded-xl ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <Cloud className="h-4 w-4 text-muted" aria-hidden />
        <h3 className="text-sm font-semibold text-ink">Azure Blob Storage connection</h3>
        {view.azureReady ? <Badge tone="success" className="ml-auto">Connected</Badge> : <Badge className="ml-auto">Not connected</Badge>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void save.run(f); }}>
        <div className="space-y-4 p-4">
          {view.hasKey && !view.keyReadable && <Alert tone="warning" title="The stored access key can't be read">The app&apos;s secret key changed since it was saved. Enter the access key again.</Alert>}
          <button type="button" onClick={() => setHelp(!help)} className="flex items-center gap-1 text-xs font-medium text-mint-ink">
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", help && "rotate-180")} aria-hidden /> Where do I find these?
          </button>
          {help && (
            <ol className="list-decimal space-y-1 rounded-lg bg-bg/60 px-8 py-3 text-xs text-muted">
              <li>In the Azure portal, create a <b className="text-ink">Storage account</b> (Standard performance; choose a region near your visitors, e.g. Central India).</li>
              <li>Open it → <b className="text-ink">Settings → Configuration</b> → set <b className="text-ink">Allow Blob anonymous access</b> to <b className="text-ink">Enabled</b> and save. This lets visitors see the images; nothing else becomes public.</li>
              <li>Open <b className="text-ink">Security + networking → Access keys</b>. Copy the <b className="text-ink">Storage account name</b> and <b className="text-ink">key1</b>.</li>
              <li>Leave the container as <b className="text-ink">uploads</b>; Cadgram creates it for you when you test.</li>
            </ol>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Storage account name" htmlFor="az-account" error={err("account")} required>
              <Input id="az-account" value={f.account} onChange={(e) => set("account", e.target.value)} placeholder="cadgrammedia" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Access key" htmlFor="az-key" error={err("key")} required hint={view.hasKey ? "A key is stored (encrypted). Leave blank to keep it." : "key1 or key2. Stored encrypted and never shown again."}>
              <Input id="az-key" type="password" value={f.key} onChange={(e) => set("key", e.target.value)} placeholder={view.hasKey ? "••••••••" : ""} autoComplete="new-password" spellCheck={false} />
            </Field>
            <Field label="Container" htmlFor="az-container" error={err("container")} required hint="Created automatically if it doesn't exist.">
              <Input id="az-container" value={f.container} onChange={(e) => set("container", e.target.value)} placeholder="uploads" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Public URL (optional)" htmlFor="az-url" error={err("publicUrl")} hint="Only if you put Azure CDN / Front Door or your own domain in front of the container.">
              <Input id="az-url" value={f.publicUrl} onChange={(e) => set("publicUrl", e.target.value)} placeholder="https://media.cadgram.com" autoComplete="off" spellCheck={false} />
            </Field>
          </div>
          {view.azureBaseUrl && <p className="text-xs text-muted">Files are served from <code className="rounded bg-ink/5 px-1.5 py-0.5">{view.azureBaseUrl}</code></p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-4 py-3">
          <Button size="sm" variant="secondary" loading={test.pending} onClick={() => void test.run(f)}><PlugZap className="h-4 w-4" aria-hidden /> Test connection</Button>
          <Button size="sm" type="submit" loading={save.pending}>Test &amp; save</Button>
        </div>
      </form>
    </section>
  );
}

function MoveFiles({ view, active }: { view: StorageAdminView; active: Driver }) {
  const [move, setMove] = useState<Move | null>(null);
  const copy = useServerAction(copyStorageBatchAction, { refresh: false });
  const finish = useServerAction(finishStorageMoveAction);
  const busy = move?.phase === "copy" || move?.phase === "links";
  const total = move?.from === "local" ? view.localFiles : null;
  const pct = move && total ? Math.min(100, Math.round((move.copied / Math.max(total, 1)) * 100)) : null;

  async function run(from: Driver, to: Driver) {
    let copied = 0;
    const failed: string[] = [];
    let cursor: string | null = null;
    setMove({ from, to, phase: "copy", copied, failed });
    do {
      const res = await copy.run({ from, to, cursor });
      if (!res.ok) return setMove({ from, to, phase: "error", copied, failed });
      copied += res.data.copied;
      failed.push(...res.data.failed);
      cursor = res.data.next;
      setMove({ from, to, phase: "copy", copied, failed: [...failed] });
    } while (cursor);
    if (failed.length) return setMove({ from, to, phase: "error", copied, failed });
    setMove({ from, to, phase: "links", copied, failed });
    const done = await finish.run({ from, to });
    setMove(done.ok ? { from, to, phase: "done", copied, failed, rows: done.data.rows } : { from, to, phase: "error", copied, failed });
  }

  const azureFiles = view.mediaByProvider.azure ?? 0;
  const localMedia = view.mediaByProvider.local ?? 0;
  const directions: { from: Driver; to: Driver }[] = [{ from: "local", to: "azure" }, { from: "azure", to: "local" }];

  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">Move existing files</h3>
      <p className="mt-0.5 text-xs text-muted">
        Copies every file to the other storage, updates every link on the site (products, logos, blog posts, pages, avatars…) and then sends new uploads there. The original files are kept, so you can switch back at any time.
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Files in local storage" value={view.localFiles} />
        <Stat label="Media library on local" value={localMedia} />
        <Stat label="Media library on Azure" value={azureFiles} />
      </dl>

      {move && move.phase !== "confirm" ? (
        <div className="mt-4 rounded-xl p-4 ring-1 ring-line">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {LABEL[move.from]} <ArrowRight className="h-4 w-4 text-muted" aria-hidden /> {LABEL[move.to]}
          </p>
          {(move.phase === "copy" || move.phase === "links") && (
            <>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/5">
                <div className={cn("h-full rounded-full bg-mint transition-all", pct === null && "animate-pulse")} style={{ width: `${move.phase === "links" ? 100 : pct ?? 60}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {move.phase === "copy" ? `Copying files… ${move.copied}${total ? ` of ${total}` : ""}` : "Updating links across the site…"} Keep this page open.
              </p>
            </>
          )}
          {move.phase === "done" && (
            <Alert tone="success" className="mt-3" title="All done">
              Copied {move.copied} file{move.copied === 1 ? "" : "s"} and updated {move.rows} record{move.rows === 1 ? "" : "s"}. New uploads now go to {LABEL[move.to].toLowerCase()}. Check a few product pages; the old files are still in {LABEL[move.from].toLowerCase()} if you need them.
            </Alert>
          )}
          {move.phase === "error" && (
            <Alert tone="danger" className="mt-3" title="Stopped before updating any links">
              {move.failed.length ? (
                <>
                  {move.failed.length} file{move.failed.length === 1 ? "" : "s"} couldn&apos;t be copied, so the site still uses {LABEL[move.from].toLowerCase()}:
                  <span className="mt-1 block font-mono text-[11px]">{move.failed.slice(0, 5).join(", ")}{move.failed.length > 5 ? ` and ${move.failed.length - 5} more` : ""}</span>
                </>
              ) : (
                <>Nothing on the site has changed. Fix the problem shown in the message and try again; files already copied are simply copied again.</>
              )}
            </Alert>
          )}
          {!busy && (
            <div className="mt-3 flex gap-2">
              {move.phase === "error" && <Button size="sm" onClick={() => void run(move.from, move.to)}>Try again</Button>}
              <Button size="sm" variant="secondary" onClick={() => setMove(null)}>Close</Button>
            </div>
          )}
        </div>
      ) : move?.phase === "confirm" ? (
        <div className="mt-4 rounded-xl bg-bg/60 p-4 ring-1 ring-line">
          <p className="text-sm text-ink">
            Copy {move.from === "local" ? `${view.localFiles} files` : "all files"} from {LABEL[move.from].toLowerCase()} to {LABEL[move.to].toLowerCase()}, update all links, and send new uploads to {LABEL[move.to].toLowerCase()}?
          </p>
          <p className="mt-1 text-xs text-muted">This can take a few minutes for large libraries. Avoid uploading files until it finishes.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => void run(move.from, move.to)}>Start moving</Button>
            <Button size="sm" variant="secondary" onClick={() => setMove(null)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {directions.map((d) => (
            <Button size="sm"
              key={d.from}
              variant={d.to !== active ? "primary" : "secondary"}
              disabled={!view.azureReady}
              onClick={() => setMove({ ...d, phase: "confirm", copied: 0, failed: [] })}
            >
              Move {d.from} files to {d.to === "azure" ? "Azure" : "local"}
            </Button>
          ))}
          {!view.azureReady && <p className="w-full text-xs text-muted">Connect Azure above to move files.</p>}
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl px-4 py-3 ring-1 ring-line">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}
