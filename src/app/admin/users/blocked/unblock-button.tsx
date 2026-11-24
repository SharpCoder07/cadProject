"use client";

import { LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerAction } from "@/components/admin/use-action";
import { unblockEmailAction, unblockNetworkAction } from "../actions";

/** Row button: unblock one email (and its networks) or one network. */
export function UnblockButton({ id, kind }: { id: string; kind: "email" | "network" }) {
  const { run, pending } = useServerAction(kind === "email" ? unblockEmailAction : unblockNetworkAction);
  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={() => void run({ id })}>
      <LockOpen className="h-4 w-4" aria-hidden /> Unblock
    </Button>
  );
}
