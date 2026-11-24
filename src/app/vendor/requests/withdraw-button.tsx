"use client";

import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/admin/use-action";
import { cancelRequestAction } from "../actions";
import { useConfirm } from "@/components/ui/dialog";

export function WithdrawButton({ id }: { id: string }) {
  const cancel = useServerAction(cancelRequestAction);
  const [confirm, confirmDialog] = useConfirm();
  return (
    <>
    {confirmDialog}
    <Button size="sm" variant="secondary" loading={cancel.pending} onClick={async () => { if (await confirm({ title: "Withdraw this request?", message: "Nothing will change on the website.", confirmLabel: "Withdraw" })) void cancel.run({ id }); }}>
      Withdraw
    </Button>
    </>
  );
}
