import "server-only";
import { z } from "zod";
import type { BillingInterval, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { env } from "@/server/env";
import { AppError, forbidden, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { getSettings } from "@/server/settings";
import { sendTemplate } from "@/server/email/config";
import { addInterval, formatINR, INTERVAL_PER, INTERVALS } from "@/lib/billing";
import { capturePayment, createOrder, fetchPayment, getRazorpayCredentials, getWebhookSecret } from "@/server/payments/razorpay";
import { verifyPaymentSignature, verifyWebhookSignature } from "@/server/payments/signature";
import { withBin } from "@/server/system/trash";
import { notify, notifyNow } from "@/server/notifications/notify";
import { guardDelete } from "@/server/rbac/deletion";

/**
 * Vendor plans and subscriptions. An ACTIVE subscription whose period covers "now" unlocks
 * buyer contact details on that vendor's leads. Paid online with Razorpay (one payment per period;
 * renewals bought early start when the current period ends), or granted by an admin.
 */

// ─── Access ──────────────────────────────────────────────────────────────────

export async function currentSubscription(vendorId: string) {
  const now = new Date();
  return db.vendorSubscription.findFirst({
    where: { vendorId, status: "ACTIVE", periodStart: { lte: now }, periodEnd: { gt: now } },
    orderBy: { periodEnd: "desc" },
    select: { id: true, planName: true, periodStart: true, periodEnd: true, source: true },
  });
}

/** True when the vendor may see buyer emails and phone numbers. */
export async function hasLeadContactAccess(vendorId: string): Promise<boolean> {
  return Boolean(await currentSubscription(vendorId));
}

// ─── Plans (admin) ───────────────────────────────────────────────────────────

export const planInput = z.object({
  name: z.string().trim().min(1, "Enter a plan name").max(60),
  description: z.string().trim().max(300).optional().default(""),
  price: z.coerce.number({ invalid_type_error: "Enter a price" }).min(1, "At least ₹1").max(10_000_000, "That's too high"),
  interval: z.enum(INTERVALS as [BillingInterval, ...BillingInterval[]]),
  features: z.array(z.string().trim().min(1).max(120)).max(15).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  /** Who can buy it. */
  audience: z.enum(["VENDOR", "RESELLER"]).default("VENDOR"),
});

export async function listPlansAdmin(user: Principal) {
  assertCan(user, "billing.view");
  return db.vendorPlan.findMany({
    orderBy: [{ sortOrder: "asc" }, { pricePaise: "asc" }],
    include: { _count: { select: { subscriptions: { where: { status: "ACTIVE", periodEnd: { gt: new Date() } } } } } },
  });
}

export async function savePlan(user: Principal, id: string | null, raw: unknown) {
  assertCan(user, "billing.manage");
  const i = planInput.parse(raw);
  const data = { name: i.name, description: i.description || null, pricePaise: Math.round(i.price * 100), interval: i.interval, features: i.features, isActive: i.isActive, isFeatured: i.isFeatured, sortOrder: i.sortOrder, audience: i.audience };
  const plan = id ? await db.vendorPlan.update({ where: { id }, data }) : await db.vendorPlan.create({ data });
  await audit({ actorId: user.id, action: id ? "billing.plan_update" : "billing.plan_create", entityType: "vendor_plan", entityId: plan.id, summary: `${plan.name}: ${formatINR(plan.pricePaise)} per ${INTERVAL_PER[plan.interval]}${plan.isActive ? "" : " (hidden)"}` });
  return plan;
}

/** Shows or hides a plan in the vendor portal (bulk select on Billing › Plans). */
export async function setPlanVisible(user: Principal, id: string, isActive: boolean) {
  assertCan(user, "billing.manage");
  const plan = await db.vendorPlan.update({ where: { id }, data: { isActive }, select: { name: true } });
  await audit({ actorId: user.id, action: isActive ? "billing.plan_show" : "billing.plan_hide", entityType: "vendor_plan", entityId: id, summary: `${plan.name} ${isActive ? "shown" : "hidden"}` });
}

/** Plans that were ever bought can only be hidden, so past payments keep their plan. */
export async function deletePlan(user: Principal, id: string) {
  assertCan(user, "billing.view");
  await guardDelete(user, "plan", { id });
  const plan = await db.vendorPlan.findUnique({ where: { id }, include: { _count: { select: { subscriptions: true } } } });
  if (!plan) throw notFound("Plan");
  if (plan._count.subscriptions > 0) {
    await db.vendorPlan.update({ where: { id }, data: { isActive: false } });
    await audit({ actorId: user.id, action: "billing.plan_hide", entityType: "vendor_plan", entityId: id, summary: `${plan.name} hidden (it has subscriptions)` });
    return "hidden" as const;
  }
  await withBin(user, "VendorPlan", [id], (tx) => tx.vendorPlan.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "billing.plan_delete", entityType: "vendor_plan", entityId: id, summary: plan.name });
  return "deleted" as const;
}

// ─── Vendor portal ───────────────────────────────────────────────────────────

export async function getVendorBilling(user: Principal & { vendorId: string }) {
  assertCan(user, "vendor.portal");
  const now = new Date();
  const company = await db.vendor.findUniqueOrThrow({ where: { id: user.vendorId }, select: { kind: true } });
  const [plans, current, upcoming, history, creds] = await Promise.all([
    // Vendors see vendor plans, resellers see reseller plans.
    db.vendorPlan.findMany({ where: { isActive: true, audience: company.kind }, orderBy: [{ sortOrder: "asc" }, { pricePaise: "asc" }] }),
    currentSubscription(user.vendorId),
    db.vendorSubscription.findFirst({ where: { vendorId: user.vendorId, status: "ACTIVE", periodStart: { gt: now } }, orderBy: { periodEnd: "desc" }, select: { planName: true, periodStart: true, periodEnd: true } }),
    db.vendorSubscription.findMany({
      where: { vendorId: user.vendorId, OR: [{ status: { not: "PENDING" } }, { createdAt: { gt: new Date(Date.now() - 86_400_000) } }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, planName: true, amountPaise: true, status: true, source: true, periodStart: true, periodEnd: true, paidAt: true, createdAt: true, razorpayPaymentId: true, purchasedBy: { select: { name: true } } },
    }),
    getRazorpayCredentials(),
  ]);
  return { plans, current, upcoming, history, paymentsEnabled: Boolean(creds), testMode: creds?.mode === "test" };
}

function assertBuyer(user: Principal): asserts user is Principal & { vendorId: string } {
  if (!user.vendorId) throw forbidden("Plans are bought from the vendor portal.");
  assertCan(user, "vendor.billing");
}

/** Creates a Razorpay order and a PENDING subscription; returns what Checkout needs. */
export async function startCheckout(user: Principal, planId: string) {
  assertBuyer(user);
  const [plan, creds, vendor, settings] = await Promise.all([
    db.vendorPlan.findFirst({ where: { id: planId, isActive: true } }),
    getRazorpayCredentials(),
    db.vendor.findUniqueOrThrow({ where: { id: user.vendorId }, select: { name: true, phone: true, kind: true } }),
    getSettings(),
  ]);
  if (!plan || plan.audience !== vendor.kind) throw new AppError("That plan is no longer available. Refresh the page.");
  if (!creds) throw new AppError("Online payment isn't available right now. Please contact us to subscribe.");

  const sub = await db.vendorSubscription.create({
    data: { vendorId: user.vendorId, planId: plan.id, planName: plan.name, interval: plan.interval, amountPaise: plan.pricePaise, status: "PENDING", source: "RAZORPAY", purchasedById: user.id },
  });
  try {
    const order = await createOrder(creds, { amountPaise: plan.pricePaise, receipt: sub.id, notes: { subscriptionId: sub.id, vendorId: user.vendorId, plan: plan.name } });
    await db.vendorSubscription.update({ where: { id: sub.id }, data: { razorpayOrderId: order.id } });
    await audit({ actorId: user.id, action: "billing.checkout_start", entityType: "vendor_subscription", entityId: sub.id, summary: `${plan.name} · ${formatINR(plan.pricePaise)}` });
    return {
      keyId: creds.keyId,
      orderId: order.id,
      amount: plan.pricePaise,
      currency: "INR",
      name: settings.site.name,
      description: `${plan.name} — ${vendor.name}`,
      prefill: { name: user.name, email: user.email, contact: vendor.phone ?? "" },
    };
  } catch (e) {
    await db.vendorSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
    throw e;
  }
}

/** Called by the browser after Checkout succeeds. */
export async function confirmCheckout(user: Principal, input: { orderId: string; paymentId: string; signature: string }) {
  assertBuyer(user);
  const sub = await db.vendorSubscription.findUnique({ where: { razorpayOrderId: input.orderId } });
  if (!sub || sub.vendorId !== user.vendorId) throw notFound("Payment");
  const creds = await getRazorpayCredentials();
  if (!creds) throw new AppError("Payments are switched off. If money was taken, contact us with payment ID " + input.paymentId + ".");
  if (!verifyPaymentSignature(input.orderId, input.paymentId, input.signature, creds.keySecret)) {
    await audit({ actorId: user.id, action: "billing.signature_invalid", entityType: "vendor_subscription", entityId: sub.id, summary: `Payment ${input.paymentId}` });
    throw new AppError("We couldn't verify this payment. If money was taken, contact us with payment ID " + input.paymentId + ".");
  }
  return settlePayment(sub.id, input.paymentId, "checkout");
}

/** Confirms the payment with Razorpay (capturing it if needed) and activates the subscription. Idempotent. */
async function settlePayment(subscriptionId: string, paymentId: string, via: "checkout" | "webhook") {
  const sub = await db.vendorSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
  if (sub.status === "ACTIVE") return sub;
  const creds = await getRazorpayCredentials();
  if (creds) {
    let payment = await fetchPayment(creds, paymentId);
    if (payment.order_id !== sub.razorpayOrderId) throw new AppError("This payment belongs to a different order.");
    if (payment.amount !== sub.amountPaise) throw new AppError("The amount paid doesn't match the plan price. Contact us with payment ID " + paymentId + ".");
    if (payment.status === "authorized") payment = await capturePayment(creds, paymentId, sub.amountPaise);
    if (payment.status !== "captured") throw new AppError("The payment hasn't completed yet. If money was taken, it will be confirmed automatically within a few minutes.");
  }
  return activate(sub.id, { paymentId, actorId: sub.purchasedById, via });
}

/** Sets the period (starting after any current subscription) and marks it ACTIVE. */
async function activate(subscriptionId: string, opts: { paymentId: string | null; actorId: string | null; via: string }) {
  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.vendorSubscription.updateMany({ where: { id: subscriptionId, status: "PENDING" }, data: { status: "ACTIVE", razorpayPaymentId: opts.paymentId, paidAt: new Date() } });
    const sub = await tx.vendorSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    if (!claimed.count) return { sub, fresh: false };
    const latest = await tx.vendorSubscription.findFirst({ where: { vendorId: sub.vendorId, status: "ACTIVE", id: { not: sub.id }, periodEnd: { gt: new Date() } }, orderBy: { periodEnd: "desc" }, select: { periodEnd: true } });
    const start = latest?.periodEnd ?? new Date();
    const updated = await tx.vendorSubscription.update({ where: { id: sub.id }, data: { periodStart: start, periodEnd: addInterval(start, sub.interval) } });
    await audit({ actorId: opts.actorId, action: "billing.subscription_active", entityType: "vendor_subscription", entityId: sub.id, summary: `${sub.planName} · ${formatINR(sub.amountPaise)} · via ${opts.via}${opts.paymentId ? ` · ${opts.paymentId}` : ""}` }, tx);
    return { sub: updated, fresh: true };
  });
  if (result.fresh) {
    void sendReceipt(result.sub.id);
    void pushPayment(result.sub.id, opts.actorId);
  }
  return result.sub;
}

