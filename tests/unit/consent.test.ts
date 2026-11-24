import { describe, expect, it } from "vitest";
import { allowed, allowedTrackers, choicesFor, consentTransition, cookieChoiceInput, parseStoredConsent } from "@/lib/compliance/consent";

const CATS = [
  { key: "necessary", isNecessary: true },
  { key: "functional", isNecessary: false },
  { key: "analytics", isNecessary: false },
  { key: "marketing", isNecessary: false },
];

describe("cookie choices", () => {
  it("reject all keeps only necessary cookies on", () => {
    expect(choicesFor(CATS, "reject_all")).toEqual({ necessary: true, functional: false, analytics: false, marketing: false });
  });
  it("accept all turns everything on", () => {
    expect(Object.values(choicesFor(CATS, "accept_all")).every(Boolean)).toBe(true);
  });
  it("custom never switches necessary off and treats missing as off", () => {
    expect(choicesFor(CATS, "custom", { necessary: false, analytics: true })).toEqual({ necessary: true, functional: false, analytics: true, marketing: false });
  });
});

describe("stored consent", () => {
  const raw = (v: object) => encodeURIComponent(JSON.stringify(v));
  it("no cookie means no optional tracker loads", () => {
    expect(allowedTrackers(null)).toEqual({ gtm: false, ga4: false, clarity: false, metaPixel: false });
    expect(allowed(null, "necessary")).toBe(true);
  });
  it("an older notice version asks again", () => {
    expect(parseStoredConsent(raw({ v: "1.0", id: "abcdefgh", c: { analytics: true }, t: 1 }), "1.1")).toBeNull();
  });
  it("garbage is ignored", () => {
    expect(parseStoredConsent("%%%not-json", "1.0")).toBeNull();
    expect(parseStoredConsent(raw({ v: "1.0", id: 5, c: {} }), "1.0")).toBeNull();
  });
  it("analytics consent enables GA4, GTM and Clarity but not Meta Pixel", () => {
    const s = parseStoredConsent(raw({ v: "1.0", id: "abcdefgh", c: { analytics: true, marketing: false, "BAD KEY": true }, t: 1 }), "1.0");
    expect(s?.c).toEqual({ analytics: true, marketing: false });
    expect(allowedTrackers(s)).toEqual({ gtm: true, ga4: true, clarity: true, metaPixel: false });
  });
});

describe("cookie choice input", () => {
  it("accepts a normal choice and rejects bad visitor ids", () => {
    expect(cookieChoiceInput.safeParse({ visitorId: "9b2f6a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b", action: "custom", choices: { analytics: true }, noticeVersion: "1.0" }).success).toBe(true);
    expect(cookieChoiceInput.safeParse({ visitorId: "<script>", action: "custom", choices: {}, noticeVersion: "1.0" }).success).toBe(false);
    expect(cookieChoiceInput.safeParse({ visitorId: "abcdefgh", action: "maybe", choices: {}, noticeVersion: "1.0" }).success).toBe(false);
  });
});

describe("consent history", () => {
  it("granting with no open record creates one; granting again changes nothing", () => {
    expect(consentTransition(null, true)).toEqual({ op: "create" });
    expect(consentTransition({ id: "c1" }, true)).toBeNull();
  });
  it("withdrawing closes the open record and is a no-op without one", () => {
    expect(consentTransition({ id: "c1" }, false)).toEqual({ op: "withdraw", id: "c1" });
    expect(consentTransition(null, false)).toBeNull();
  });
});
