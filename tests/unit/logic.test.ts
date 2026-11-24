import { describe, expect, it } from "vitest";
import { csvCell, referenceNo, spamReason } from "@/server/services/leads";
import { leadSubmission } from "@/lib/validation/leads";
import { toPrefixTsQuery } from "@/server/services/search";
import { buildTree } from "@/server/services/categories";
import { embedUrl } from "@/lib/video";
import { formatPrice } from "@/lib/format";

describe("lead helpers", () => {
  it("neutralises spreadsheet formulas in CSV", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+91 98765")).toBe("'+91 98765");
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe("\"a,b\"");
    expect(csvCell(null)).toBe("");
  });
  it("generates unambiguous reference numbers", () => {
    const r = referenceNo();
    expect(r).toMatch(/^CG-[A-HJ-NP-Z2-9]{6}$/);
  });
  it("flags bot-like submissions", () => {
    const base = leadSubmission.parse({ name: "A", email: "a@b.in", phone: "+919876543210", consent: true });
    expect(spamReason({ ...base, website: "x" })).toBe("honeypot");
    expect(spamReason({ ...base, startedAt: 1000 }, 2000)).toBe("too-fast");
    expect(spamReason({ ...base, message: "http://a http://b http://c" })).toBe("links");
    expect(spamReason({ ...base, startedAt: 1000 }, 20_000)).toBeNull();
  });
});

describe("search query building", () => {
  it("builds prefix queries and strips operators", () => {
    expect(toPrefixTsQuery("Zoho  book")).toBe("zoho:* & book:*");
    expect(toPrefixTsQuery("a & b | !c")).toBe("a:* & b:* & c:*");
    expect(toPrefixTsQuery("   ")).toBeNull();
  });
});

describe("category tree", () => {
  it("nests children under parents", () => {
    const tree = buildTree([{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }, { id: "d", parentId: null }]);
    expect(tree.map((t) => t.id)).toEqual(["a", "d"]);
    expect(tree[0]!.children[0]!.id).toBe("b");
  });
});

describe("formatting", () => {
  it("formats INR with Indian grouping", () => {
    expect(formatPrice(150000)).toBe("₹1,50,000");
    expect(formatPrice(0)).toBe("Free");
    expect(formatPrice(null)).toBe("Price on request");
  });
  it("converts video URLs to privacy-friendly embeds", () => {
    expect(embedUrl("https://www.youtube.com/watch?v=abc123XYZ")).toBe("https://www.youtube-nocookie.com/embed/abc123XYZ");
    expect(embedUrl("https://vimeo.com/12345")).toBe("https://player.vimeo.com/video/12345");
    expect(embedUrl("https://evil.example/video")).toBeNull();
  });
});

describe("email templates", () => {
  it("escapes values in HTML but keeps server-built blocks and plain-text subjects", async () => {
    const { fillTokens, htmlToText, detailsTable } = await import("@/server/email/templates");
    expect(fillTokens("<p>Hi {{lead_name}}</p>", { lead_name: "<script>x</script>" }, "html")).toBe("<p>Hi &lt;script&gt;x&lt;/script&gt;</p>");
    expect(fillTokens("New lead: {{lead_name}}{{missing}}", { lead_name: "A & B" }, "text")).toBe("New lead: A & B");
    const table = detailsTable([["Name", "<b>Ravi</b>"], ["City", null]]);
    expect(fillTokens("{{lead_details}}", { lead_details: table }, "html")).toBe(table);
    expect(table).toContain("&lt;b&gt;Ravi&lt;/b&gt;");
    expect(table).not.toContain("City");
    expect(htmlToText('<p>Hello</p><p><a href="https://x.in/r">Reset</a></p>')).toBe("Hello\nReset: https://x.in/r");
  });

  it("keeps sign-in emails switched on", async () => {
    const { TEMPLATES } = await import("@/server/email/templates");
    expect(TEMPLATES.user_invite.required).toBe(true);
    expect(TEMPLATES.password_reset.required).toBe(true);
    for (const t of Object.values(TEMPLATES)) for (const tok of t.subject.match(/\{\{(\w+)\}\}/g) ?? []) expect(t.tokens).toContain(tok.slice(2, -2));
  });
});
