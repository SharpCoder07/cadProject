"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { verifyVendorAction } from "./actions";

type V = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export function VerificationPanel({ id, verification, canPublish, allowed }: { id: string; verification: V; canPublish: boolean; allowed: boolean }) {
  const [v, setV] = useState<V>(verification);
  void canPublish; // legacy flag: vendors never publish without approval
  const save = useServerAction(verifyVendorAction);
  return (
    <div className="space-y-3 p-4 text-sm">
      <Select value={v} onChange={(e) => setV(e.target.value as V)} disabled={!allowed} aria-label="Verification status">
        <option value="UNVERIFIED">Unverified</option><option value="PENDING">Pending review</option><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option>
      </Select>
      <p className="text-xs text-muted">Verified vendors get a badge on their products. Every vendor change still needs Super Admin approval.</p>
      {allowed ? <Button size="sm" loading={save.pending} onClick={() => void save.run({ id, verification: v, canPublish: false })}>Update verification</Button> : <p className="text-xs text-muted">You need the “verify vendors” permission to change this.</p>}
    </div>
  );
}