/** Bell + browser push when a plan becomes active: billing staff and the company's billing users. */
async function pushPayment(subscriptionId: string, actorId: string | null) {
  try {
    const sub = await db.vendorSubscription.findUniqueOrThrow({ where: { id: subscriptionId }, include: { vendor: { select: { name: true } } } });
    const paid = !(sub.source === "MANUAL" && sub.amountPaise === 0);
    const amount = paid ? formatINR(sub.amountPaise) : "Complimentary";
    const until = sub.periodEnd ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(sub.periodEnd) : null;
    notify({ staff: "billing.manage" }, {
      type: "payment.received",
      title: paid ? `Payment received: ${amount} from ${sub.vendor.name}` : `Plan granted to ${sub.vendor.name}`,
      body: `${sub.planName}${until ? ` · until ${until}` : ""}`,
      href: "/admin/billing/subscriptions",
      except: actorId,
    });
    notify({ company: sub.vendorId, permission: "vendor.billing" }, {
      type: "payment.received",
      title: paid ? `Payment received: ${amount}` : `${sub.planName} plan activated`,
      body: `${sub.planName} is active${until ? ` until ${until}` : ""}.`,
      href: "/vendor/plans",
    });
  } catch (e) {
    console.error("[billing] push failed", e);
  }
}

