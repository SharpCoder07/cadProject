import "server-only";
import { z } from "zod";
import type { ConsentStatus, Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { audit, auditAccess } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { getSettings } from "@/server/settings";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { consentTransition } from "@/lib/compliance/consent";
import { maskEmail } from "@/lib/mask";

/** Consent purposes shown on a form ("signup", "enquiry", "account"). */
export async function purposesFor(where: "signup" | "enquiry" | "account") {
  return db.consentPurpose.findMany({
    where: { isActive: true, appliesTo: { has: where } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, key: true, name: true, description: true, isNecessary: true },
  });
}

const noticeVersion = async () => (await getSettings()).compliance.privacyNoticeVersion || "1.0";

/**
 * Records the consents given on a form: every necessary purpose of that form, plus the optional ones the person
 * ticked (unknown or inactive keys are ignored). Pass `tx` to keep it atomic with the account or enquiry.
 */
export async function recordFormConsents(
  form: "signup" | "enquiry",
  person: { userId: string | null; email: string; ipHash: string | null },
  optionalKeys: string[],
  tx: Tx | typeof db = db,
): Promise<number> {
  const purposes = await tx.consentPurpose.findMany({ where: { isActive: true, appliesTo: { has: form } }, select: { id: true, key: true, isNecessary: true } });
  const chosen = purposes.filter((p) => p.isNecessary || optionalKeys.includes(p.key));
  if (!chosen.length) return 0;
  const version = await noticeVersion();
  const email = person.email.trim().toLowerCase();
  await tx.userConsent.createMany({
    data: chosen.map((p) => ({ userId: person.userId, email, purposeId: p.id, noticeVersion: version, source: form, ipHash: person.ipHash })),
  });
  return chosen.length;
}

/** The signed-in person's consents, for Account › Settings. */
export async function myConsents(user: Principal) {
  const [purposes, open] = await Promise.all([
    purposesFor("account"),
    db.userConsent.findMany({ where: { userId: user.id, status: "GRANTED" }, select: { purposeId: true, grantedAt: true } }),
  ]);
  const since = new Map(open.map((c) => [c.purposeId, c.grantedAt]));
  return purposes.map((p) => ({ ...p, granted: p.isNecessary || since.has(p.id), since: since.get(p.id) ?? null }));
}

/** Turns one optional purpose on or off for the signed-in person. Necessary purposes can't be switched here. */
export async function setMyConsent(user: Principal, purposeKey: string, granted: boolean, ipHash: string | null): Promise<void> {
  const purpose = await db.consentPurpose.findUnique({ where: { key: purposeKey } });
  if (!purpose || !purpose.isActive || !purpose.appliesTo.includes("account")) throw notFound("Consent option");
  if (purpose.isNecessary) throw new AppError("This is needed for the service you use and can't be switched off here. To stop it, close your account or contact us.", "BAD_REQUEST");
  const open = await db.userConsent.findFirst({ where: { userId: user.id, purposeId: purpose.id, status: "GRANTED" }, orderBy: { grantedAt: "desc" }, select: { id: true } });
  const step = consentTransition(open, granted);
  if (!step) return;
  await db.$transaction(async (tx) => {
    if (step.op === "create") {
      await tx.userConsent.create({ data: { userId: user.id, email: user.email.toLowerCase(), purposeId: purpose.id, noticeVersion: await noticeVersion(), source: "account", ipHash } });
    } else {
      await tx.userConsent.update({ where: { id: step.id }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawSource: "account" } });
    }
    await audit({ actorId: user.id, actorType: user.vendorId ? "vendor" : user.roleKey === "BUYER" ? "buyer" : "staff", action: granted ? "consent.granted" : "consent.withdrawn", entityType: "consent", entityId: purpose.key, summary: `${granted ? "Gave" : "Withdrew"} consent: ${purpose.name}` }, tx);
  });
}

