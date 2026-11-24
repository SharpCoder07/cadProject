"use client";

import { useState } from "react";
import { RotateCcw, ShieldCheck, ShieldAlert } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useServerAction } from "@/components/admin/use-action";
import { resetTwoFactorAction } from "../actions";

export function TwoFactorAdmin({ userId, name, enabledAt, backupLeft, canReset }: { userId: string; name: string; enabledAt: string | null; backupLeft: number; canReset: boolean }) {
  const [open, setOpen] = useState(false);
  const reset = useServerAction(resetTwoFactorAction, { onSuccess: () => setOpen(false) });
  const on = Boolean(enabledAt);
  return (
    <div className="flex flex-wrap items-center gap-3 p-5">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${on ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
        {on ? <ShieldCheck className="h-5 w-5" aria-hidden /> : <ShieldAlert className="h-5 w-5" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="flex items-center gap-2 font-semibold text-ink">
          Authenticator app <Badge tone={on ? "success" : "warning"}>{on ? "On" : "Not set up"}</Badge>
        </p>
        <p className="text-muted">{on ? `Set up ${formatDate(enabledAt!)} · ${backupLeft} backup ${backupLeft === 1 ? "code" : "codes"} left` : "They'll be asked to set it up the next time they sign in."}</p>
      </div>
      {on && canReset && (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </Button>
      )}
      <ConfirmDialog open={open} onClose={() => setOpen(false)} onConfirm={() => void reset.run({ id: userId })} busy={reset.pending} title="Reset two-step verification?" confirmLabel="Reset and sign out">
        Use this when {name} has lost their phone and their backup codes. Their authenticator and backup codes stop working, they&apos;re signed out everywhere, and they&apos;ll set up a new authenticator the next time they sign in with their password.
      </ConfirmDialog>
    </div>
  );
}
