"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import type { LEAD_SOURCES, LeadTypeKey } from "@/lib/validation/leads";
import { LeadForm, type LeadFormConfig } from "./lead-form";

interface OpenOptions {
  softwareSlugs?: string[];
  productName?: string;
  source?: (typeof LEAD_SOURCES)[number];
  /** What the buyer is asking for: a price quote, a demo, a purchase… */
  type?: LeadTypeKey;
  title?: string;
}

const LeadDialogContext = createContext<{ open: (o?: OpenOptions) => void } | null>(null);

/** One shared enquiry dialog for the whole public site. */
export function LeadDialogProvider({ children, config, title, subtitle }: { children: ReactNode; config: LeadFormConfig; title: string; subtitle: string }) {
  const [state, setState] = useState<OpenOptions | null>(null);
  const open = useCallback((o: OpenOptions = {}) => setState(o), []);
  return (
    <LeadDialogContext.Provider value={{ open }}>
      {children}
      <Dialog
        open={state !== null}
        onClose={() => setState(null)}
        title={state?.title ?? (state?.productName ? `${title}: ${state.productName}` : title)}
        description={subtitle}
        size="lg"
      >
        {state && <LeadForm config={config} softwareSlugs={state.softwareSlugs} source={state.source ?? "GET_ADVICE"} type={state.type} />}
      </Dialog>
    </LeadDialogContext.Provider>
  );
}

export function useLeadDialog() {
  const ctx = useContext(LeadDialogContext);
  if (!ctx) throw new Error("useLeadDialog must be used inside LeadDialogProvider");
  return ctx;
}

/** Button that opens the enquiry dialog; usable from server components. */
export function EnquireButton({ children, className, softwareSlugs, productName, source, type, title }: OpenOptions & { children: ReactNode; className?: string }) {
  const { open } = useLeadDialog();
  return (
    <button type="button" className={className} onClick={() => open({ softwareSlugs, productName, source, type, title })}>
      {children}
    </button>
  );
}
