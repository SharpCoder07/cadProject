import type { NextRequest } from "next/server";
import { handleRazorpayWebhook } from "@/server/services/billing";

/**
 * Razorpay webhook (payment.captured, order.paid). Activates a subscription even if the buyer
 * closed the browser before Checkout returned. Verified with the webhook secret from Settings → Payments.
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  if (body.length > 256_000) return new Response("Too large", { status: 413 });
  try {
    const ok = await handleRazorpayWebhook(body, req.headers.get("x-razorpay-signature"));
    return new Response(ok ? "ok" : "invalid signature", { status: ok ? 200 : 401 });
  } catch (e) {
    console.error("[razorpay] webhook failed", e);
    // 500 makes Razorpay retry later.
    return new Response("error", { status: 500 });
  }
}
