/** Shared billing helpers (pure; safe on server and client). */

export type Interval = "MONTH" | "QUARTER" | "HALF_YEAR" | "YEAR";
export const INTERVALS: Interval[] = ["MONTH", "QUARTER", "HALF_YEAR", "YEAR"];

export const INTERVAL_MONTHS: Record<Interval, number> = { MONTH: 1, QUARTER: 3, HALF_YEAR: 6, YEAR: 12 };
export const INTERVAL_LABEL: Record<Interval, string> = { MONTH: "Monthly", QUARTER: "Quarterly", HALF_YEAR: "Every 6 months", YEAR: "Yearly" };
export const INTERVAL_PER: Record<Interval, string> = { MONTH: "month", QUARTER: "quarter", HALF_YEAR: "6 months", YEAR: "year" };

/** Adds whole calendar months; the 31st becomes the last day of a shorter month. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export const addInterval = (date: Date, interval: Interval) => addMonths(date, INTERVAL_MONTHS[interval]);

/** 49900 → "₹499", 129950 → "₹1,299.50" */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(rupees);
}

/** "1,299.50" or "1299" → 129950 paise; null if not a valid amount. */
export function parseRupees(input: string | number): number | null {
  const n = typeof input === "number" ? input : Number(String(input).replace(/[,₹\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
