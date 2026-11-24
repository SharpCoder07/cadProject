/** Currencies a product price can be in (the product editor's list; the default is set in Website settings › Business rules). */
export const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD", "AUD", "CAD"] as const;

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN");

type DecimalLike = number | string | { toString(): string } | null | undefined;

export const toNumber = (v: DecimalLike): number | null => (v === null || v === undefined || v === "" ? null : Number(v.toString()));

export function formatPrice(value: DecimalLike, currency = "INR"): string {
  const n = toNumber(value);
  if (n === null) return "Price on request";
  if (n === 0) return "Free";
  if (currency === "INR") return inr.format(n);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export const formatNumber = (n: number) => num.format(n);

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts }).format(new Date(d));
}

export const formatDateTime = (d: Date | string | null | undefined) => formatDate(d, { dateStyle: "medium", timeStyle: "short" });

export function relativeTime(d: Date | string): string {
  const diff = (new Date(d).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en-IN", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60],
  ];
  for (const [unit, secs] of units) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
  return "just now";
}

export const PRICING_MODEL_LABEL: Record<string, string> = {
  FREE: "Free",
  FREEMIUM: "Freemium",
  SUBSCRIPTION: "Subscription",
  ONE_TIME: "One-time licence",
  USAGE_BASED: "Usage-based",
  QUOTE_BASED: "Quote-based",
};

export const DEPLOYMENT_LABEL: Record<string, string> = {
  CLOUD: "Cloud / SaaS",
  ON_PREMISE: "On-premise",
  HYBRID: "Hybrid",
  MOBILE: "Mobile app",
  DESKTOP: "Desktop app",
};

export const BILLING_LABEL: Record<string, string> = {
  MONTHLY: "/ month",
  QUARTERLY: "/ quarter",
  YEARLY: "/ year",
  ONE_TIME: "one-time",
  CUSTOM: "",
};
