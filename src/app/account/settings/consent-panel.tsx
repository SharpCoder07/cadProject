"use client";

import { useState } from "react";
import Link from "next/link";
import { Cookie, ShieldCheck } from "lucide-react";
import { useServerAction } from "@/components/admin/use-action";
import { setMyConsentAction } from "../actions";

export interface ConsentRow { key: string; name: string; description: string; isNecessary: boolean; granted: boolean; since: string | null }

/** Optional consents with on/off switches; necessary purposes are listed for information. */
export function ConsentPanel({ rows, labels }: { rows: ConsentRow[]; labels: { necessary: string; since: string; cookies: string } }) {
  const [state, setState] = useState(() => Object.fromEntries(rows.map((r) => [r.key, r.granted])) as Record<string, boolean>);
  const run = useServerAction(setMyConsentAction);
  const flip = async (key: string) => {
    const next = !state[key];
    setState((s) => ({ ...s, [key]: next }));
    const r = await run.run({ purposeKey: key, granted: next });
    if (!r.ok) setState((s) => ({ ...s, [key]: !next }));
  };
  return (
    <div className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.key} className="flex items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="font-medium text-ink">{r.name}</p>
            <p className="mt-0.5 text-sm text-muted">{r.description}</p>
            {!r.isNecessary && state[r.key] && r.since && <p className="mt-1 text-xs text-muted">{labels.since.replace("{date}", new Date(r.since).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))}</p>}
          </div>
          {r.isNecessary ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{labels.necessary}</span>
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={state[r.key]}
              aria-label={r.name}
              disabled={run.pending}
              onClick={() => void flip(r.key)}
              className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${state[r.key] ? "bg-primary" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${state[r.key] ? "left-[22px]" : "left-0.5"}`} />
            </button>
          )}
        </div>
      ))}
      <div className="px-5 py-4">
        <Link href="/#cookie-settings" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
          <Cookie className="h-4 w-4" aria-hidden />
          {labels.cookies}
        </Link>
      </div>
    </div>
  );
}
