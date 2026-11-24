import "server-only";
import { z } from "zod";
import { revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { audit, auditAccess } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { sanitizeRichText } from "@/server/sanitize";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { isBuyerRoleKey } from "@/server/rbac/permissions";
import { appliesTo, compareVersions, needsAcceptance, nextVersion, scheduledVersions, VERSION_RE, versionInForce } from "@/lib/compliance/legal";
import { maskEmail } from "@/lib/mask";

const TAG = "legal-docs";
const bust = () => revalidateTag(TAG);

// Top-level website addresses a document can't take.
const RESERVED = new Set(["admin", "account", "vendor", "reseller", "api", "login", "signup", "blog", "brands", "budget", "categories", "compare", "customer-type", "deployment", "feature", "industries", "licensing", "list-your-software", "become-a-reseller", "operating-system", "platform", "profession", "resellers", "search", "software", "use-case", "vendors", "uploads", "privacy-center"]);

// ─── Public ─────────────────────────────────────────────────────────────────

export interface PublicLegalVersion { id: string; version: string; title: string; content: string; summaryOfChanges: string | null; effectiveAt: Date }
export interface PublicLegalDoc { id: string; key: string; title: string; slug: string; current: PublicLegalVersion; shown: PublicLegalVersion; history: { version: string; effectiveAt: Date }[]; upcoming: { version: string; effectiveAt: Date } | null }

const loadPublic = unstable_cache(
  async (slug: string) => {
    const doc = await db.legalDocument.findUnique({
      where: { slug },
      include: { versions: { where: { status: "PUBLISHED" }, select: { id: true, version: true, title: true, content: true, summaryOfChanges: true, effectiveAt: true, status: true } } },
    });
    if (!doc || !doc.isActive) return null;
    return { id: doc.id, key: doc.key, title: doc.title, slug: doc.slug, versions: doc.versions };
  },
  ["legal-public"],
  // Scheduled versions come into force within five minutes without an edit.
  { tags: [TAG], revalidate: 300 },
);

/** The document at /<slug>, in the version in force (or an earlier one with ?version=). Null when nothing is in force yet. */
export async function publicLegalDocument(slug: string, version?: string): Promise<PublicLegalDoc | null> {
  const doc = await loadPublic(slug).catch(() => null);
  if (!doc) return null;
  // unstable_cache serialises dates.
  const versions = doc.versions.map((v) => ({ ...v, effectiveAt: v.effectiveAt ? new Date(v.effectiveAt) : null }));
  const current = versionInForce(versions);
  if (!current) return null;
  const past = versions.filter((v) => v.effectiveAt && v.effectiveAt <= new Date()).sort((a, b) => +b.effectiveAt! - +a.effectiveAt!);
  const asked = version ? past.find((v) => v.version === version) : null;
  const pub = (v: typeof current): PublicLegalVersion => ({ id: v.id, version: v.version, title: v.title, content: v.content, summaryOfChanges: v.summaryOfChanges, effectiveAt: v.effectiveAt! });
  const up = scheduledVersions(versions)[0];
  return { id: doc.id, key: doc.key, title: doc.title, slug: doc.slug, current: pub(current), shown: pub(asked ?? current), history: past.map((v) => ({ version: v.version, effectiveAt: v.effectiveAt! })), upcoming: up ? { version: up.version, effectiveAt: up.effectiveAt! } : null };
}

/** A draft or scheduled version shown to staff with Compliance access (?legalPreview=<version id>). */
export async function previewLegalVersion(user: Principal | null, slug: string, versionId: string) {
  if (!user || !can(user, "compliance.view")) return null;
  const v = await db.legalDocumentVersion.findFirst({ where: { id: versionId, document: { slug } }, include: { document: { select: { title: true, slug: true } } } });
  return v ? { title: v.title, content: v.content, version: v.version, status: v.status, effectiveAt: v.effectiveAt } : null;
}

// ─── Acceptance ─────────────────────────────────────────────────────────────

/** The versions in force of these documents (by key), for recording acceptance at sign-up. */
export async function versionsInForce(keys: string[]) {
  const docs = await db.legalDocument.findMany({ where: { key: { in: keys }, isActive: true }, include: { versions: { where: { status: "PUBLISHED" }, select: { id: true, status: true, effectiveAt: true, version: true } } } });
  return docs.flatMap((d) => {
    const v = versionInForce(d.versions);
    return v ? [{ documentId: d.id, versionId: v.id, key: d.key }] : [];
  });
}

export async function recordAcceptances(person: { userId: string | null; email: string }, items: { documentId: string; versionId: string }[], ctx: { context: "signup" | "reacceptance" | "vendor_onboarding" | "admin"; ipHash: string | null; userAgent: string | null }) {
  if (!items.length) return;
  await db.legalAcceptance.createMany({
    data: items.map((i) => ({ userId: person.userId, email: person.email.toLowerCase(), documentId: i.documentId, versionId: i.versionId, context: ctx.context, ipHash: ctx.ipHash, userAgent: ctx.userAgent?.slice(0, 300) ?? null })),
  });
}

async function whoIs(user: Principal): Promise<"buyer" | "vendor" | "reseller" | "staff"> {
  if (isBuyerRoleKey(user.roleKey)) return "buyer";
  if (!user.vendorId) return "staff";
  const v = await db.vendor.findUnique({ where: { id: user.vendorId }, select: { kind: true } });
  return v?.kind === "RESELLER" ? "reseller" : "vendor";
}

/** Documents the signed-in person must accept (a new version that asks for it). Empty for staff. */
export async function pendingAcceptances(user: Principal) {
  const who = await whoIs(user);
  if (who === "staff") return [];
  const [docs, accepted] = await Promise.all([
    db.legalDocument.findMany({
      where: { isActive: true, requiresAcceptance: true },
      orderBy: { sortOrder: "asc" },
      include: { versions: { where: { status: "PUBLISHED" }, select: { id: true, status: true, effectiveAt: true, version: true, requireReacceptance: true, summaryOfChanges: true } } },
    }),
    db.legalAcceptance.findMany({ where: { userId: user.id }, select: { versionId: true } }),
  ]);
  const ids = new Set(accepted.map((a) => a.versionId));
  return docs.flatMap((d) => {
    if (!appliesTo(d.audience, who)) return [];
    const v = versionInForce(d.versions);
    return v && needsAcceptance(d, v, ids) ? [{ documentId: d.id, versionId: v.id, title: d.title, slug: d.slug, version: v.version, summary: v.summaryOfChanges }] : [];
  });
}

/** "I accept" on the update notice: records every pending version the person was shown. */
export async function acceptPending(user: Principal, versionIds: string[], meta: { ipHash: string | null; userAgent: string | null }) {
  const pending = (await pendingAcceptances(user)).filter((p) => versionIds.includes(p.versionId));
  if (!pending.length) return 0;
  await recordAcceptances({ userId: user.id, email: user.email }, pending, { context: "reacceptance", ...meta });
  await audit({ actorId: user.id, actorType: (await whoIs(user)) === "buyer" ? "buyer" : "vendor", action: "legal.accepted", entityType: "legalDocument", entityId: pending.map((p) => p.documentId).join(","), summary: `Accepted ${pending.map((p) => `${p.title} v${p.version}`).join(", ")}` });
  return pending.length;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function listLegalDocuments(user: Principal) {
  assertCan(user, "compliance.view");
  const [docs, counts] = await Promise.all([
    db.legalDocument.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }], include: { versions: { select: { id: true, version: true, status: true, effectiveAt: true, legalReviewed: true } } } }),
    db.legalAcceptance.groupBy({ by: ["versionId"], _count: { _all: true } }),
  ]);
  const byVersion = new Map(counts.map((c) => [c.versionId, c._count._all]));
  return docs.map((d) => {
    const current = versionInForce(d.versions);
    return {
      ...d,
      current,
      scheduled: scheduledVersions(d.versions)[0] ?? null,
      drafts: d.versions.filter((v) => v.status === "DRAFT").length,
      acceptancesCurrent: current ? byVersion.get(current.id) ?? 0 : 0,
    };
  });
}

