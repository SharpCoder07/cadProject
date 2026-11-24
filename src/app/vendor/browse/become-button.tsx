"use client";

import { useState } from "react";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useServerAction } from "@/components/admin/use-action";
import { proposeAuthorisedAction } from "../authorised/actions";

/** “Become a reseller” for one product: optional partner level and note, then it goes to the Super Admin for approval. */
export function BecomeResellerButton({ softwareId, name, vendorName }: { softwareId: string; name: string; vendorName: string | null }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const run = useServerAction(proposeAuthorisedAction, { onSuccess: () => { setOpen(false); setLevel(""); setNote(""); } });
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Handshake className="h-4 w-4" aria-hidden /> Become a reseller</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Become a reseller of ${name}`} description="Our team checks every request before you're listed on the product page, usually within one business day.">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void run.run({ softwareId, partnerLevel: level.trim() || null, note: note.trim() || null }); }}>
          <Field label="Partner level (optional)" htmlFor={`bl-${softwareId}`} hint={`Your partnership tier with ${vendorName ?? "the vendor"}, e.g. Gold Partner. Shown next to your name.`}>
            <Input id={`bl-${softwareId}`} value={level} onChange={(e) => setLevel(e.target.value)} maxLength={60} placeholder="e.g. Gold Partner" />
          </Field>
          <Field label="Note for our team (optional)" htmlFor={`bn-${softwareId}`} hint="Certificate number, how long you've sold it, or anything that helps us approve it.">
            <Textarea id={`bn-${softwareId}`} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button size="sm" type="submit" loading={run.pending}>Send request</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
