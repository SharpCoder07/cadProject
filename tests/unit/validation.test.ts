import { describe, expect, it } from "vitest";
import { email, href, phone, slug } from "@/lib/validation/common";
import { leadSubmission } from "@/lib/validation/leads";
import { softwareInput } from "@/lib/validation/software";
import { attributeInput } from "@/lib/validation/taxonomy";
import { istDate, pageInput, redirectInput } from "@/lib/validation/cms";
import { EMPTY_SOFTWARE } from "@/app/admin/software/load";
import { slugify, excerpt, readingMinutes } from "@/lib/utils";

describe("phone numbers", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["+14155550123", "+14155550123"],
  ])("normalises %s", (input, out) => expect(phone.parse(input)).toBe(out));

  it.each(["12345", "5876543210", "abcdefghij", "+91 12345 67890"])("rejects %s", (input) => expect(phone.safeParse(input).success).toBe(false));
});

describe("slugs and links", () => {
  it("slugifies names", () => {
    expect(slugify("  Tally & GST Pro — 2026! ")).toBe("tally-and-gst-pro-2026");
    expect(slugify("Café Señor")).toBe("cafe-senor");
  });
  it("accepts only clean slugs", () => {
    expect(slug.safeParse("good-slug-1").success).toBe(true);
    expect(slug.safeParse("Bad Slug").success).toBe(false);
    expect(slug.safeParse("-edge").success).toBe(false);
  });
  it("rejects script links", () => {
    expect(href.safeParse("javascript:alert(1)").success).toBe(false);
    expect(href.safeParse("/about").success).toBe(true);
    expect(href.safeParse("https://example.com").success).toBe(true);
  });
  it("lowercases email", () => expect(email.parse(" A@B.CO ")).toBe("a@b.co"));
});

describe("lead submission", () => {
  const base = { name: "Asha", email: "asha@example.in", phone: "9876543210", consent: true };
  it("requires consent", () => expect(leadSubmission.safeParse({ ...base, consent: false }).success).toBe(false));
  it("rejects a filled honeypot", () => expect(leadSubmission.safeParse({ ...base, website: "http://spam" }).success).toBe(false));
  it("limits product slugs", () => expect(leadSubmission.safeParse({ ...base, softwareSlugs: ["a", "b", "c", "d", "e"] }).success).toBe(false));
});

describe("software input", () => {
  const valid = { ...EMPTY_SOFTWARE, name: "Test", slug: "test" };
  it("adds the primary category to categories", () => {
    const out = softwareInput.parse({ ...valid, primaryCategoryId: "clx1234567890abcdefghijkl", categoryIds: [] });
    expect(out.categoryIds).toContain("clx1234567890abcdefghijkl");
  });
  it("rejects a price on a free product", () => {
    expect(softwareInput.safeParse({ ...valid, pricingModel: "FREE", startingPrice: 100 }).success).toBe(false);
  });
  it("rejects more than one most-popular plan", () => {
    const plan = { name: "P", price: 1, isPopular: true };
    expect(softwareInput.safeParse({ ...valid, plans: [plan, plan] }).success).toBe(false);
  });
  it("needs a file for screenshots and a URL for videos", () => {
    expect(softwareInput.safeParse({ ...valid, media: [{ kind: "VIDEO", mediaId: null, videoUrl: null }] }).success).toBe(false);
    expect(softwareInput.safeParse({ ...valid, media: [{ kind: "SCREENSHOT", mediaId: null }] }).success).toBe(false);
  });
});

describe("taxonomy and CMS inputs", () => {
  it("requires options for choice attributes", () => {
    expect(attributeInput.safeParse({ key: "platforms", label: "Platforms", type: "SELECT", options: [] }).success).toBe(false);
  });
  it("disallows text attributes as filters", () => {
    expect(attributeInput.safeParse({ key: "notes", label: "Notes", type: "TEXT", isFilterable: true }).success).toBe(false);
  });
  it("reserves system URLs for pages", () => {
    expect(pageInput.safeParse({ title: "Admin", slug: "admin" }).success).toBe(false);
    expect(pageInput.safeParse({ title: "About", slug: "about" }).success).toBe(true);
  });
  it("blocks redirect loops to self and admin paths", () => {
    expect(redirectInput.safeParse({ fromPath: "/a", toPath: "/a", statusCode: 301 }).success).toBe(false);
    expect(redirectInput.safeParse({ fromPath: "/admin/x", toPath: "/y", statusCode: 301 }).success).toBe(false);
    expect(redirectInput.safeParse({ fromPath: "/old", toPath: "/new", statusCode: "301" }).success).toBe(true);
  });
  it("treats datetime-local values as IST", () => {
    expect(new Date(istDate("2026-11-01T09:30") as string).toISOString()).toBe("2026-11-01T04:00:00.000Z");
  });
});

describe("text helpers", () => {
  it("builds excerpts on word boundaries", () => expect(excerpt("<p>one two three four</p>", 10)).toBe("one two…"));
  it("estimates reading time", () => expect(readingMinutes("word ".repeat(660))).toBe(3));
});