async function sendReceipt(subscriptionId: string) {
  try {
    const sub = await db.vendorSubscription.findUniqueOrThrow({ where: { id: subscriptionId }, include: { vendor: { select: { name: true, email: true } }, purchasedBy: { select: { name: true, email: true } } } });
    const to = sub.purchasedBy?.email ?? sub.vendor.email;
    if (!to) return;
    const ist = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(d) : "");
    await sendTemplate("subscription_active", to, {
      user_name: sub.purchasedBy?.name ?? sub.vendor.name,
      vendor_name: sub.vendor.name,
      plan_name: sub.planName,
      amount: sub.source === "MANUAL" && sub.amountPaise === 0 ? "Complimentary" : formatINR(sub.amountPaise),
      period_start: ist(sub.periodStart),
      period_end: ist(sub.periodEnd),
      payment_id: sub.razorpayPaymentId ?? "—",
      portal_url: `${env.APP_URL}/vendor/plans`,
    });
  } catch (e) {
    console.error("[billing] receipt email failed", e);
  }
}

/**
 * Cron: tells each company once when its plan ends within 7 days and nothing follows it.
 * Returns how many companies were told.
 */
export async function notifyExpiringPlans(): Promise<number> {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 86_400_000);
  const ending = await db.vendorSubscription.findMany({
    where: { status: "ACTIVE", periodEnd: { gt: now, lte: soon } },
    select: { vendorId: true, planName: true, periodEnd: true },
    orderBy: { periodEnd: "desc" },
  });
  let told = 0;
  const seen = new Set<string>();
  for (const sub of ending) {
    if (seen.has(sub.vendorId) || !sub.periodEnd) continue;
    seen.add(sub.vendorId);
    const later = await db.vendorSubscription.count({ where: { vendorId: sub.vendorId, status: "ACTIVE", periodEnd: { gt: sub.periodEnd } } });
    if (later) continue;
    const since = new Date(sub.periodEnd.getTime() - 8 * 86_400_000);
    const already = await db.notification.count({ where: { type: "plan.expiring", createdAt: { gt: since }, user: { vendorId: sub.vendorId } } });
    if (already) continue;
    const days = Math.max(1, Math.ceil((sub.periodEnd.getTime() - now.getTime()) / 86_400_000));
    const date = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(sub.periodEnd);
    await notifyNow({ company: sub.vendorId, permission: "vendor.billing" }, {
      type: "plan.expiring",
      title: `Your ${sub.planName} plan ends in ${days} day${days === 1 ? "" : "s"}`,
      body: `It ends on ${date}. Renew to keep seeing buyer contact details on leads.`,
      href: "/vendor/plans",
    });
    told++;
  }
  return told;
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

