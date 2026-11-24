"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { setAutoResolveAction } from "./actions";

/** "Resolve automatically when an error hasn't happened again for N hours" (0 = off). */
export function AutoResolveControl({ hours, canManage }: { hours: number; canManage: boolean }) {
  const [value, setValue] = useState(String(hours));
  const run = useServerAction(setAutoResolveAction);
  const n = Math.max(0, Math.min(720, Math.round(Number(value) || 0)));
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
      <Timer className="h-4 w-4 shrink-0 text-[#0F766E] dark:text-teal-300" aria-hidden />
      <span className="text-ink">
        {hours ? <>Errors resolve themselves when they haven&apos;t happened again for <strong>{hours} hours</strong>.</> : <>Automatic resolving is <strong>off</strong>: errors stay pending until someone resolves them.</>}
        <span className="block text-xs text-muted">If a resolved error happens again, it goes back to Pending and is marked “happened again”.</span>
      </span>
      {canManage && (
        <span className="ml-auto flex items-center gap-2">
          <label htmlFor="auto-hours" className="text-muted">After</label>
          <Input id="auto-hours" type="number" min={0} max={720} value={value} onChange={(e) => setValue(e.target.value)} className="h-9 w-20" />
          <span className="text-muted">hours (0 = off)</span>
          <Button size="sm" variant="secondary" disabled={n === hours} loading={run.pending} onClick={() => void run.run({ hours: n })}>Save</Button>
        </span>
      )}
    </div>
  );
}
