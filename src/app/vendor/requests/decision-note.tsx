"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/** Small "i" button beside a decided request's status; the Super Admin's note opens in a popup. */
export function DecisionNote({ rejected, item, request, note, when }: { rejected: boolean; item: string; request: string; note: string; when: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={rejected ? "See why it was rejected" : "See the Super Admin's note"}
        aria-label={rejected ? `See why the request for ${item} was rejected` : `See the note on the request for ${item}`}
        className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full transition", rejected ? "bg-danger/10 text-danger hover:bg-danger/20" : "bg-ink/[0.06] text-muted hover:bg-ink/10 hover:text-ink")}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={rejected ? "Request rejected" : "Note from the Super Admin"} description={item} size="md">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted">Request</dt>
            <dd className="mt-0.5 text-ink">{request}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">{rejected ? "Reason" : "Note"}</dt>
            <dd className="mt-1 whitespace-pre-line rounded-control bg-bg px-3 py-2.5 text-ink">{note}</dd>
          </div>
          {when && (
            <div>
              <dt className="text-xs font-medium text-muted">{rejected ? "Rejected on" : "Decided on"}</dt>
              <dd className="mt-0.5 text-ink">{when}</dd>
            </div>
          )}
        </dl>
        <div className="mt-5 flex justify-end border-t border-line pt-4">
          <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Close</Button>
        </div>
      </Dialog>
    </>
  );
}
