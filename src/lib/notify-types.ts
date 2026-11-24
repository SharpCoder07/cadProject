/**
 * Bell and browser-push notification types. Pure data (safe in client components).
 * Each person sees the types for their part of the site and can switch any of them off;
 * switched-off types are stored on User.notifyOff.
 */
export type NotifyAudience = "staff" | "partner" | "buyer";

export const NOTIFY_TYPES = {
  // Staff (admin panel)
  "lead.new": { label: "New leads", description: "Someone sends an enquiry, quote, demo or other lead request.", audience: ["staff", "partner"] },
  "lead.assigned": { label: "Leads assigned to you", description: "A lead is assigned to you.", audience: ["staff"] },
  "approval.new": { label: "Approval requests", description: "A vendor or reseller asks for a change that needs approval.", audience: ["staff"] },
  "review.new": { label: "Reviews to moderate", description: "A new review is waiting for approval.", audience: ["staff"] },
  "question.new": { label: "Questions to moderate", description: "A new product question is waiting for approval.", audience: ["staff"] },
  "payment.received": { label: "Payments", description: "A plan payment goes through.", audience: ["staff", "partner"] },
  "deletion.request": { label: "Deletion requests", description: "Someone without Delete permission asks to delete something (Super Admin).", audience: ["staff"] },
  "privacy.case": { label: "Data requests and complaints", description: "Someone sends a data request or a complaint (Compliance & Privacy).", audience: ["staff"] },
  "deletion.decided": { label: "Your deletion requests", description: "The Super Admin approves or rejects something you asked to delete.", audience: ["staff", "partner"] },
  // Vendor and reseller portal
  "request.decided": { label: "Request approved or rejected", description: "A change you asked for is approved or rejected.", audience: ["partner"] },
  "plan.expiring": { label: "Plan expiring", description: "Your company's plan ends in a few days.", audience: ["partner"] },
  // Buyer account
  "offer.new": { label: "Offers on your favourites", description: "A product you saved gets a new offer.", audience: ["buyer"] },
  "question.answered": { label: "Answers to your questions", description: "A question you asked about a product is answered.", audience: ["buyer"] },
  "privacy.update": { label: "Your data requests and complaints", description: "There's an update on a request or complaint you sent.", audience: ["buyer"] },
  "review.moderated": { label: "Your reviews", description: "A review you wrote is published or rejected.", audience: ["buyer"] },
} as const satisfies Record<string, { label: string; description: string; audience: readonly NotifyAudience[] }>;

export type NotifyType = keyof typeof NOTIFY_TYPES;
export const NOTIFY_TYPE_KEYS = Object.keys(NOTIFY_TYPES) as NotifyType[];
export const isNotifyType = (v: string): v is NotifyType => v in NOTIFY_TYPES;
export const notifyTypesFor = (audience: NotifyAudience) =>
  NOTIFY_TYPE_KEYS.filter((k) => (NOTIFY_TYPES[k].audience as readonly NotifyAudience[]).includes(audience));
