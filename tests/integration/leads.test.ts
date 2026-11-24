import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createLead, exportLeadsCsv, getLead, listLeads, updateLead } from "@/server/services/leads";
import { leadSubmission } from "@/lib/validation/leads";
import { hit } from "@/server/rate-limit";
import { makeUser, makeVendor, resetDb } from "./helpers";

const meta = { ip: "203.0.113.9", userAgent: "vitest" };

async function product(slug: string, vendorId: string | null) {
  return db.software.create({ data: { name: slug, slug, status: "PUBLISHED", vendorId } });
}

describe("lead capture and pipeline", () => {
  beforeEach(resetDb);

  it("captures a lead with product, vendor, counters and a timeline", async () => {
    const v = await makeVendor("acme");
    const sw = await product("acme-books", v.id);
    const input = leadSubmission.parse({ name: "Asha", email: "asha@example.in", phone: "98765 43210", consent: true, softwareSlugs: ["acme-books"], source: "PRODUCT_PAGE" });
    const { id, referenceNo } = await createLead(input, meta);
    expect(referenceNo).toMatch(/^CG-/);
    const lead = await db.lead.findUniqueOrThrow({ where: { id }, include: { software: true, activities: true } });
    expect(lead.phone).toBe("+919876543210");
    expect(lead.vendorId).toBe(v.id);
    expect(lead.ipHash).not.toBe(meta.ip); // raw IPs are never stored
    expect(lead.software.map((s) => s.softwareId)).toEqual([sw.id]);
    expect(lead.activities.map((a) => a.type)).toEqual(["CREATED"]);
    expect((await db.software.findUniqueOrThrow({ where: { id: sw.id } })).enquiryCount).toBe(1);
  });

  it("assigns round-robin across sales users when enabled", async () => {
    await db.setting.create({ data: { key: "leads", value: { autoAssign: "round_robin", autoAssignRoleKey: "SALES_MANAGER" } } });
    const s1 = await makeUser("SALES_MANAGER");
    const s2 = await makeUser("SALES_MANAGER");
    const mk = () => createLead(leadSubmission.parse({ name: "B", email: "b@example.in", phone: "9876543211", consent: true }), meta);
    const a = await db.lead.findUniqueOrThrow({ where: { id: (await mk()).id } });
    const b = await db.lead.findUniqueOrThrow({ where: { id: (await mk()).id } });
    expect(new Set([a.assignedToId, b.assignedToId])).toEqual(new Set([s1.id, s2.id]));
  });

  it("records status and assignment changes; analysts can view but not change", async () => {
    const sales = await makeUser("SALES_MANAGER");
    const analyst = await makeUser("ANALYST");
    const { id } = await createLead(leadSubmission.parse({ name: "C", email: "c@example.in", phone: "9876543212", consent: true }), meta);
    await updateLead(sales, { id, status: "CONTACTED", assignedToId: sales.id });
    const types = (await db.leadActivity.findMany({ where: { leadId: id } })).map((a) => a.type).sort();
    expect(types).toEqual(["ASSIGNED", "CREATED", "STATUS_CHANGED"]);
    await expect(getLead(analyst, id)).resolves.toBeTruthy();
    await expect(updateLead(analyst, { id, status: "WON" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("shows vendors only their own leads", async () => {
    const v1 = await makeVendor("one");
    const v2 = await makeVendor("two");
    await product("p1", v1.id);
    await product("p2", v2.id);
    const l1 = await createLead(leadSubmission.parse({ name: "D", email: "d@example.in", phone: "9876543213", consent: true, softwareSlugs: ["p1"] }), meta);
    const l2 = await createLead(leadSubmission.parse({ name: "E", email: "e@example.in", phone: "9876543214", consent: true, softwareSlugs: ["p2"] }), meta);
    const vendor = await makeUser("VENDOR", v1.id);
    const list = await listLeads(vendor, { status: "ALL" });
    expect(list.items.map((l) => l.id)).toEqual([l1.id]);
    await expect(getLead(vendor, l2.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("exports CSV with formula injection neutralised and audits the export", async () => {
    const admin = await makeUser("ADMIN");
    await createLead(leadSubmission.parse({ name: "=cmd|' /C calc'!A0", email: "f@example.in", phone: "9876543215", consent: true }), meta);
    let csv = "";
    for await (const chunk of exportLeadsCsv(admin, { status: "ALL" })) csv += chunk;
    expect(csv.split("\n")[1]).toContain("'=cmd");
    expect(await db.auditLog.count({ where: { action: "leads.export" } })).toBe(1);
    const analyst = await makeUser("ANALYST");
    await expect(exportLeadsCsv(analyst, {}).next()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("rate limiting", () => {
  beforeEach(resetDb);
  it("blocks after the limit within a window", async () => {
    const rule = { name: "test", limit: 2, windowSeconds: 60 };
    expect((await hit(rule, "ip")).ok).toBe(true);
    expect((await hit(rule, "ip")).ok).toBe(true);
    expect((await hit(rule, "ip")).ok).toBe(false);
    expect((await hit(rule, "other")).ok).toBe(true);
  });
});
