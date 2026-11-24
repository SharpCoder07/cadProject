"use client";

import { History } from "lucide-react";
import { useConfirm } from "@/components/ui/dialog";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { formatDateTime } from "@/lib/format";

export interface VersionRow { id: string; version: number; message: string | null; createdAt: string; author: string | null }
type Restore = (input: { revisionId: string }) => Promise<{ ok: true; data: undefined; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string[]> }>;

/** Saved versions of a menu or FAQ group, newest first, each with Restore (the current state stays as a version). */
export function VersionHistory({ title = "Version history", what, versions, restore, compact }: { title?: string; what: string; versions: VersionRow[]; restore: Restore; compact?: boolean }) {
  const run = useServerAction(restore);
  const [ask, dialog] = useConfirm();
  const list = (
    <ul className="max-h-72 divide-y divide-line overflow-y-auto">
      {versions.length === 0 && <li className="px-4 py-3 text-xs text-muted">Versions appear here after the next save.</li>}
      {versions.map((r, i) => (
        <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
          <span><span className="font-medium">v{r.version}</span>{i === 0 && <span className="ml-1 text-muted">(current)</span>} · {formatDateTime(r.createdAt)}<span className="block text-muted">{r.author ?? "System"}{r.message && ` · ${r.message}`}</span></span>
          {i > 0 && (
            <button type="button" className="shrink-0 text-primary hover:underline disabled:opacity-50" disabled={run.pending} onClick={async () => { if (await ask({ title: `Restore ${what} from version ${r.version}?`, message: "Items removed since then come back. The current state is kept as a version too, so you can switch back.", confirmLabel: "Restore", tone: "primary" })) void run.run({ revisionId: r.id }); }}>
              Restore
            </button>
          )}
        </li>
      ))}
    </ul>
  );
  if (compact) {
    return (
      <details className="rounded-panel border border-line">
        <summary className="flex cursor-pointer items-center gap-1.5 px-4 py-2.5 text-sm font-medium"><History className="h-4 w-4 text-muted" aria-hidden /> {title} <span className="text-xs text-muted">({versions.length})</span></summary>
        <div className="border-t border-line">{list}</div>
        {dialog}
      </details>
    );
  }
  return (
    <Panel>
      <PanelHeader title={title} description={`Every save of this ${what} is kept, so removed items can be brought back.`} />
      {list}
      {dialog}
    </Panel>
  );
}