/** Has this email an open consent for the purpose? (For marketing sends.) */
export async function hasConsent(email: string, purposeKey: string): Promise<boolean> {
  const n = await db.userConsent.count({ where: { email: email.trim().toLowerCase(), status: "GRANTED", purpose: { key: purposeKey, isActive: true } } });
  return n > 0;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export const consentListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  purpose: z.string().max(40).optional(),
  status: z.enum(["GRANTED", "WITHDRAWN"]).optional(),
  source: z.enum(["signup", "enquiry", "account", "admin"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
export type ConsentListQuery = z.infer<typeof consentListQuery>;
const PAGE = 50;

/** Consent records. Emails are masked unless the viewer has "view personal data"; unmasked views are logged. */
export async function listConsents(user: Principal, query: ConsentListQuery) {
  assertCan(user, "compliance.view");
  const where: Prisma.UserConsentWhereInput = {
    ...(query.purpose ? { purpose: { key: query.purpose } } : {}),
    ...(query.status ? { status: query.status as ConsentStatus } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.q ? { email: { contains: query.q.toLowerCase() } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.userConsent.count({ where }),
    db.userConsent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * PAGE,
      take: PAGE,
      select: { id: true, email: true, userId: true, status: true, noticeVersion: true, source: true, grantedAt: true, withdrawnAt: true, withdrawSource: true, purpose: { select: { key: true, name: true, isNecessary: true } } },
    }),
  ]);
  const reveal = can(user, "compliance.sensitive");
  if (reveal && rows.length) await auditAccess(user.id, "consent", "list", `Viewed ${rows.length} consent record${rows.length === 1 ? "" : "s"} with emails`, { page: query.page, filters: { ...query, page: undefined } });
  return { total, page: query.page, pages: Math.max(1, Math.ceil(total / PAGE)), masked: !reveal, rows: rows.map((r) => ({ ...r, email: reveal ? r.email : maskEmail(r.email) })) };
}

export async function consentStats(user: Principal) {
  assertCan(user, "compliance.view");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [granted, withdrawn30, granted30, byPurpose] = await Promise.all([
    db.userConsent.count({ where: { status: "GRANTED" } }),
    db.userConsent.count({ where: { withdrawnAt: { gte: since } } }),
    db.userConsent.count({ where: { grantedAt: { gte: since } } }),
    db.userConsent.groupBy({ by: ["purposeId", "status"], _count: { _all: true } }),
  ]);
  return { granted, withdrawn30, granted30, byPurpose: byPurpose.map((b) => ({ purposeId: b.purposeId, status: b.status, count: b._count._all })) };
}

export const purposeInput = z.object({
  key: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, "Lower-case letters, numbers and _ only"),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(1000),
  isNecessary: z.boolean().default(false),
  appliesTo: z.array(z.enum(["signup", "enquiry", "account"])).max(3).default([]),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

/** Adds or edits a purpose. The key can't change once records use it (the history must still make sense). */
export async function savePurpose(user: Principal, id: string | null, raw: unknown) {
  assertCan(user, "compliance.manage");
  const data = purposeInput.parse(raw);
  if (id) {
    const before = await db.consentPurpose.findUnique({ where: { id }, include: { _count: { select: { consents: true } } } });
    if (!before) throw notFound("Purpose");
    if (before.key !== data.key && before._count.consents) throw new AppError("This purpose already has consent records, so its key can't change. Add a new purpose instead.", "BAD_REQUEST");
    await db.consentPurpose.update({ where: { id }, data });
    await audit({ actorId: user.id, action: "consent.purpose_updated", entityType: "consentPurpose", entityId: id, summary: `Edited consent purpose ${data.name}`, diff: { before: { name: before.name, description: before.description, isNecessary: before.isNecessary, appliesTo: before.appliesTo }, after: data } });
  } else {
    if (await db.consentPurpose.findUnique({ where: { key: data.key } })) throw new AppError("A purpose with this key already exists.", "BAD_REQUEST");
    const created = await db.consentPurpose.create({ data });
    await audit({ actorId: user.id, action: "consent.purpose_created", entityType: "consentPurpose", entityId: created.id, summary: `Added consent purpose ${data.name}` });
  }
}

/** Purposes are switched off rather than deleted, so past records keep their meaning. */
export async function togglePurpose(user: Principal, id: string, isActive: boolean) {
  assertCan(user, "compliance.manage");
  const p = await db.consentPurpose.update({ where: { id }, data: { isActive } });
  await audit({ actorId: user.id, action: "consent.purpose_toggled", entityType: "consentPurpose", entityId: id, summary: `${isActive ? "Switched on" : "Switched off"} consent purpose ${p.name}` });
}