/** Handles a Razorpay webhook. Returns false when the signature doesn't check out. */
export async function handleRazorpayWebhook(rawBody: string, signature: string | null): Promise<boolean> {
  const secret = await getWebhookSecret();
  if (!secret || !signature || !verifyWebhookSignature(rawBody, signature, secret)) return false;
  const event = JSON.parse(rawBody) as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
  if (event.event !== "payment.captured" && event.event !== "order.paid") return true;
  const payment = event.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) return true;
  const sub = await db.vendorSubscription.findUnique({ where: { razorpayOrderId: payment.order_id } });
  if (!sub || sub.status !== "PENDING") return true;
  await settlePayment(sub.id, payment.id, "webhook");
  return true;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function listSubscriptions(user: Principal, opts: { status?: string; vendorId?: string; page?: number; q?: string }) {
  assertCan(user, "billing.view");
  const now = new Date();
  const page = Math.max(1, opts.page ?? 1);
  const term = opts.q?.trim();
  const where: Prisma.VendorSubscriptionWhereInput = {
    ...(opts.vendorId ? { vendorId: opts.vendorId } : {}),
    ...(term
      ? {
          OR: [
            { vendor: { name: { contains: term, mode: "insensitive" } } },
            { planName: { contains: term, mode: "insensitive" } },
            { note: { contains: term, mode: "insensitive" } },
            { razorpayPaymentId: { contains: term } },
            { razorpayOrderId: { contains: term } },
          ],
        }
      : {}),
    ...(opts.status === "active"
      ? { status: "ACTIVE", periodEnd: { gt: now } }
      : opts.status === "expired"
        ? { status: "ACTIVE", periodEnd: { lte: now } }
        : opts.status === "cancelled"
          ? { status: "CANCELLED" }
          : opts.status === "pending"
            ? { status: "PENDING" }
            : { status: { not: "PENDING" } }),
  };
  const [items, total, revenue] = await Promise.all([
    db.vendorSubscription.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 30,
      take: 30,
      include: { vendor: { select: { id: true, name: true } }, purchasedBy: { select: { name: true } } },
    }),
    db.vendorSubscription.count({ where }),
    db.vendorSubscription.aggregate({ where: { status: { in: ["ACTIVE", "CANCELLED"] }, source: "RAZORPAY", paidAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }, _sum: { amountPaise: true } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 30)), revenueThisMonth: revenue._sum.amountPaise ?? 0 };
}

