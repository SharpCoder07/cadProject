import { describe, expect, it } from "vitest";
import { STARTER_TERMS, TAXONOMIES, TAXONOMY_BY_KEY, slugifyTerm, termHeadline, termPath } from "@/lib/taxonomies";
import { GEO_STARTER } from "@/lib/geo-starter";

describe("taxonomies", () => {
  it("has unique keys and public paths", () => {
    expect(new Set(TAXONOMIES.map((t) => t.key)).size).toBe(TAXONOMIES.length);
    expect(new Set(TAXONOMIES.map((t) => t.path)).size).toBe(TAXONOMIES.length);
    expect(TAXONOMY_BY_KEY["use-cases"]!.kind).toBe("USE_CASE");
  });

  it("makes URL-safe slugs", () => {
    expect(slugifyTerm("2D Drafting")).toBe("2d-drafting");
    expect(slugifyTerm("Cloud / SaaS")).toBe("cloud-saas");
    expect(slugifyTerm("Reports & Dashboards")).toBe("reports-and-dashboards");
    expect(slugifyTerm("Under ₹10,000")).toBe("under-10-000");
    for (const names of Object.values(STARTER_TERMS)) {
      const slugs = names.map(slugifyTerm);
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("builds headings and paths", () => {
    expect(termHeadline("USE_CASE", { name: "2D Drafting" })).toBe("Top 2D Drafting Software");
    expect(termHeadline("USE_CASE", { name: "2D Drafting", headline: "Best drafting tools" })).toBe("Best drafting tools");
    expect(termPath("USE_CASE", "2d-drafting")).toBe("/use-case/2d-drafting");
  });
});

describe("geo", () => {
  it("starter locations have unique slugs and parents listed first", () => {
    const seen = new Set<string>();
    for (const l of GEO_STARTER) {
      expect(seen.has(l.slug)).toBe(false);
      if (l.parent) expect(seen.has(l.parent)).toBe(true);
      seen.add(l.slug);
    }
    expect(GEO_STARTER.find((l) => l.slug === "gurugram")?.level).toBe("CITY");
  });

  it("fills template tokens and inherits only where allowed", async () => {
    const { fillGeo, resolveSections } = await import("@/server/services/geo");
    const ctx = { name: "AutoCAD", city: "Gurugram", state: "Haryana", country: "India", site_name: "Cadgram" };
    expect(fillGeo("Buy {{name}} in {{ city }}, {{state}}", ctx)).toBe("Buy AutoCAD in Gurugram, Haryana");
    const template = { hero: "Buy {{name}} in {{city}}", introduction: "Intro for {{city}}", guide: "Guide", faqs: [{ question: "Q {{city}}?", answer: "A" }] };
    const r = resolveSections({ sections: { hero: "Own hero", introduction: "" }, inherit: ["introduction"] }, template, ctx);
    expect(r.hero).toBe("Own hero");
    expect(r.introduction).toBe("Intro for Gurugram");
    expect(r.guide).toBe("");
    expect(r.faqs).toEqual([]);
  });

  it("parses PIN codes and business zones from comma lists", async () => {
    const { locationInput } = await import("@/server/services/geo");
    const ok = locationInput.parse({ name: "Whitefield", level: "AREA", parentId: "ckabcdefghijklmnopqrstuvw", pinCodes: "560066, 560067", businessZones: "ITPL,\nBrookefield", latitude: "", longitude: "77.75" });
    expect(ok.pinCodes).toEqual(["560066", "560067"]);
    expect(ok.businessZones).toEqual(["ITPL", "Brookefield"]);
    expect(ok.latitude).toBeNull();
    expect(ok.longitude).toBe(77.75);
    expect(locationInput.safeParse({ name: "X", level: "CITY", pinCodes: "1234" }).success).toBe(false);
  });
});

describe("search", () => {
  it("strips filler words before matching classification names", async () => {
    const { termQueryText } = await import("@/server/services/search");
    expect(termQueryText("Best 2D Drafting Software in India")).toBe("2d drafting");
    expect(termQueryText("software for architects")).toBe("architect");
    expect(termQueryText("software")).toBe("");
  });
});

describe("CAD demo data", () => {
  it("only uses classification names that exist in the starter lists", async () => {
    const { CAD_PRODUCTS, CAD_TERM_PAGES } = await import("../../prisma/seed-cad-data");
    for (const p of CAD_PRODUCTS) {
      for (const [kind, names] of Object.entries(p.terms)) {
        for (const n of names ?? []) expect(STARTER_TERMS[kind as keyof typeof STARTER_TERMS], `${p.name}: ${kind} ${n}`).toContain(n);
      }
    }
    for (const t of CAD_TERM_PAGES) expect(STARTER_TERMS[t.kind]).toContain(t.name);
  });
});