export async function getLegalDocument(user: Principal, id: string) {
  assertCan(user, "compliance.view");
  const doc = await db.legalDocument.findUnique({ where: { id }, include: { versions: { include: { _count: { select: { acceptances: true } } } } } });
  if (!doc) throw notFound("Document");
  const versions = [...doc.versions].sort((a, b) => compareVersions(b.version, a.version));
  const publishers = await db.user.findMany({ where: { id: { in: versions.flatMap((v) => [v.publishedById, v.createdById].filter((x): x is string => Boolean(x))) } }, select: { id: true, name: true } });
  return { doc, versions, current: versionInForce(doc.versions), names: new Map(publishers.map((p) => [p.id, p.name])) };
}

export const legalDocumentInput = z.object({
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lower-case letters, numbers and hyphens").max(80).refine((s) => !RESERVED.has(s), "This address is used by another part of the website"),
  key: z.string().trim().regex(/^[a-z0-9-]{2,60}$/, "Lower-case letters, numbers and hyphens"),
  audience: z.enum(["all", "buyer", "vendor", "reseller"]).default("all"),
  requiresAcceptance: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export async function saveLegalDocument(user: Principal, id: string | null, data: z.infer<typeof legalDocumentInput>) {
  assertCan(user, "compliance.manage");
  const clash = await db.legalDocument.findFirst({ where: { OR: [{ slug: data.slug }, { key: data.key }], ...(id ? { NOT: { id } } : {}) }, select: { id: true } });
  if (clash) throw new AppError("Another document already uses this key or address.", "CONFLICT", { slug: ["Already in use"] });
  if (id) {
    const before = await db.legalDocument.findUnique({ where: { id } });
    if (!before) throw notFound("Document");
    if (before.key !== data.key) throw new AppError("The key can't change: the website uses it to find the document.", "BAD_REQUEST", { key: ["Can't change"] });
    await db.legalDocument.update({ where: { id }, data });
    await audit({ actorId: user.id, action: "compliance.legal_document_updated", entityType: "legalDocument", entityId: id, summary: `Edited legal document ${data.title}`, diff: { before: { title: before.title, slug: before.slug, audience: before.audience, requiresAcceptance: before.requiresAcceptance }, after: data } });
  } else {
    const d = await db.legalDocument.create({ data });
    await audit({ actorId: user.id, action: "compliance.legal_document_created", entityType: "legalDocument", entityId: d.id, summary: `Added legal document ${data.title}` });
  }
  bust();
}

export async function toggleLegalDocument(user: Principal, id: string, isActive: boolean) {
  assertCan(user, "compliance.manage");
  const d = await db.legalDocument.update({ where: { id }, data: { isActive } });
  await audit({ actorId: user.id, action: "compliance.legal_document_toggled", entityType: "legalDocument", entityId: id, summary: `${isActive ? "Switched on" : "Switched off"} legal document ${d.title}` });
  bust();
}

/** New draft, starting from the latest version's text (or empty). One draft per document at a time. */
export async function createDraft(user: Principal, documentId: string): Promise<string> {
  assertCan(user, "compliance.manage");
  const doc = await db.legalDocument.findUnique({ where: { id: documentId }, include: { versions: true } });
  if (!doc) throw notFound("Document");
  const draft = doc.versions.find((v) => v.status === "DRAFT");
  if (draft) return draft.id;
  const latest = [...doc.versions].filter((v) => v.status !== "DRAFT").sort((a, b) => compareVersions(b.version, a.version))[0];
  const v = await db.legalDocumentVersion.create({
    data: { documentId, version: nextVersion(doc.versions.map((x) => x.version)), title: latest?.title ?? doc.title, content: latest?.content ?? "", createdById: user.id },
  });
  await audit({ actorId: user.id, action: "compliance.legal_draft_created", entityType: "legalDocument", entityId: documentId, summary: `Started ${doc.title} v${v.version} (draft)` });
  return v.id;
}

export const draftInput = z.object({
  version: z.string().trim().regex(VERSION_RE, "Use numbers like 1.0 or 2.1"),
  title: z.string().trim().min(2).max(160),
  content: z.string().max(400_000),
  summaryOfChanges: z.string().trim().max(2000).optional().nullable(),
  requireReacceptance: z.boolean().default(false),
  legalReviewed: z.boolean().default(false),
  legalReviewNote: z.string().trim().max(1000).optional().nullable(),
});

async function draftOf(id: string) {
  const v = await db.legalDocumentVersion.findUnique({ where: { id }, include: { document: true } });
  if (!v) throw notFound("Version");
  return v;
}

export async function saveDraft(user: Principal, id: string, data: z.infer<typeof draftInput>) {
  assertCan(user, "compliance.manage");
  const v = await draftOf(id);
  if (v.status !== "DRAFT") {
    // Only the review note can change after publishing.
    await db.legalDocumentVersion.update({ where: { id }, data: { legalReviewed: data.legalReviewed, legalReviewNote: data.legalReviewNote || null } });
    await audit({ actorId: user.id, action: "compliance.legal_review_noted", entityType: "legalDocument", entityId: v.documentId, summary: `Updated legal review note on ${v.document.title} v${v.version}` });
    bust();
    return;
  }
  const clash = await db.legalDocumentVersion.findFirst({ where: { documentId: v.documentId, version: data.version, NOT: { id } }, select: { id: true } });
  if (clash) throw new AppError("This version number is already used.", "CONFLICT", { version: ["Already used"] });
  await db.legalDocumentVersion.update({
    where: { id },
    data: { version: data.version, title: data.title, content: sanitizeRichText(data.content) ?? "", summaryOfChanges: data.summaryOfChanges || null, requireReacceptance: data.requireReacceptance, legalReviewed: data.legalReviewed, legalReviewNote: data.legalReviewNote || null },
  });
  await audit({ actorId: user.id, action: "compliance.legal_draft_saved", entityType: "legalDocument", entityId: v.documentId, summary: `Saved ${v.document.title} v${data.version} (draft)` });
}

export async function deleteDraft(user: Principal, id: string) {
  assertCan(user, "compliance.manage");
  const v = await draftOf(id);
  if (v.status !== "DRAFT") throw new AppError("Only drafts can be deleted. Archive a published version instead.", "BAD_REQUEST");
  await db.legalDocumentVersion.delete({ where: { id } });
  await audit({ actorId: user.id, action: "compliance.legal_draft_deleted", entityType: "legalDocument", entityId: v.documentId, summary: `Deleted draft ${v.document.title} v${v.version}` });
}

/** Publishes a draft from a date (now or later). Its text is then fixed for good. */
export async function publishVersion(user: Principal, id: string, effectiveAt: Date | null) {
  assertCan(user, "compliance.manage");
  const v = await draftOf(id);
  if (v.status !== "DRAFT") throw new AppError("This version is already published.", "BAD_REQUEST");
  if (!sanitizeRichText(v.content)) throw new AppError("Add the document text before publishing.", "BAD_REQUEST");
  const at = effectiveAt ?? new Date();
  if (at.getTime() < Date.now() - 60_000) throw new AppError("The effective date can't be in the past: published versions are a record of what people saw from that date.", "BAD_REQUEST", { effectiveAt: ["Choose now or a later date"] });
  await db.legalDocumentVersion.update({ where: { id }, data: { status: "PUBLISHED", effectiveAt: at, publishedAt: new Date(), publishedById: user.id } });
  await audit({
    actorId: user.id,
    action: "compliance.legal_published",
    entityType: "legalDocument",
    entityId: v.documentId,
    summary: `Published ${v.document.title} v${v.version}, in force from ${at.toISOString().slice(0, 16).replace("T", " ")} UTC${v.requireReacceptance ? " (asks for re-acceptance)" : ""}${v.legalReviewed ? "" : " — not marked as legally reviewed"}`,
    metadata: { versionId: id, version: v.version, effectiveAt: at.toISOString(), legalReviewed: v.legalReviewed },
  });
  bust();
}

/** Withdraws a published version (it stays on record). If it was in force, the previous version applies again. */
export async function archiveVersion(user: Principal, id: string) {
  assertCan(user, "compliance.manage");
  const v = await draftOf(id);
  if (v.status !== "PUBLISHED") throw new AppError("Only published versions can be archived.", "BAD_REQUEST");
  await db.legalDocumentVersion.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ actorId: user.id, action: "compliance.legal_archived", entityType: "legalDocument", entityId: v.documentId, summary: `Archived ${v.document.title} v${v.version}` });
  bust();
}

const PAGE = 50;
export async function listAcceptances(user: Principal, documentId: string, page: number) {
  assertCan(user, "compliance.view");
  const where = { documentId };
  const [total, rows] = await Promise.all([
    db.legalAcceptance.count({ where }),
    db.legalAcceptance.findMany({ where, orderBy: { acceptedAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, select: { id: true, email: true, userId: true, context: true, acceptedAt: true, version: { select: { version: true } } } }),
  ]);
  const reveal = can(user, "compliance.sensitive");
  if (reveal && rows.length) {
    await auditAccess(user.id, "legalAcceptance", documentId, `Viewed ${rows.length} legal acceptance record${rows.length === 1 ? "" : "s"} with emails`, { page });
  }
  return { total, page, pages: Math.max(1, Math.ceil(total / PAGE)), masked: !reveal, rows: rows.map((r) => ({ ...r, email: reveal ? r.email : maskEmail(r.email) })) };
}
