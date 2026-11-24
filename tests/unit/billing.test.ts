import { describe, expect, it } from "vitest";
import { maskEmail, maskPhone } from "@/lib/mask";
import { addInterval, addMonths, formatINR, parseRupees } from "@/lib/billing";
import { hmacHex, verifyPaymentSignature, verifyWebhookSignature } from "@/server/payments/signature";

describe("contact masking", () => {
  it("hides most of an email but keeps it recognisable", () => {
    expect(maskEmail("suresh.patel@gmail.com")).toBe("su••••••@g••••.com");
    expect(maskEmail("ab@x.in")).toBe("a•••@x•••.in");
    expect(maskEmail("not-an-email")).toBe("••••••••");
    expect(maskEmail("suresh.patel@gmail.com")).not.toContain("patel");
  });

  it("keeps the country code and the first and last two digits of a phone", () => {
    expect(maskPhone("+919876543210")).toBe("+91 98••••••10");
    expect(maskPhone("+44 7700 900123")).toBe("+44 77••••••23");
    expect(maskPhone("12")).toBe("••••••");
    expect(maskPhone("+919876543210")).not.toContain("765432");
  });
});

describe("billing helpers", () => {
  it("adds calendar months, clamping to the month's last day", () => {
    expect(addMonths(new Date("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addInterval(new Date("2026-10-30T00:00:00Z"), "YEAR").toISOString()).toBe("2027-10-30T00:00:00.000Z");
    expect(addInterval(new Date("2026-10-30T00:00:00Z"), "QUARTER").toISOString()).toBe("2027-01-30T00:00:00.000Z");
    expect(addInterval(new Date("2026-08-31T00:00:00Z"), "HALF_YEAR").toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });

  it("formats and parses rupees", () => {
    expect(formatINR(999900)).toBe("₹9,999");
    expect(formatINR(129950)).toBe("₹1,299.50");
    expect(parseRupees("1,299.50")).toBe(129950);
    expect(parseRupees("-1")).toBeNull();
  });
});

describe("Razorpay signatures", () => {
  it("verifies checkout signatures (order_id|payment_id)", () => {
    const sig = hmacHex("key_secret", "order_ABC|pay_XYZ");
    expect(verifyPaymentSignature("order_ABC", "pay_XYZ", sig, "key_secret")).toBe(true);
    expect(verifyPaymentSignature("order_ABC", "pay_OTHER", sig, "key_secret")).toBe(false);
    expect(verifyPaymentSignature("order_ABC", "pay_XYZ", sig, "wrong")).toBe(false);
    expect(verifyPaymentSignature("order_ABC", "pay_XYZ", "short", "key_secret")).toBe(false);
  });

  it("verifies webhook bodies byte for byte", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(verifyWebhookSignature(body, hmacHex("wh", body), "wh")).toBe(true);
    expect(verifyWebhookSignature(`${body} `, hmacHex("wh", body), "wh")).toBe(false);
  });
});

describe("contacts typed into messages", () => {
  it("masks emails and phone numbers inside free text, leaving other numbers alone", async () => {
    const { maskContactsInText } = await import("@/lib/mask");
    const out = maskContactsInText("Call me on 98765 43210 or mail ravi.k@abc.co.in. Need 25 licences by 2026.");
    expect(out).not.toContain("43210");
    expect(out).not.toContain("ravi.k@abc");
    expect(out).toContain("25 licences by 2026");
  });
});

describe("offers", () => {
  it("validates offers and treats an empty end date as no end", async () => {
    const { offerInput, offerPhase } = await import("@/server/services/offers");
    const base = { softwareId: "ckabcdefghijklmnopqrstuvw", title: " Diwali sale ", discount: "20% off", couponCode: "diwali20", startsAt: "2026-11-01T04:30:00.000Z" };
    const ok = offerInput.parse({ ...base, endsAt: "" });
    expect(ok.title).toBe("Diwali sale");
    expect(ok.couponCode).toBe("DIWALI20");
    expect(ok.endsAt).toBeNull();
    expect(offerInput.parse({ ...base, endsAt: null }).endsAt).toBeNull();
    expect(offerInput.safeParse({ ...base, endsAt: "2026-10-01T00:00:00.000Z" }).success).toBe(false);
    expect(offerInput.safeParse({ ...base, couponCode: "NO SPACES" }).success).toBe(false);
    expect(offerInput.safeParse({ ...base, url: "javascript:alert(1)" }).success).toBe(false);

    const now = new Date("2026-11-05T00:00:00Z");
    expect(offerPhase({ status: "DRAFT", startsAt: now, endsAt: null }, now)).toBe("draft");
    expect(offerPhase({ status: "PUBLISHED", startsAt: new Date("2026-11-10T00:00:00Z"), endsAt: null }, now)).toBe("scheduled");
    expect(offerPhase({ status: "PUBLISHED", startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: new Date("2026-11-04T00:00:00Z") }, now)).toBe("ended");
    expect(offerPhase({ status: "PUBLISHED", startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: null }, now)).toBe("live");
  });
});
