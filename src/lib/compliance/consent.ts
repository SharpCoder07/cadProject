/**
 * Consent and cookie-choice rules shared by the browser and the server (no server-only imports).
 * Optional purposes and cookie categories are never on until the person turns them on.
 */
import { z } from "zod";

export const COOKIE_CONSENT_COOKIE = "cg_cookie_consent";
/** Fired on window to reopen the cookie settings dialog (footer link, account page). */
export const OPEN_COOKIE_SETTINGS = "cg:cookie-settings";
/** Fired on window after a choice is saved, with the choices as detail. */
export const COOKIE_CHOICE_EVENT = "cg:cookie-choice";

export type CookieChoices = Record<string, boolean>;
export interface StoredCookieConsent { v: string; id: string; c: CookieChoices; t: number }

export const cookieChoiceInput = z.object({
  visitorId: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
  action: z.enum(["accept_all", "reject_all", "custom"]),
  choices: z.record(z.string().regex(/^[a-z0-9_]{1,40}$/), z.boolean()).refine((o) => Object.keys(o).length <= 30, "Too many categories"),
  noticeVersion: z.string().min(1).max(20),
});
export type CookieChoiceInput = z.infer<typeof cookieChoiceInput>;

/** Builds the choices for a button: necessary categories always true, the rest from the action. */
export function choicesFor(
  categories: { key: string; isNecessary: boolean }[],
  action: "accept_all" | "reject_all" | "custom",
  custom: CookieChoices = {},
): CookieChoices {
  const out: CookieChoices = {};
  for (const c of categories) out[c.key] = c.isNecessary ? true : action === "accept_all" ? true : action === "reject_all" ? false : custom[c.key] === true;
  return out;
}

/** Reads the consent cookie value. Anything unreadable, or from an older notice version, counts as no choice. */
export function parseStoredConsent(raw: string | undefined | null, version: string): StoredCookieConsent | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(decodeURIComponent(raw)) as StoredCookieConsent;
    if (!v || typeof v !== "object" || v.v !== version || typeof v.id !== "string" || !v.c || typeof v.c !== "object") return null;
    const c: CookieChoices = {};
    for (const [k, b] of Object.entries(v.c)) if (typeof b === "boolean" && /^[a-z0-9_]{1,40}$/.test(k)) c[k] = b;
    return { v: v.v, id: v.id, c, t: Number(v.t) || 0 };
  } catch {
    return null;
  }
}

/** Is a category allowed? With no choice saved, only necessary cookies are. */
export const allowed = (stored: StoredCookieConsent | null, key: string) => key === "necessary" || stored?.c[key] === true;

/** Which tracking scripts may load. GTM, GA4 and Clarity need analytics; Meta Pixel needs marketing. */
export function allowedTrackers(stored: StoredCookieConsent | null) {
  const analytics = allowed(stored, "analytics");
  return { gtm: analytics, ga4: analytics, clarity: analytics, metaPixel: allowed(stored, "marketing") };
}

/** Optional purpose keys a signup or account form may send: only these, and only when ticked. */
export const consentChoiceInput = z.object({ purposeKey: z.string().regex(/^[a-z0-9_]{1,40}$/), granted: z.boolean() });

/**
 * The next state for one purpose. Withdrawing closes the open record; granting again opens a new one, so the
 * history of every grant and withdrawal is kept. Returns what to do, or null when nothing changes.
 */
export function consentTransition(open: { id: string } | null, granted: boolean): { op: "create" } | { op: "withdraw"; id: string } | null {
  if (granted) return open ? null : { op: "create" };
  return open ? { op: "withdraw", id: open.id } : null;
}