export const grantInput = z.object({
  vendorId: z.string().cuid("Choose a vendor"),
  planId: z.string().cuid("Choose a plan"),
  amount: z.coerce.number().min(0).max(10_000_000).default(0),
  startsNow: z.boolean().default(false),
  note: z.string().trim().max(300).optional().default(""),
});

/** Adds a subscription without online payment (paid offline, trial, goodwill). */
export async function grantSubscription(user: Principal, raw: unknown) {
  assertCan(user, "billing.manage");
  const i = grantInput.parse(raw);
  const [plan, vendor] = await Promise.all([db.vendorPlan.findUnique({ where: { id: i.planId } }), db.vendor.findUnique({ where: { id: i.vendorId }, select: { name: true, kind: true } })]);
  if (!plan) throw notFound("Plan");
  if (!vendor) throw notFound("Vendor");
  if (plan.audience !== vendor.kind) throw new AppError(`${plan.name} is a ${plan.audience === "RESELLER" ? "reseller" : "vendor"} plan. Choose a ${vendor.kind === "RESELLER" ? "reseller" : "vendor"} plan for ${vendor.name}.`, "BAD_REQUEST", { planId: ["Wrong plan type for this company"] });
  const sub = await db.vendorSubscription.create({
    data: { vendorId: i.vendorId, planId: plan.id, planName: plan.name, interval: plan.interval, amountPaise: Math.round(i.amount * 100), status: "PENDING", source: "MANUAL", purchasedById: null, note: i.note || null },
  });
  if (i.startsNow) {
    // Starts today even if another subscription is running (they overlap).
    const start = new Date();
    await db.vendorSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", paidAt: start, periodStart: start, periodEnd: addInterval(start, plan.interval) } });
    await audit({ actorId: user.id, action: "billing.subscription_active", entityType: "vendor_subscription", entityId: sub.id, summary: `${plan.name} granted to ${vendor.name} by admin (starts today)` });
    void sendReceipt(sub.id);
  } else {
    await activate(sub.id, { paymentId: null, actorId: user.id, via: "admin grant" });
  }
  return sub.id;
}

/** Ends access immediately. Refunds, if any, are made in the Razorpay dashboard. */
export async function cancelSubscription(user: Principal, id: string, reason: string) {
  assertCan(user, "billing.manage");
  const sub = await db.vendorSubscription.findUnique({ where: { id }, include: { vendor: { select: { name: true } } } });
  if (!sub) throw notFound("Subscription");
  if (sub.status !== "ACTIVE") throw new AppError("Only active subscriptions can be cancelled.");
  await db.vendorSubscription.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), note: [sub.note, reason && `Cancelled: ${reason}`].filter(Boolean).join("\n") || null } });
  await audit({ actorId: user.id, action: "billing.subscription_cancel", entityType: "vendor_subscription", entityId: id, summary: `${sub.planName} for ${sub.vendor.name} cancelled${reason ? `: ${reason}` : ""}` });
}
