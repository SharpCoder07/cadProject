import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createSoftware, deleteSoftware, publishDueSoftware, setSoftwareStatus, updateSoftware } from "@/server/services/software";
import { softwareInput } from "@/lib/validation/software";
import { EMPTY_SOFTWARE } from "@/app/admin/software/load";
import { runListing } from "@/server/services/catalog";
import { searchParamsSchema } from "@/server/services/search";
import { decideRequest, proposeSoftware } from "@/server/services/approvals";
import { makeCategory, makeUser, makeVendor, resetDb } from "./helpers";

const input = (over: Record<string, unknown>) => softwareInput.parse({ ...EMPTY_SOFTWARE, ...over });

describe("software workflow", () => {
  beforeEach(resetDb);

  it("creates drafts, publishes and records revisions and audit entries", async () => {
    const pm = await makeUser("PRODUCT_MANAGER");
    const cat = await makeCategory("accounting");
    const sw = await createSoftware(pm, input({ name: "Books One", slug: "books-one", primaryCategoryId: cat.id, features: [{ title: "GST returns" }], plans: [{ name: "Basic", price: 500 }] }));
    expect(sw.status).toBe("DRAFT");
    await setSoftwareStatus(pm, [sw.id], "PUBLISHED");
    const after = await db.software.findUniqueOrThrow({ where: { id: sw.id }, include: { categories: true, features: true, plans: true } });
    expect(after.status).toBe("PUBLISHED");
    expect(after.publishedAt).not.toBeNull();
    expect(after.categories.map((c) => c.categoryId)).toEqual([cat.id]);
    expect(await db.revision.count({ where: { entityId: sw.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { entityId: sw.id } })).toBeGreaterThanOrEqual(2);
  });

  it("rejects duplicate slugs with a field error", async () => {
    const pm = await makeUser("PRODUCT_MANAGER");
    await createSoftware(pm, input({ name: "A", slug: "same" }));
    await expect(createSoftware(pm, input({ name: "B", slug: "same" }))).rejects.toMatchObject({ code: "CONFLICT", fieldErrors: { slug: expect.any(Array) } });
  });

  it("forbids roles without catalogue permissions", async () => {
    const editor = await makeUser("CONTENT_EDITOR");
    await expect(createSoftware(editor, input({ name: "X", slug: "x" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    const pm = await makeUser("PRODUCT_MANAGER");
    const sw = await createSoftware(pm, input({ name: "Y", slug: "y" }));
    await expect(deleteSoftware(pm, [sw.id])).rejects.toMatchObject({ code: "FORBIDDEN" }); // only admins delete
  });

  it("schedules publishing and publishes when due", async () => {
    const pm = await makeUser("PRODUCT_MANAGER");
    const sw = await createSoftware(pm, input({ name: "Later", slug: "later" }));
    const r = await setSoftwareStatus(pm, [sw.id], "PUBLISHED", new Date(Date.now() + 60_000));
    expect(r.scheduled).toBe(true);
    expect((await db.software.findUniqueOrThrow({ where: { id: sw.id } })).status).toBe("DRAFT");
    await db.software.update({ where: { id: sw.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
    expect(await publishDueSoftware()).toBe(1);
    expect((await db.software.findUniqueOrThrow({ where: { id: sw.id } })).status).toBe("PUBLISHED");
  });

  it("adds a redirect when a slug changes", async () => {
    const pm = await makeUser("PRODUCT_MANAGER");
    const sw = await createSoftware(pm, input({ name: "Old", slug: "old-name" }));
    await updateSoftware(pm, sw.id, input({ name: "New", slug: "new-name" }));
    const r = await db.redirect.findUnique({ where: { fromPath: "/software/old-name" } });
    expect(r?.toPath).toBe("/software/new-name");
  });
});

describe("vendor portal rules", () => {
  beforeEach(resetDb);

  it("never lets vendor users change the catalogue directly and keeps them to their own listings", async () => {
    const v1 = await makeVendor("v-one");
    const v2 = await makeVendor("v-two", { canPublish: true });
    const vendorUser = await makeUser("VENDOR", v1.id);
    const trusted = await makeUser("VENDOR", v2.id);
    const admin = await makeUser("ADMIN");

    // Every vendor change goes through Super Admin approval (services/approvals.ts), even with publishing rights.
    await expect(createSoftware(vendorUser, input({ name: "Mine", slug: "mine" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createSoftware(trusted, input({ name: "Fast", slug: "fast" }))).rejects.toMatchObject({ code: "FORBIDDEN" });

    const theirs = await createSoftware(admin, input({ name: "Theirs", slug: "theirs", vendorId: v2.id }));
    await expect(updateSoftware(vendorUser, theirs.id, input({ name: "Hacked", slug: "theirs" }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setSoftwareStatus(vendorUser, [theirs.id], "PUBLISHED")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(proposeSoftware(vendorUser, theirs.id, input({ name: "Hacked", slug: "theirs" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("saves a vendor's new product as a draft for approval and publishes it when the Super Admin approves", async () => {
    const v1 = await makeVendor("v-one");
    const v2 = await makeVendor("v-two");
    const vendorUser = await makeUser("VENDOR", v1.id);
    const superAdmin = await makeUser("SUPER_ADMIN");

    const { id } = await proposeSoftware(vendorUser, null, input({ name: "Mine", slug: "mine", vendorId: v2.id }));
    const draft = await db.software.findUniqueOrThrow({ where: { id } });
    expect(draft.vendorId).toBe(v1.id); // vendorId from the request is ignored
    expect(draft.status).toBe("DRAFT");
    await expect(setSoftwareStatus(vendorUser, [id], "PUBLISHED")).rejects.toMatchObject({ code: "FORBIDDEN" });

    const request = await db.approvalRequest.findFirstOrThrow({ where: { entityId: id, status: "PENDING" } });
    expect(request.action).toBe("CREATE");
    await decideRequest(superAdmin, request.id, "APPROVE");
    expect((await db.software.findUniqueOrThrow({ where: { id } })).status).toBe("PUBLISHED");
  });
});

describe("search and filters", () => {
  beforeEach(resetDb);

  it("finds by prefix and typo, filters by category subtree and pricing", async () => {
    const pm = await makeUser("PRODUCT_MANAGER");
    const root = await makeCategory("finance");
    const child = await makeCategory("gst", root.id, 1, `/${root.id}/`);
    await db.setting.create({ data: { key: "listing", value: { perPage: 18, sponsoredFirst: false } } });
    const a = await createSoftware(pm, input({ name: "Ledger Prime", slug: "ledger-prime", primaryCategoryId: child.id, pricingModel: "SUBSCRIPTION", startingPrice: 500 }));
    const b = await createSoftware(pm, input({ name: "Free Billing", slug: "free-billing", primaryCategoryId: root.id, pricingModel: "FREE" }));
    const c = await createSoftware(pm, input({ name: "Unrelated CRM", slug: "unrelated-crm" }));
    await setSoftwareStatus(pm, [a.id, b.id, c.id], "PUBLISHED");

    const run = (p: Record<string, unknown>, scope = {}) => runListing(searchParamsSchema.parse(p), scope);
    expect((await run({ q: "ledg" })).items.map((i) => i.slug)).toEqual(["ledger-prime"]);
    expect((await run({ q: "ledgr prime" })).items.map((i) => i.slug)).toContain("ledger-prime");
    const inRoot = await run({}, { categoryId: root.id });
    expect(inRoot.items.map((i) => i.slug).sort()).toEqual(["free-billing", "ledger-prime"]);
    expect((await run({ pricing: ["FREE"] }, { categoryId: root.id })).items.map((i) => i.slug)).toEqual(["free-billing"]);
    expect(inRoot.facets.pricing).toMatchObject({ FREE: 1, SUBSCRIPTION: 1 });
    expect((await run({ maxPrice: 100 })).items.map((i) => i.slug)).toEqual(["free-billing"]);
  });

  it("never returns drafts", async () => {
    const pm = await makeUser("PRODUCT_MANAGER");
    await createSoftware(pm, input({ name: "Hidden Draft", slug: "hidden-draft" }));
    expect((await runListing(searchParamsSchema.parse({ q: "hidden" }))).total).toBe(0);
  });
});
