"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Check, Eye, Lock, Mail, Phone, Sparkles } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PlansGrid, type PlanView } from "@/app/vendor/plans/plans-grid";
import { formatPhone } from "@/lib/countries";

/**
 * Masked buyer contact details for vendors and resellers without an active plan. The server only ever
 * sends masked values to these users; "View Now" opens the Buy Plan dialog rather than revealing anything.
 * With `billing`, the dialog lists the company's plans and takes payment right there (Razorpay).
 */

export interface UpgradeBilling {
  plans: PlanView[];
  canBuy: boolean;
  paymentsEnabled: boolean;
  hasActive: boolean;
}

const UpgradeContext = createContext<(() => void) | null>(null);

/** Wrap a page so every View Now button shares one Buy Plan dialog. */
export function UpgradeProvider({ children, billing }: { children: ReactNode; billing?: UpgradeBilling }) {
  const [open, setOpen] = useState(false);
  return (
    <UpgradeContext.Provider value={() => setOpen(true)}>
      {children}
      <UpgradeDialog open={open} onClose={() => setOpen(false)} billing={billing} />
    </UpgradeContext.Provider>
  );
}

const PERKS = ["Full email and phone for every lead", "Contact buyers directly, the same day", "Unlocks past and future leads"];

export function UpgradeDialog({ open, onClose, billing }: { open: boolean; onClose: () => void; billing?: UpgradeBilling }) {
  if (billing && billing.plans.length > 0) {
    return (
      <Dialog open={open} onClose={onClose} size="xl" title="Buy a plan to view this lead" description="Pay once and see the buyer's email and phone number on every lead, straight away.">
        <div className="space-y-4">
          <ul className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-xl bg-mint-soft px-4 py-3 text-sm text-ink">
            {PERKS.map((t) => (
              <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 shrink-0 text-mint-ink" aria-hidden />{t}</li>
            ))}
          </ul>
          {!billing.paymentsEnabled && <p className="rounded-xl bg-warning/10 px-4 py-2.5 text-sm text-ink">Online payment isn&apos;t available right now. Please contact us to subscribe.</p>}
          {!billing.canBuy && <p className="rounded-xl bg-ink/5 px-4 py-2.5 text-sm text-muted">Only your company admin can buy plans. Ask them to purchase one.</p>}
          <PlansGrid compact plans={billing.plans} canBuy={billing.canBuy} paymentsEnabled={billing.paymentsEnabled} hasActive={billing.hasActive} onPurchased={onClose} />
          <div className="flex justify-end">
            <Button size="sm" variant="ghost" onClick={onClose}>Maybe later</Button>
          </div>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} size="sm" title="Buy a plan to view this lead">
      <div className="space-y-4">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint-soft text-mint-ink">
          <Lock className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-center text-sm text-muted">Purchase a subscription plan to see the full email address and phone number of every buyer who enquires.</p>
        <ul className="space-y-1.5 rounded-xl bg-bg p-3 text-sm text-ink">
          {PERKS.map((t) => (
            <li key={t} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{t}</li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <ButtonLink size="sm" href="/vendor/plans" className="w-full justify-center">
            <Sparkles className="h-4 w-4" aria-hidden /> See plans
          </ButtonLink>
          <Button size="sm" variant="ghost" className="w-full justify-center" onClick={onClose}>Maybe later</Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Opens the shared Buy Plan dialog (or its own, outside an UpgradeProvider). */
function useUpgrade() {
  const open = useContext(UpgradeContext);
  const [local, setLocal] = useState(false);
  return { open: () => (open ? open() : setLocal(true)), dialog: !open && <UpgradeDialog open={local} onClose={() => setLocal(false)} /> };
}

function ViewButton() {
  const u = useUpgrade();
  return (
    <>
      <button
        type="button"
        onClick={u.open}
        className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 text-xs font-medium text-ink hover:border-ink/30 hover:bg-ink/5"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden /> View Now
      </button>
      {u.dialog}
    </>
  );
}

/** Row-level “View Now” for a masked lead. */
export function ViewNowButton({ className }: { className?: string }) {
  const u = useUpgrade();
  return (
    <>
      <Button size="sm" onClick={u.open} className={className}><Eye className="h-4 w-4" aria-hidden /> View Now</Button>
      {u.dialog}
    </>
  );
}

/** One contact line: a link when unlocked, masked text + View Now when locked. */
export function ContactValue({ kind, value, locked, compact }: { kind: "email" | "phone"; value: string; locked: boolean; compact?: boolean }) {
  const Icon = kind === "email" ? Mail : Phone;
  if (!locked) {
    return (
      <a href={kind === "email" ? `mailto:${value}` : `tel:${value}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
        {!compact && <Icon className="h-4 w-4" aria-hidden />}
        {kind === "phone" ? formatPhone(value) : value}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {!compact && <Icon className="h-4 w-4 text-muted" aria-hidden />}
      <span className="font-mono text-[13px] tracking-wide text-ink/80" aria-label={`${kind === "email" ? "Email" : "Phone"} hidden`}>{value}</span>
      {!compact && <ViewButton />}
    </span>
  );
}

export function LockedBanner() {
  const u = useUpgrade();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-panel border border-primary/20 bg-mint-soft px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint-ink"><Lock className="h-4 w-4" aria-hidden /></span>
      <p className="min-w-0 flex-1 text-sm text-ink">
        <span className="font-semibold">Buyer emails and phone numbers are hidden.</span>{" "}
        <span className="text-muted">Buy a plan to see full lead details and contact buyers directly.</span>
      </p>
      <Button size="sm" onClick={u.open}><Sparkles className="h-4 w-4" aria-hidden /> Buy a plan</Button>
      {u.dialog}
    </div>
  );
}
