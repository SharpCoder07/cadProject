/**
 * How audit-log actions are shown (Admin → Audit log): a short code such as LOGIN_FAILED and the area
 * it belongs to. Actions are stored as "<area>.<what>", e.g. "auth.login_failed".
 */
const CODE: Record<string, string> = {
  "auth.login": "MFA_LOGIN_VERIFIED",
  "auth.password_ok": "LOGIN_SUCCESS",
  "auth.login_failed": "LOGIN_FAILED",
  "auth.login_wrong_portal": "LOGIN_WRONG_TAB",
  "auth.2fa_failed": "MFA_CODE_REJECTED",
  "auth.2fa_enabled": "MFA_ENABLED",
  "auth.2fa_disabled": "MFA_DISABLED",
  "auth.2fa_changed": "MFA_CHANGED",
  "auth.2fa_backup_codes": "MFA_BACKUP_CODES",
};

const AREA: Record<string, string> = {
  auth: "Security", account: "Account", user: "Team", role: "Team",
  software: "Products", category: "Catalogue", vendor: "Catalogue", brand: "Catalogue", industry: "Catalogue", attribute: "Catalogue", term: "Catalogue", comparison: "Catalogue", offer: "Catalogue",
  review: "Reviews", question: "Reviews",
  page: "Content", post: "Content", block: "Content", banner: "Content", announcement: "Content", testimonial: "Content", menu: "Content", faq: "Content", media: "Content", redirect: "SEO", seo: "SEO",
  lead: "Leads", approval: "Vendors", billing: "Billing", setting: "Settings", settings: "Settings", integration: "Settings", storage: "Settings", email: "Settings",
  geo: "Geo", bin: "System", backup: "System",
};

export function auditCode(action: string, summary?: string | null): string {
  if (action === "auth.login" && summary === "Buyer sign-in") return "LOGIN_SUCCESS";
  if (CODE[action]) return CODE[action];
  const [area = "", ...rest] = action.split(".");
  const what = rest.join("_") || area;
  return `${rest.length ? `${area}_` : ""}${what}`.replace(/[^a-z0-9]+/gi, "_").toUpperCase();
}

export const auditArea = (action: string) => AREA[action.split(".")[0] ?? ""] ?? "Other";

/** Every known action prefix (anything else is "Other"). */
export const allAreaPrefixes = () => Object.keys(AREA).map((p) => `${p}.`);

/** Action prefixes ("auth.", "account."…) that make up an area, for filtering. */
export const auditAreaPrefixes = (area: string) => Object.entries(AREA).filter(([, a]) => a === area).map(([p]) => `${p}.`);

export const auditTone = (action: string): "red" | "green" | "neutral" =>
  /failed|rejected|delete|suspend|disabled|wrong/.test(action) ? "red" : /enabled|verified|restore|reactivate|accepted/.test(action) || action === "auth.login" ? "green" : "neutral";

/** Readable text for an entry that has no summary. */
export function auditFallback(action: string, entityType: string): string {
  const what = action.split(".").slice(1).join(" ").replace(/_/g, " ") || action;
  return `${what.charAt(0).toUpperCase()}${what.slice(1)} (${entityType.replace(/_/g, " ")})`;
}
