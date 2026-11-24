/**
 * Masks contact details shown to vendors without an active plan.
 * The real values never leave the server for those users; these are display strings only.
 */

const DOT = "•";

/** "suresh.patel@gmail.com" → "su••••••@g••••.com" */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return DOT.repeat(8);
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const keep = local.length <= 3 ? 1 : 2;
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : "";
  return `${local.slice(0, keep)}${DOT.repeat(Math.min(6, Math.max(3, local.length - keep)))}@${host.slice(0, 1)}${DOT.repeat(Math.min(5, Math.max(3, host.length - 1)))}${tld}`;
}

/** "+919876543210" → "+91 98••••••10" */
export function maskPhone(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, "");
  let cc = "";
  let rest = clean;
  if (clean.startsWith("+91")) {
    cc = "+91 ";
    rest = clean.slice(3);
  } else if (clean.startsWith("+")) {
    cc = `${clean.slice(0, 3)} `;
    rest = clean.slice(3);
  }
  if (rest.length < 5) return `${cc}${DOT.repeat(6)}`;
  return `${cc}${rest.slice(0, 2)}${DOT.repeat(rest.length - 4)}${rest.slice(-2)}`;
}

const EMAIL_IN_TEXT = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 8+ digits, optionally with a leading +, spaces, dots, dashes or brackets between them.
const PHONE_IN_TEXT = /\+?\d[\d\s().-]{6,}\d/g;

/** Masks emails and phone numbers a buyer typed into free text (requirement, message). */
export function maskContactsInText(text: string): string {
  return text.replace(EMAIL_IN_TEXT, (m) => maskEmail(m)).replace(PHONE_IN_TEXT, (m) => (m.replace(/\D/g, "").length >= 8 ? maskPhone(m) : m));
}
