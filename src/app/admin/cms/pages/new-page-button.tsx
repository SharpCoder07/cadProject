"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageMetaForm } from "./page-meta-form";

export function NewPageButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New page</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New page">
        <PageMetaForm defaults={{ title: "", slug: "", template: "DEFAULT", seo: { noIndex: false } }} onCreated={() => setOpen(false)} />
      </Dialog>
    </>
  );
}
