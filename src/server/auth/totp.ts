import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30-second steps) — the settings every authenticator app
 * (Google Authenticator, Microsoft Authenticator, 2FAS, Authy, 1Password…) uses by default.
 * Pure functions, no database access, so they're unit-testable.
 */

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD = 30;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32-encoded (32 characters). */
export const generateTotpSecret = () => base32Encode(randomBytes(20));

/** RFC 4226 HOTP value for a counter. */
export function hotp(secret: string | Buffer, counter: number, digits = TOTP_DIGITS): string {
  const key = typeof secret === "string" ? base32Decode(secret) : secret;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", key).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const totpStep = (atMs = Date.now()) => Math.floor(atMs / 1000 / TOTP_PERIOD);

export const totp = (secret: string | Buffer, atMs = Date.now(), digits = TOTP_DIGITS) => hotp(secret, totpStep(atMs), digits);

/** Seconds left before the current code changes. */
export const secondsRemaining = (atMs = Date.now()) => TOTP_PERIOD - (Math.floor(atMs / 1000) % TOTP_PERIOD);

/** Digits only, so "123 456" and "123-456" are accepted. */
export const normalizeTotpInput = (code: string) => code.replace(/[\s-]/g, "");

/**
 * Checks a code against the current step and one step either side (phone clocks drift).
 * Returns the matched step, or null. `afterStep` rejects reuse of an already-accepted code.
 */
export function verifyTotp(secret: string, code: string, opts: { atMs?: number; window?: number; afterStep?: number | null } = {}): number | null {
  const clean = normalizeTotpInput(code);
  if (!/^\d{6}$/.test(clean)) return null;
  const now = totpStep(opts.atMs);
  const window = opts.window ?? 1;
  const key = base32Decode(secret);
  for (let delta = -window; delta <= window; delta++) {
    const step = now + delta;
    if (opts.afterStep != null && step <= opts.afterStep) continue;
    const expected = hotp(key, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return step;
  }
  return null;
}

/** The otpauth:// link that authenticator apps read from the QR code. */
export function otpauthUrl({ issuer, account, secret }: { issuer: string; account: string; secret: string }): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_PERIOD) });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** "JBSW Y3DP EHPK 3PXP" for typing into an app by hand. */
export const formatSecret = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

// ─── Backup codes ────────────────────────────────────────────────────────────

const BACKUP_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i
export const BACKUP_CODE_COUNT = 10;

/** Ten single-use codes like "k7mq-x3ta". */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = Array.from({ length: 8 }, () => BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export const normalizeBackupCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, "");

/** True when the input looks like a backup code rather than a 6-digit app code. */
export const looksLikeBackupCode = (code: string) => /^[a-z0-9]{8}$/.test(normalizeBackupCode(code)) && /[a-z]/.test(normalizeBackupCode(code));

/** Hashes are salted with the user id so the same code never hashes the same twice. */
export const hashBackupCode = (userId: string, code: string) => createHash("sha256").update(`${userId}:${normalizeBackupCode(code)}`).digest("hex");
