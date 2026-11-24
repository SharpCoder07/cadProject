"use client";

import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/validation/leads";
import { BulkBar } from "@/components/admin/bulk-table";
import { useServerAction } from "@/components/admin/use-action";
import { bulkLeadAction } from "./actions";

export function LeadBulk({ staff }: { staff: { id: string; name: string }[] }) {
  const bulk = useServerAction(bulkLeadAction);
  return (
    <BulkBar>
      {(ids, clear) => (
        <>
          <select className="h-8 rounded-control border border-line bg-surface px-2 text-sm" defaultValue="" disabled={bulk.pending} aria-label="Set status"
            onChange={(e) => { const v = e.target.value as (typeof LEAD_STATUSES)[number]; e.target.value = ""; if (v) void bulk.run({ ids, status: v }).then((r) => r.ok && clear()); }}>
            <option value="" disabled>Set status…</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
          </select>
          <select className="h-8 rounded-control border border-line bg-surface px-2 text-sm" defaultValue="" disabled={bulk.pending} aria-label="Assign to"
            onChange={(e) => { const v = e.target.value; e.target.value = ""; if (v) void bulk.run({ ids, assignedToId: v === "none" ? null : v }).then((r) => r.ok && clear()); }}>
            <option value="" disabled>Assign to…</option>
            <option value="none">Unassigned</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </>
      )}
    </BulkBar>
  );
}
