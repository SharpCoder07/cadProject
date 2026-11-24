import { describe, expect, it } from "vitest";
import { diffObjects, referencedIds } from "@/lib/approval-diff";

describe("approval diff", () => {
  it("flags changed fields, hides admin-only ones and resolves names", () => {
    const before = { name: "Books", tagline: "Old", isFeatured: true, primaryCategoryId: "c1", features: [{ title: "GST" }] };
    const after = { name: "Books", tagline: "New", isFeatured: false, primaryCategoryId: "c2", features: [{ title: "GST" }, { title: "Payroll" }] };
    const rows = diffObjects(before, after, { c1: "Accounting", c2: "Payroll" });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(byKey.name?.changed).toBe(false);
    expect(byKey.tagline).toMatchObject({ changed: true, before: "Old", after: "New" });
    expect(byKey.primaryCategoryId).toMatchObject({ before: "Accounting", after: "Payroll" });
    expect(byKey.features?.after).toBe("GST · Payroll");
    expect(byKey.isFeatured).toBeUndefined();
  });

  it("strips HTML from descriptions and treats empty values alike", () => {
    const rows = diffObjects({ description: "<p>Hello <b>world</b></p>", website: "" }, { description: "<p>Hello <b>world</b></p>", website: null });
    expect(rows.find((r) => r.key === "description")?.after).toBe("Hello world");
    expect(rows.find((r) => r.key === "website")?.changed).toBe(false);
  });

  it("collects referenced ids for name lookups", () => {
    const ids = referencedIds({ primaryCategoryId: "c1", categoryIds: ["c2"], industryIds: ["i1"], relatedIds: ["s1"], brandId: "b1" });
    expect(ids).toEqual({ categories: ["c1", "c2"], industries: ["i1"], software: ["s1"], brands: ["b1"], terms: [] });
  });
});
