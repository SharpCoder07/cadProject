"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, INTERVAL_PER, type Interval } from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useServerAction } from "@/components/admin/use-action";
import { confirmCheckoutAction, startCheckoutAction } from "./actions";

export interface PlanView {
  id: string;
  name: string;
  description: string | null;
  pricePaise: number;
  interval: Interval;
  features: string[];
  isFeatured: boolean;
}

interface RazorpaySuccess { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
interface RazorpayInstance { open: () => void; on: (event: "payment.failed", cb: (r: { error: { description?: string } }) => void) => void }
declare global {
  interface Window { Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    const s = existing ?? Object.assign(document.createElement("script"), { src: CHECKOUT_SRC, async: true });
    s.addEventListener("load", () => resolve(Boolean(window.Razorpay)));
    s.addEventListener("error", () => resolve(false));
    if (!existing) document.body.appendChild(s);
  });
}

export function PlansGrid({ plans, canBuy, paymentsEnabled, hasActive, onPurchased, compact = false }: { plans: PlanView[]; canBuy: boolean; paymentsEnabled: boolean; hasActive: boolean; onPurchased?: () => void; compact?: boolean }) {
  const router = useRouter();
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const start = useServerAction(startCheckoutAction, { refresh: false });
  const confirm = useServerAction(confirmCheckoutAction);

  async function buy(plan: PlanView) {
    setBusy(plan.id);
    const loaded = await loadCheckout();
    if (!loaded) {
      notify("error", "The payment window couldn't load. Check your connection or ad blocker and try again.");
      return setBusy(null);
    }
    const res = await start.run({ planId: plan.id });
    if (!res.ok) return setBusy(null);
    const o = res.data;
    const rzp = new window.Razorpay!({
      key: o.keyId,
      order_id: o.orderId,
      amount: o.amount,
      currency: o.currency,
      name: o.name,
      description: o.description,
      prefill: o.prefill,
      theme: { color: "#111827" },
      handler: async (r: RazorpaySuccess) => {
        const done = await confirm.run({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
        setBusy(null);
        router.refresh();
        if (done.ok) onPurchased?.();
      },
      modal: { ondismiss: () => setBusy(null) },
    });
    rzp.on("payment.failed", (r) => notify("error", r.error.description ?? "The payment failed. No money was taken; you can try again."));
    rzp.open();
  }

  if (!plans.length) return <p className="admin-card p-6 text-sm text-muted">Plans will appear here soon. Contact us to subscribe in the meantime.</p>;

  return (
    <div className={cn("grid gap-4", compact ? (plans.length > 2 ? "md:grid-cols-3" : "sm:grid-cols-2") : "md:grid-cols-2 xl:grid-cols-3")}>
      {plans.map((p) => (
        <div key={p.id} className={cn("relative flex flex-col rounded-panel border bg-surface p-5", p.isFeatured ? "border-ink shadow-[0_8px_30px_rgb(16_24_40/0.08)]" : "border-line")}>
          {p.isFeatured && (
            <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-semibold text-surface">
              <Sparkles className="h-3 w-3" aria-hidden /> Most popular
            </span>
          )}
          <h3 className="text-base font-semibold text-ink">{p.name}</h3>
          {p.description && <p className="mt-1 text-sm text-muted">{p.description}</p>}
          <p className="mt-4 flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-ink">{formatINR(p.pricePaise)}</span>
            <span className="text-sm text-muted">/ {INTERVAL_PER[p.interval]}</span>
          </p>
          <p className="text-xs text-muted">Including GST · one-time payment, no auto-renewal</p>
          <ul className="mt-4 flex-1 space-y-2 text-sm">
            {["Buyer email and phone on every lead", ...p.features].map((f) => (
              <li key={f} className="flex items-start gap-2 text-ink"><Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />{f}</li>
            ))}
          </ul>
          <Button size="sm"
            className="mt-5 w-full justify-center"
            variant={p.isFeatured ? "primary" : "secondary"}
            disabled={!canBuy || !paymentsEnabled || (busy !== null && busy !== p.id)}
            loading={busy === p.id}
            onClick={() => void buy(p)}
          >
            {hasActive ? "Buy now — extends your plan" : "Buy now"}
          </Button>
        </div>
      ))}
    </div>
  );
}
