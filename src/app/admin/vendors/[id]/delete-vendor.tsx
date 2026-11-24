"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useServerAction } from "@/components/admin/use-action";
import { deleteVendorAction } from "../actions";

export function DeleteVendor({ id, reseller = false }: { id: string; reseller?: boolean }) {
  const noun = reseller ? "reseller" : "vendor";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const del = useServerAction(deleteVendorAction, { onSuccess: () => router.push(reseller ? "/admin/resellers" : "/admin/vendors") });
  return (
    <>
      <div className="admin-card flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">Delete {noun}</p>
          <p className="text-xs text-muted">Moves it to the recycle bin.</p>
        </div>
        <Button variant="danger" size="sm" className="shrink-0" onClick={() => setOpen(true)}>Delete</Button>
      </div>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={`Delete this ${noun}?`} confirmLabel="Delete" recycleBin busy={del.pending} onConfirm={() => void del.run({ id })}>
        {reseller ? "Resellers with portal users can’t be deleted. Remove their users first. Leads forwarded to them stay in the leads list." : "Vendors with products or portal users can’t be deleted. Reassign them first."}
      </ConfirmDialog>
    </>
  );
}
