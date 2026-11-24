import { createHmac, timingSafeEqual } from "node:crypto";

/** Razorpay signatures are hex HMAC-SHA256. Pure functions so they can be unit tested. */

function safeHexEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

/** Checkout success: HMAC(order_id + "|" + payment_id, key_secret). */
export const verifyPaymentSignature = (orderId: string, paymentId: string, signature: string, keySecret: string) =>
  safeHexEqual(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);

/** Webhooks: HMAC(raw request body, webhook secret) in the X-Razorpay-Signature header. */
export const verifyWebhookSignature = (rawBody: string, signature: string, webhookSecret: string) => safeHexEqual(hmacHex(webhookSecret, rawBody), signature);
