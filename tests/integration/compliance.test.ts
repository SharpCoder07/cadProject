import { beforeEach, describe, expect, it, vi } from "vitest";

// Bell notifications are sent in the background (not awaited). In tests they could still be writing when the next
// test empties the database, which deadlocks the TRUNCATE, so they're switched off here.
vi.mock("@/server/notifications/notify", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/notifications/notify")>()), notify: vi.fn() }));
import { db } from "@/server/db";
import { sha256 } from "@/server/auth/tokens";
import { recordFormConsents, setMyConsent } from "@/server/services/compliance/consent";
import { recordCookieChoice } from "@/server/services/compliance/cookies";
import { acceptPending, archiveVersion, createDraft, pendingAcceptances, publicLegalDocument, publishVersion, saveDraft, versionsInForce } from "@/server/services/compliance/legal";
import { confirmCase, eraseForCase, exportForCase, listCases, submitCase, updateCase } from "@/server/services/compliance/cases";
import { RETENTION_JOBS, runDueRetention, saveRetentionRule } from "@/server/services/compliance/retention";
import { createIncident, incidentInput, updateIncident } from "@/server/services/compliance/incidents";
import { listVendorCompliance, saveVendorCompliance, vendorComplianceInput } from "@/server/services/compliance/vendors";
import { complianceOverview } from "@/server/services/compliance/overview";
import { makeUser, makeVendor, resetDb } from "./helpers";

const DAY = 86_400_000;
const purpose = (key: string, isNecessary: boolean, appliesTo: string[]) => db.consentPurpose.create({ data: { key, name: key, description: `${key} purpose`, isNecessary, appliesTo } });

describe("consent records", () => {
  beforeEach(resetDb);

  it("records signup consents and keeps the history when consent is withdrawn and given again", async () => {
    await purpose("account", true, ["signup", "account"]);
    const marketing = await purpose("marketing", false, ["signup", "account"]);
    await purpose("newsletter", false, ["account"]);
    const buyer = await makeUser("BUYER");

    // Necessary purposes are recorded automatically; unknown keys and purposes not on the form are ignored.
    expect(await recordFormConsents("signup", { userId: buyer.id, email: buyer.email, ipHash: null }, ["marketing", "newsletter", "bogus"])).toBe(2);

    await setMyConsent(buyer, "marketing", false, null);
    await setMyConsent(buyer, "marketing", false, null); // no-op
    await setMyConsent(buyer, "marketing", true, null);
    const rows = await db.userConsent.findMany({ where: { userId: buyer.id, purposeId: marketing.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.status)).toEqual(["WITHDRAWN", "GRANTED"]);
    expect(rows[0]!.withdrawnAt).not.toBeNull();
    await expect(setMyConsent(buyer, "account", false, null)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(await db.auditLog.count({ where: { action: { startsWith: "consent." }, actorId: buyer.id } })).toBe(2);
  });

  it("logs cookie choices, forcing necessary on and dropping unknown categories", async () => {
    await db.cookieCategory.create({ data: { key: "necessary", name: "Necessary", description: "Needed", isNecessary: true } });
    await db.cookieCategory.create({ data: { key: "analytics", name: "Analytics", description: "Stats" } });
    await recordCookieChoice({ visitorId: "visitor-1234", action: "custom", choices: { necessary: false, analytics: true, evil: true }, noticeVersion: "1.0" }, { userId: null, ipHash: null, userAgent: "vitest" });
    const log = await db.cookiePreference.findFirstOrThrow();
    expect(log.choices).toEqual({ necessary: true, analytics: true });
  });
});

describe("legal documents", () => {
  beforeEach(resetDb);

  it("publishes immutable versions, schedules updates, asks for re-acceptance and falls back when archived", async () => {
    const sa = await makeUser("SUPER_ADMIN");
    const doc = await db.legalDocument.create({ data: { key: "terms", title: "Terms of use", slug: "terms", requiresAcceptance: true } });

    const v1 = await createDraft(sa, doc.id);
    expect(await createDraft(sa, doc.id)).toBe(v1); // one draft at a time
    await saveDraft(sa, v1, { version: "1.0", title: "Terms of use", content: "<h2>Use</h2><p onclick=\"x()\">Be nice<script>alert(1)</script></p>", summaryOfChanges: null, requireReacceptance: true, legalReviewed: true, legalReviewNote: "Reviewed" });
    await expect(publishVersion(sa, v1, new Date(Date.now() - DAY))).rejects.toMatchObject({ code: "BAD_REQUEST" }); // no back-dating
    await publishVersion(sa, v1, null);

    // The database refuses to change or delete a published version.
    await expect(db.legalDocumentVersion.update({ where: { id: v1 }, data: { content: "<p>changed</p>" } })).rejects.toThrow();
    await expect(db.legalDocumentVersion.delete({ where: { id: v1 } })).rejects.toThrow();

    const live = await publicLegalDocument("terms");
    expect(live?.current.version).toBe("1.0");
    expect(live?.current.content).not.toContain("script");
    expect(live?.current.content).not.toContain("onclick");
    expect(await versionsInForce(["terms"])).toHaveLength(1);

    const buyer = await makeUser("BUYER");
    expect(await pendingAcceptances(sa)).toEqual([]); // staff are never asked
    expect((await pendingAcceptances(buyer)).map((p) => p.version)).toEqual(["1.0"]);
    expect(await acceptPending(buyer, [v1], { ipHash: null, userAgent: null })).toBe(1);
    expect(await pendingAcceptances(buyer)).toEqual([]);
    await expect(db.legalAcceptance.deleteMany({})).rejects.toThrow(); // acceptances are evidence

    const v2 = await createDraft(sa, doc.id);
    await saveDraft(sa, v2, { version: "1.1", title: "Terms of use", content: "<p>New terms</p>", summaryOfChanges: "Shorter", requireReacceptance: true, legalReviewed: false, legalReviewNote: null });
    await publishVersion(sa, v2, new Date(Date.now() + 7 * DAY));
    const scheduled = await publicLegalDocument("terms");
    expect(scheduled?.current.version).toBe("1.0");
    expect(scheduled?.upcoming?.version).toBe("1.1");

    await archiveVersion(sa, v1);
    expect(await publicLegalDocument("terms")).toBeNull(); // nothing in force: the Website page shows again
  });
});

describe("data requests and grievances", () => {
  beforeEach(resetDb);
  const request = { kind: "DATA_REQUEST" as const, type: "access" as const, name: "Riya", email: "riya@example.com", details: "Please send me a copy of my data." };

  it("opens signed-in requests at once and website requests only after the email link is confirmed", async () => {
    const buyer = await makeUser("BUYER");
    const mine = await submitCase(request, { user: buyer, ip: "203.0.113.20", source: "account" });
    expect(mine.verified).toBe(true);
    const opened = await db.privacyCase.findUniqueOrThrow({ where: { referenceNo: mine.referenceNo } });
    expect(opened.status).toBe("OPEN");
    expect(opened.email).toBe(buyer.email); // the session's email, not what was typed

    const web = await submitCase({ ...request, email: "someone@example.com" }, { user: null, ip: "203.0.113.21", source: "website" });
    expect(web.verified).toBe(false);
    const token = "test-token-abcdefghijklmnop";
    await db.privacyCase.update({ where: { referenceNo: web.referenceNo }, data: { verifyTokenHash: sha256(token) } });
    const pending = await db.privacyCase.findUniqueOrThrow({ where: { referenceNo: web.referenceNo } });
    expect(pending.status).toBe("PENDING_VERIFICATION");
    const sa = await makeUser("SUPER_ADMIN");
    await expect(updateCase(sa, pending.id, { status: null, message: "Hello", toRequester: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await confirmCase(token);
    const confirmed = await db.privacyCase.findUniqueOrThrow({ where: { id: pending.id } });
    expect(confirmed.status).toBe("OPEN");
    expect(confirmed.verification).toBe("email_link");
    expect(confirmed.verifyTokenHash).toBeNull();
    await expect(confirmCase(token)).rejects.toMatchObject({ code: "NOT_FOUND" }); // single use
  });

  it("needs an explanation to resolve, keeps an append-only history and limits access", async () => {
    const sa = await makeUser("SUPER_ADMIN");
    const admin = await makeUser("ADMIN");
    const buyer = await makeUser("BUYER");
    const { referenceNo } = await submitCase({ kind: "GRIEVANCE", type: "privacy", name: "B", email: "b@example.com", subject: "Spam", details: "I keep getting emails I didn't ask for." }, { user: buyer, ip: "203.0.113.22", source: "account" });
    const c = await db.privacyCase.findUniqueOrThrow({ where: { referenceNo } });

    await expect(listCases(admin, { kind: "GRIEVANCE", status: "ACTIVE", page: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateCase(sa, c.id, { status: "RESOLVED", message: "", toRequester: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await updateCase(sa, c.id, { status: "RESOLVED", message: "We've switched off marketing emails for you.", toRequester: false });
    const done = await db.privacyCase.findUniqueOrThrow({ where: { id: c.id }, include: { events: true } });
    expect(done.status).toBe("RESOLVED");
    expect(done.resolvedAt).not.toBeNull();
    expect(done.acknowledgedAt).not.toBeNull();
    expect(done.events.some((e) => e.type === "message" && !e.internal)).toBe(true);
    await expect(db.privacyCaseEvent.deleteMany({ where: { caseId: c.id } })).rejects.toThrow();
  });

  it("exports a person's data without secrets and erases a buyer account", async () => {
    const sa = await makeUser("SUPER_ADMIN");
    const buyer = await makeUser("BUYER");
    await db.user.update({ where: { id: buyer.id }, data: { passwordHash: "argon2-hash-secret" } });
    const sw = await db.software.create({ data: { name: "Books", slug: "books", status: "PUBLISHED" } });
    await db.productFavourite.create({ data: { userId: buyer.id, softwareId: sw.id } });
    await db.session.create({ data: { userId: buyer.id, tokenHash: "session-hash", expiresAt: new Date(Date.now() + DAY) } });
    await db.review.create({ data: { softwareId: sw.id, userId: buyer.id, authorName: "Real Name", authorEmail: buyer.email, rating: 5, title: "Great", body: "Works well for us." } });
    await db.lead.create({ data: { referenceNo: "CG-TEST1", name: "Real Name", email: buyer.email, phone: "+919876543210", source: "CONTACT_PAGE" } });

    const access = await submitCase(request, { user: buyer, ip: "203.0.113.23", source: "account" });
    const accessCase = await db.privacyCase.findUniqueOrThrow({ where: { referenceNo: access.referenceNo } });
    const { data } = await exportForCase(sa, accessCase.id);
    const json = JSON.stringify(data);
    expect(data.account?.email).toBe(buyer.email);
    expect(data.favourites).toHaveLength(1);
    expect(data.enquiries).toHaveLength(1);
    expect(json).not.toContain("argon2-hash-secret");
    expect(json).not.toContain("passwordHash");

    const erase = await submitCase({ ...request, type: "erasure" }, { user: buyer, ip: "203.0.113.24", source: "account" });
    const eraseCase = await db.privacyCase.findUniqueOrThrow({ where: { referenceNo: erase.referenceNo } });
    await eraseForCase(sa, eraseCase.id, { enquiries: true, confirm: "ERASE" });
    const user = await db.user.findUniqueOrThrow({ where: { id: buyer.id } });
    expect(user.email).toMatch(/@erased\.invalid$/);
    expect(user.name).toBe("Erased user");
    expect(user.passwordHash).toBeNull();
    expect(await db.session.count({ where: { userId: buyer.id } })).toBe(0);
    expect(await db.productFavourite.count({ where: { userId: buyer.id } })).toBe(0);
    expect((await db.review.findFirstOrThrow()).authorName).toBe("Former user");
    expect((await db.lead.findFirstOrThrow()).email).toMatch(/@erased\.invalid$/);
    expect(await db.auditLog.count({ where: { action: "privacy.erasure" } })).toBe(1);
  });

  it("refuses to erase staff or partner accounts", async () => {
    const sa = await makeUser("SUPER_ADMIN");
    const admin = await makeUser("ADMIN");
    const c = await db.privacyCase.create({ data: { referenceNo: "PR-STAFF1", kind: "DATA_REQUEST", type: "erasure", name: "Admin", email: admin.email, details: "Delete me please", source: "website", verification: "email_link", verifiedAt: new Date() } });
    await expect(eraseForCase(sa, c.id, { enquiries: false, confirm: "ERASE" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("data retention", () => {
  beforeEach(resetDb);

  it("enforces minimum periods and purges protected records only through retention", async () => {
    const sa = await makeUser("SUPER_ADMIN");
    const rule = await db.retentionRule.create({ data: { key: "audit_log", name: "Audit log", description: "x", action: "delete" } });
    await expect(saveRetentionRule(sa, rule.id, { retentionDays: 10, isActive: true, legalReviewed: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(saveRetentionRule(sa, rule.id, { retentionDays: null, isActive: true, legalReviewed: false })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await db.auditLog.create({ data: { actorId: null, action: "test.event", entityType: "test" } });
    await expect(db.auditLog.deleteMany({})).rejects.toThrow(); // append-only
    expect(await RETENTION_JOBS.audit_log!.run(new Date(Date.now() + DAY))).toBeGreaterThan(0);

    await db.privacyCase.create({ data: { referenceNo: "PR-OLD1", kind: "DATA_REQUEST", type: "access", status: "PENDING_VERIFICATION", name: "X", email: "x@example.com", details: "Old request", source: "website", events: { create: { type: "created" } } } });
    expect(await RETENTION_JOBS.privacy_unconfirmed!.run(new Date(Date.now() + DAY))).toBe(1);
    expect(await db.privacyCaseEvent.count()).toBe(0);

    await db.lead.create({ data: { referenceNo: "CG-OLD1", name: "Old", email: "old@example.com", phone: "+919876543210", source: "CONTACT_PAGE", createdAt: new Date(Date.now() - 400 * DAY) } });
    expect(await RETENTION_JOBS.lead_contact!.run(new Date(Date.now() - 365 * DAY))).toBe(1);
    expect((await db.lead.findFirstOrThrow()).name).toBe("Removed");
    expect(await RETENTION_JOBS.lead_contact!.count(new Date(Date.now() - 365 * DAY))).toBe(0); // not counted twice
  });

  it("runs switched-on rules once a day from the scheduled job", async () => {
    await db.retentionRule.create({ data: { key: "cookie_choices", name: "Cookie log", description: "x", action: "delete", retentionDays: 30, isActive: true } });
    await db.retentionRule.create({ data: { key: "lead_contact", name: "Leads", description: "x", action: "anonymise", retentionDays: 30, isActive: false } });
    await db.cookiePreference.create({ data: { visitorId: "old-visitor", choices: {}, action: "reject_all", noticeVersion: "1.0", createdAt: new Date(Date.now() - 60 * DAY) } });
    await db.cookiePreference.create({ data: { visitorId: "new-visitor", choices: {}, action: "accept_all", noticeVersion: "1.0" } });
    expect(await runDueRetention()).toEqual({ cookie_choices: 1 });
    expect(await db.cookiePreference.count()).toBe(1);
    expect(await runDueRetention()).toEqual({}); // already ran today
  });
});

describe("incidents, vendors and overview", () => {
  beforeEach(resetDb);
  const base = { title: "Leaked export", description: "A lead export was emailed to the wrong person.", severity: "HIGH", status: "OPEN", detectedAt: new Date().toISOString(), personalDataAffected: true, dataCategories: ["names", "emails"], affectedCount: 40, reportable: "undecided" };

  it("records incidents with an append-only history and needs a reporting decision before resolving", async () => {
    const sa = await makeUser("SUPER_ADMIN");
    const admin = await makeUser("ADMIN");
    await expect(createIncident(admin, incidentInput.parse(base))).rejects.toMatchObject({ code: "FORBIDDEN" });
    const id = await createIncident(sa, incidentInput.parse(base));
    await expect(updateIncident(sa, id, incidentInput.parse({ ...base, status: "RESOLVED" }))).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await updateIncident(sa, id, incidentInput.parse({ ...base, status: "RESOLVED", reportable: "no", decisionNote: "Recipient confirmed deletion; low risk." }), "Closed with the recipient's written confirmation.");
    const i = await db.securityIncident.findUniqueOrThrow({ where: { id }, include: { events: true } });
    expect(i.status).toBe("RESOLVED");
    expect(i.resolvedAt).not.toBeNull();
    expect(i.events.map((e) => e.type).sort()).toEqual(["created", "note", "update"]);
    await expect(db.incidentEvent.deleteMany({ where: { incidentId: id } })).rejects.toThrow();
  });

  it("keeps vendor compliance records and flags gaps on the overview", async () => {
    const sa = await makeUser("SUPER_ADMIN");
    const v = await makeVendor("acme");
    let list = await listVendorCompliance(sa);
    expect(list[0]?.compliance).toBeNull();
    expect((await complianceOverview(sa)).vendorsNoDpa).toBe(1);
    await saveVendorCompliance(sa, v.id, vendorComplianceInput.parse({ kycStatus: "verified", gstinVerified: true, dpaSigned: true, dpaSignedAt: "2026-11-01T10:00", dataRole: "independent" }));
    list = await listVendorCompliance(sa);
    expect(list[0]?.compliance?.kycStatus).toBe("verified");
    const o = await complianceOverview(sa);
    expect(o.vendorsNoDpa).toBe(0);
    expect(o.attention.some((a) => a.href === "/admin/compliance/retention")).toBe(true);
  });
});
