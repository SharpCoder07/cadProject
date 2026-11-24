import { describe, expect, it } from "vitest";
import { appliesTo, compareVersions, diffBlocks, htmlToBlocks, needsAcceptance, nextVersion, scheduledVersions, versionInForce } from "@/lib/compliance/legal";

const d = (s: string) => new Date(s);
const NOW = d("2026-11-23T10:00:00Z");
const V = [
  { id: "a", version: "1.0", status: "PUBLISHED" as const, effectiveAt: d("2026-01-01T00:00:00Z") },
  { id: "b", version: "1.1", status: "PUBLISHED" as const, effectiveAt: d("2026-06-01T00:00:00Z") },
  { id: "c", version: "2.0", status: "PUBLISHED" as const, effectiveAt: d("2027-01-01T00:00:00Z") },
  { id: "x", version: "1.2", status: "ARCHIVED" as const, effectiveAt: d("2026-09-01T00:00:00Z") },
  { id: "dr", version: "2.1", status: "DRAFT" as const, effectiveAt: null },
];

describe("version in force", () => {
  it("is the latest published version that has started; archived, drafts and scheduled don't count", () => {
    expect(versionInForce(V, NOW)?.id).toBe("b");
    expect(scheduledVersions(V, NOW).map((v) => v.id)).toEqual(["c"]);
    expect(versionInForce(V, d("2027-02-01T00:00:00Z"))?.id).toBe("c");
    expect(versionInForce([V[4]!], NOW)).toBeNull();
  });
});

describe("version numbers", () => {
  it("compares numerically and suggests the next one", () => {
    expect(compareVersions("1.10", "1.9")).toBeGreaterThan(0);
    expect(compareVersions("2.0", "2")).toBe(0);
    expect(nextVersion([])).toBe("1.0");
    expect(nextVersion(["1.0", "1.9", "1.10"])).toBe("1.11");
  });
});

describe("acceptance", () => {
  const doc = { requiresAcceptance: true, isActive: true };
  it("asks only when the version in force asks for it and it hasn't been accepted", () => {
    expect(needsAcceptance(doc, { id: "b", requireReacceptance: true }, new Set())).toBe(true);
    expect(needsAcceptance(doc, { id: "b", requireReacceptance: true }, new Set(["b"]))).toBe(false);
    expect(needsAcceptance(doc, { id: "b", requireReacceptance: false }, new Set())).toBe(false);
    expect(needsAcceptance({ ...doc, requiresAcceptance: false }, { id: "b", requireReacceptance: true }, new Set())).toBe(false);
    expect(needsAcceptance(doc, null, new Set())).toBe(false);
  });
  it("never asks staff, and matches the audience", () => {
    expect(appliesTo("all", "staff")).toBe(false);
    expect(appliesTo("all", "buyer")).toBe(true);
    expect(appliesTo("vendor", "buyer")).toBe(false);
    expect(appliesTo("reseller", "reseller")).toBe(true);
  });
});

describe("comparing versions", () => {
  it("turns HTML into text blocks and marks added and removed paragraphs", () => {
    const a = htmlToBlocks("<h2>Data we collect</h2><p>Name &amp; email.</p><p>Phone.</p>");
    const b = htmlToBlocks("<h2>Data we collect</h2><p>Name &amp; email.</p><ul><li>Company</li></ul>");
    expect(a).toEqual(["Data we collect", "Name & email.", "Phone."]);
    expect(diffBlocks(a, b)).toEqual([
      { op: "same", text: "Data we collect" },
      { op: "same", text: "Name & email." },
      { op: "remove", text: "Phone." },
      { op: "add", text: "Company" },
    ]);
  });
});
