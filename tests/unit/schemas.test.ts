import { describe, expect, it } from "vitest";
import { BLOCK_TYPES, blockSchemas, defaultBlockData, parseBlockData } from "@/lib/blocks/schemas";
import { BLOCK_FIELDS } from "@/components/admin/blocks/block-fields";
import { defaultSettings, parseSetting, settingSchemas } from "@/server/settings/schemas";
import { contrastRatio, readableOn, themeVariables } from "@/lib/theme";

describe("CMS blocks", () => {
  it("has defaults, an editor and a valid schema for every block type", () => {
    for (const t of BLOCK_TYPES) {
      expect(() => defaultBlockData(t)).not.toThrow();
      expect(BLOCK_FIELDS[t]).toBeDefined();
      for (const f of BLOCK_FIELDS[t]) expect(Object.keys((blockSchemas[t] as unknown as { shape: object }).shape)).toContain(f.name);
    }
  });
  it("rejects unsafe links in block data", () => {
    expect(parseBlockData("CTA", { primaryHref: "javascript:alert(1)" })).toBeNull();
    expect(parseBlockData("CTA", { primaryHref: "/contact" })?.primaryHref).toBe("/contact");
  });
});

describe("settings", () => {
  it("provides complete defaults", () => {
    const s = defaultSettings();
    expect(s.site.name).toBe("Cadgram");
    expect(s.labels.enquireCta).toBeTruthy();
    expect(s.detail.sections.reviews).toBe(true);
  });
  it("falls back to defaults when a stored value is corrupt", () => {
    expect(parseSetting("theme", { primary: "not-a-colour" }).primary).toBe(settingSchemas.theme.parse({}).primary);
  });
  it("rejects invalid colours and title templates on save", () => {
    expect(settingSchemas.theme.safeParse({ primary: "red" }).success).toBe(false);
    expect(settingSchemas.seo.safeParse({ titleTemplate: "No placeholder" }).success).toBe(false);
  });
  it("validates analytics IDs so they can't inject script", () => {
    expect(settingSchemas.analytics.safeParse({ ga4MeasurementId: "G-ABC123" }).success).toBe(true);
    expect(settingSchemas.analytics.safeParse({ ga4MeasurementId: "');alert(1);//" }).success).toBe(false);
  });
});

describe("theme", () => {
  it("picks readable text on brand colours", () => {
    // Dark brand colours take white text; light ones (marigold) take the dark ink, whichever ink the theme uses.
    expect(readableOn("#2350F0")).toBe("#FFFFFF");
    expect(readableOn("#FFB020")).not.toBe("#FFFFFF");
    expect(contrastRatio(readableOn("#FFB020"), "#FFB020")).toBeGreaterThan(4.5);
    expect(contrastRatio("#FFFFFF", "#2350F0")).toBeGreaterThan(4.5);
  });
  it("emits RGB channel variables", () => {
    const v = themeVariables({ primary: "#2B3A8C", accent: "#F2A007", ink: "#172033", background: "#F6F7FB", surface: "#FFFFFF", success: "#1E7F5C", radius: "soft" });
    expect(v["--color-primary"]).toBe("43 58 140");
    expect(v["--radius-panel"]).toBe("10px");
  });
});
