import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  formatSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  hotp,
  looksLikeBackupCode,
  otpauthUrl,
  totp,
  verifyTotp,
} from "@/server/auth/totp";
import { qrMatrix, qrSvg } from "@/lib/qr";

// RFC 6238 appendix B, SHA-1 seed "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 42]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("mzxw 6ytb-oi")).toEqual(Buffer.from("foobar"));
  });

  it("matches the RFC 4226 HOTP test values", () => {
    expect([0, 1, 2, 9].map((c) => hotp(RFC_SECRET, c))).toEqual(["755224", "287082", "359152", "520489"]);
  });

  it("matches the RFC 6238 TOTP test values (8 digits)", () => {
    expect(totp(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(totp(RFC_SECRET, 1111111109_000, 8)).toBe("07081804");
    expect(totp(RFC_SECRET, 2000000000_000, 8)).toBe("69279037");
  });

  it("accepts the current code and one step of clock drift, nothing further", () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, totp(secret, now), { atMs: now })).toBe(step);
    expect(verifyTotp(secret, totp(secret, now - 30_000), { atMs: now })).toBe(step - 1);
    expect(verifyTotp(secret, totp(secret, now + 30_000), { atMs: now })).toBe(step + 1);
    expect(verifyTotp(secret, totp(secret, now - 90_000), { atMs: now })).toBeNull();
    expect(verifyTotp(secret, "12345", { atMs: now })).toBeNull();
    expect(verifyTotp(secret, "abcdef", { atMs: now })).toBeNull();
  });

  it("accepts spaces in codes but rejects a code already used", () => {
    const secret = generateTotpSecret();
    const now = 1_800_000_000_000;
    const code = totp(secret, now);
    const step = verifyTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, { atMs: now });
    expect(step).not.toBeNull();
    expect(verifyTotp(secret, code, { atMs: now, afterStep: step })).toBeNull();
  });

  it("builds an otpauth link apps understand", () => {
    const url = otpauthUrl({ issuer: "Cadgram", account: "a@b.com", secret: "JBSWY3DPEHPK3PXP" });
    expect(url).toBe("otpauth://totp/Cadgram:a%40b.com?secret=JBSWY3DPEHPK3PXP&issuer=Cadgram&algorithm=SHA1&digits=6&period=30");
    expect(generateTotpSecret()).toMatch(/^[A-Z2-7]{32}$/);
    expect(formatSecret("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
  });
});

describe("backup codes", () => {
  it("generates ten distinct, readable codes", () => {
    const codes = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    codes.forEach((c) => expect(c).toMatch(/^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/));
  });

  it("tells backup codes apart from app codes", () => {
    expect(looksLikeBackupCode("k7mq-x3ta")).toBe(true);
    expect(looksLikeBackupCode("K7MQ X3TA")).toBe(true);
    expect(looksLikeBackupCode("123456")).toBe(false);
    expect(looksLikeBackupCode("12345678")).toBe(false);
  });

  it("hashes per user and ignores formatting", () => {
    expect(hashBackupCode("u1", "k7mq-x3ta")).toBe(hashBackupCode("u1", "K7MQX3TA"));
    expect(hashBackupCode("u1", "k7mq-x3ta")).not.toBe(hashBackupCode("u2", "k7mq-x3ta"));
  });
});

describe("QR code", () => {
  it("picks the smallest version and draws the finder patterns", () => {
    expect(qrMatrix("hello").length).toBe(21); // version 1
    const m = qrMatrix(otpauthUrl({ issuer: "Cadgram", account: "someone@example.com", secret: generateTotpSecret() }));
    const size = m.length;
    expect((size - 17) % 4).toBe(0);
    for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]] as const) {
      expect(m[y]![x]).toBe(true);
      expect(m[y + 1]![x + 1]).toBe(false);
      expect(m[y + 3]![x + 3]).toBe(true);
    }
  });

  it("renders SVG", () => {
    expect(qrSvg("x")).toMatch(/^<svg[^>]+viewBox="0 0 29 29"/);
  });
});
