/**
 * Password rule — the standard most CRMs use (Salesforce, Zoho, HubSpot, Microsoft…), the same for
 * every account (staff, vendors, resellers, buyers). Pure: used by the server (which enforces it, see
 * server/auth/password.ts) and by the forms (live checklist). Code-only on purpose: not a setting.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export interface PasswordContext { email?: string | null; name?: string | null }

export const PASSWORD_RULES = [
  { id: "length", label: `${PASSWORD_MIN}–${PASSWORD_MAX} characters, no spaces` },
  { id: "upper", label: "An uppercase letter (A–Z)" },
  { id: "lower", label: "A lowercase letter (a–z)" },
  { id: "number", label: "A number (0–9)" },
  { id: "special", label: "A special character, e.g. ! @ # $ % & *" },
  { id: "personal", label: "Doesn't contain your name or email" },
  { id: "common", label: "Not a common or easy-to-guess password" },
] as const;
export type PasswordRuleId = (typeof PASSWORD_RULES)[number]["id"];

/** Passwords (and parts) that are among the most used — refused even with the other rules met. */
const COMMON = [
  "password", "passw0rd", "p@ssword", "p@ssw0rd", "qwerty", "qwertyuiop", "asdfgh", "zxcvbn", "123456", "1234567", "12345678", "123456789", "1234567890",
  "111111", "000000", "abc123", "abcdef", "admin", "administrator", "welcome", "letmein", "login", "iloveyou", "monkey", "dragon", "sunshine",
  "princess", "football", "cricket", "baseball", "master", "superman", "batman", "trustno1", "secret", "changeme", "default", "test1234", "user",
  "india", "bharat", "cadgram", "guest", "root", "access", "computer", "starwars", "shadow", "ninja", "mustang", "hello", "freedom", "whatever",
];

const norm = (v: string) => v.toLowerCase().replace(/[@]/g, "a").replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e").replace(/\$/g, "s");

export function checkPassword(password: string, ctx: PasswordContext = {}): Record<PasswordRuleId, boolean> {
  const p = password ?? "";
  const lower = p.toLowerCase();
  const n = norm(p);
  const personal = [
    ...(ctx.email ? [ctx.email.split("@")[0]!.toLowerCase()] : []),
    ...(ctx.name ? ctx.name.toLowerCase().split(/[^a-z0-9]+/i) : []),
  ].filter((w) => w.length >= 3);
  const isCommon =
    COMMON.some((c) => lower.includes(c) || n.includes(norm(c))) ||
    /(.)\1{3,}/.test(p) || // aaaa, 1111
    /(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(p); // runs
  return {
    length: p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX && !/\s/.test(p),
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    number: /\d/.test(p),
    special: /[^A-Za-z0-9\s]/.test(p),
    personal: !personal.some((w) => lower.includes(w)),
    common: p.length > 0 && !isCommon,
  };
}

/** What's wrong (empty = fine), as sentences for error messages. */
export function passwordProblems(password: string, ctx: PasswordContext = {}): string[] {
  const c = checkPassword(password, ctx);
  const out: string[] = [];
  if (!c.length) out.push(`Use ${PASSWORD_MIN}–${PASSWORD_MAX} characters without spaces.`);
  if (!c.upper) out.push("Add an uppercase letter.");
  if (!c.lower) out.push("Add a lowercase letter.");
  if (!c.number) out.push("Add a number.");
  if (!c.special) out.push("Add a special character such as ! @ # $ %.");
  if (!c.personal) out.push("Don't use your name or email in the password.");
  if (!c.common) out.push("This password is too common or easy to guess.");
  return out;
}

/** 0–4 for the strength bar: rules met, plus length. */
export function passwordStrength(password: string, ctx: PasswordContext = {}): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  const met = Object.values(checkPassword(password, ctx)).filter(Boolean).length;
  if (met < 5) return 1;
  if (met < 7) return 2;
  return password.length >= 14 ? 4 : 3;
}
