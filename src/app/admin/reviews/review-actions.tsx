"use client";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { BulkBar } from "@/components/admin/bulk-table";
import { useServerAction } from "@/components/admin/use-action";
import { deleteReviewsAction, moderateAction } from "./actions";

export function ReviewBulk() {
  const mod = useServerAction(moderateAction);
  const del = useServerAction(deleteReviewsAction);
  const [ask, confirmDialog] = useConfirm();
  return (
    <BulkBar>
      {(ids, clear) => (
        <>
          <Button size="sm" loading={mod.pending} onClick={() => void mod.run({ ids, status: "APPROVED" }).then((r) => r.ok && clear())}>Approve</Button>
          <Button size="sm" variant="secondary" onClick={() => void mod.run({ ids, status: "REJECTED" }).then((r) => r.ok && clear())}>Reject</Button>
          <Button size="sm" variant="danger" onClick={() => void ask({ title: `Delete ${ids.length} ${ids.length === 1 ? "review" : "reviews"}?`, message: "They disappear from the product pages, and the products’ ratings are updated.", recycleBin: true }).then((yes) => yes && void del.run({ ids }).then((r) => r.ok && clear()))}>Delete</Button>
          {confirmDialog}
        </>
      )}
    </BulkBar>
  );
}

export function ReviewRowActions({ id, status }: { id: string; status: string }) {
  const mod = useServerAction(moderateAction);
  return (
    <div className="flex gap-1.5">
      {status !== "APPROVED" && <Button size="sm" loading={mod.pending} onClick={() => void mod.run({ ids: [id], status: "APPROVED" })}>Approve</Button>}
      {status !== "REJECTED" && <Button size="sm" variant="secondary" onClick={() => void mod.run({ ids: [id], status: "REJECTED" })}>Reject</Button>}
    </div>
  );
}
