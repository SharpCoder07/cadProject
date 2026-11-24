import "server-only";
import { z } from "zod";
import type { Prisma, PrivacyCaseKind, PrivacyCaseStatus } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit, auditAccess } from "@/server/audit";
import { AppError, forbidden, notFound } from "@/server/errors";
import { getSettings } from "@/server/settings";
import { sendTemplate } from "@/server/email/config";
import { escapeHtml } from "@/server/email/templates";
import { notify } from "@/server/notifications/notify";
import { enforce, RULES } from "@/server/rate-limit";
import { hashIp } from "@/server/request";
import { randomToken, sha256 } from "@/server/auth/tokens";
import { referenceNo } from "@/server/services/leads";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { isBuyerRoleKey } from "@/server/rbac/permissions";
import { CONTENT_ACTIONS, caseTargets, KIND_WORD, nextStatuses, OPEN_STATUSES, STATUS_LABEL, typeLabel, type CaseKind, type CaseStatus, type CaseSubmission } from "@/lib/compliance/cases";
import { maskEmail, maskPhone } from "@/lib/mask";

const VERIFY_TTL_MS = 72 * 60 * 60 * 1000;
const kindWord = (k: CaseKind) => KIND_WORD[k];
const PREFIX: Record<CaseKind, string> = { DATA_REQUEST: "PR", GRIEVANCE: "GR", CONTENT_COMPLAINT: "CR" };
export const CASE_PATH: Record<CaseKind, string> = { DATA_REQUEST: "requests", GRIEVANCE: "grievances", CONTENT_COMPLAINT: "content" };

async function contactBlock() {
  const c = (await getSettings()).compliance;
  const lines: string[] = [];
  if (c.grievanceOfficerName) lines.push(`Grievance officer: ${escapeHtml(c.grievanceOfficerName)}${c.grievanceOfficerDesignation ? `, ${escapeHtml(c.grievanceOfficerDesignation)}` : ""}`);
  const email = c.grievanceOfficerEmail || c.privacyEmail;
  if (email) lines.push(`Email: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`);
  return lines.length ? `<p style="color:#475569;font-size:13px">${lines.join("<br>")}</p>` : "";
}

/** Starts the clock: target dates from Compliance settings, emails the requester, tells staff. */
async function open(caseId: string) {
  const s = await getSettings();
  const c = await db.privacyCase.findUniqueOrThrow({ where: { id: caseId } });
  const t = caseTargets(c.kind, new Date(), s.compliance);
  const updated = await db.privacyCase.update({ where: { id: caseId }, data: { status: "OPEN", ...t } });
  const due = updated.dueAt
    ? `<p>We aim to respond by <strong>${updated.dueAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}</strong>.</p>`
    : "";
  await sendTemplate("privacy_received", c.email, {
    site_name: s.site.name,
    requester_name: c.name,
    reference: c.referenceNo,
    case_kind: kindWord(c.kind),
    case_type: typeLabel(c.kind, c.type),
    due_block: due,
    contact_block: await contactBlock(),
  }).catch((e) => console.error("[privacy] received email failed", e));
  notify({ staff: "compliance.view" }, {
    type: "privacy.case",
    title: `New ${kindWord(c.kind)}: ${typeLabel(c.kind, c.type)}`,
    body: `${c.referenceNo} · ${c.name}`,
    href: `/admin/compliance/${CASE_PATH[c.kind]}/${c.id}`,
  });
}

/**
 * A data request or complaint from the Privacy center. Signed in: verified by the session and opened at once.
 * Signed out: kept until the person confirms the emailed link (so nobody can make requests about someone else).
 */
export async function submitCase(input: CaseSubmission, ctx: { user: Principal | null; ip: string | null; source: "account" | "website" }) {
  const ipHash = hashIp(ctx.ip);
  // Bots filling the hidden field get the same answer and nothing is stored.
  if (input.website) return { referenceNo: referenceNo(PREFIX[input.kind]), verified: Boolean(ctx.user) };
  await enforce(RULES.privacyCase, ipHash ?? "unknown", "Too many requests from this network. Try again in an hour, or write to us by email.");
  const signedIn = ctx.user;
  const token = signedIn ? null : randomToken();
  const c = await db.privacyCase.create({
    data: {
      referenceNo: referenceNo(PREFIX[input.kind]),
      kind: input.kind,
      type: input.type,
      status: signedIn ? "OPEN" : "PENDING_VERIFICATION",
      userId: signedIn?.id ?? null,
      name: input.name,
      email: signedIn ? signedIn.email.toLowerCase() : input.email,
      phone: input.phone || null,
      subject: input.kind === "GRIEVANCE" ? input.subject : null,
      contentUrl: input.kind === "CONTENT_COMPLAINT" ? input.contentUrl : null,
      declaration: input.kind === "CONTENT_COMPLAINT" ? input.declaration : false,
      details: input.details,
      verification: signedIn ? "signed_in" : null,
      verifiedAt: signedIn ? new Date() : null,
      verifyTokenHash: token ? sha256(token) : null,
      verifyExpiresAt: token ? new Date(Date.now() + VERIFY_TTL_MS) : null,
      source: ctx.source,
      ipHash,
      events: { create: { type: "created", internal: false, message: signedIn ? "Sent from a signed-in account" : "Sent from the website; waiting for email confirmation" } },
    },
  });
  await audit({ actorId: signedIn?.id ?? null, actorType: signedIn ? "buyer" : "public", action: `privacy.case_created`, entityType: "privacyCase", entityId: c.id, summary: `${kindWord(c.kind)} ${c.referenceNo} (${typeLabel(c.kind, c.type)})` });
  if (signedIn) {
    await open(c.id);
  } else {
    const s = await getSettings();
    await sendTemplate("privacy_verify", c.email, {
      site_name: s.site.name,
      requester_name: c.name,
      reference: c.referenceNo,
      case_kind: kindWord(c.kind),
      case_type: typeLabel(c.kind, c.type),
      verify_link: `${env.APP_URL}/privacy-center/confirm/${token}`,
    }).catch((e) => console.error("[privacy] verification email failed", e));
  }
  return { referenceNo: c.referenceNo, verified: Boolean(signedIn) };
}

/** The emailed "Confirm my request" link (a button, so link scanners can't use it up). */
export async function confirmCase(token: string) {
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(token)) throw new AppError("This link isn't valid.", "BAD_REQUEST");
  const c = await db.privacyCase.findUnique({ where: { verifyTokenHash: sha256(token) } });
  if (!c) throw new AppError("This link isn't valid or was already used.", "NOT_FOUND");
  if (c.status !== "PENDING_VERIFICATION") return { referenceNo: c.referenceNo, already: true };
  if (!c.verifyExpiresAt || c.verifyExpiresAt < new Date()) throw new AppError("This link has expired. Please send your request again.", "BAD_REQUEST");
  await db.privacyCase.update({
    where: { id: c.id },
    data: { verification: "email_link", verifiedAt: new Date(), verifyTokenHash: null, verifyExpiresAt: null, events: { create: { type: "verified", internal: false, message: "Email address confirmed" } } },
  });
  await audit({ actorId: null, actorType: "public", action: "privacy.case_verified", entityType: "privacyCase", entityId: c.id, summary: `${c.referenceNo} confirmed by email` });
  await open(c.id);
  return { referenceNo: c.referenceNo, already: false };
}

/** A buyer's own requests and complaints, with the updates shared with them. */
export async function myCases(user: Principal) {
  return db.privacyCase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, referenceNo: true, kind: true, type: true, status: true, subject: true, createdAt: true, dueAt: true, resolvedAt: true, resolution: true, events: { where: { internal: false }, orderBy: { createdAt: "asc" }, select: { id: true, type: true, message: true, createdAt: true } } },
  });
}

// ─── Personal data export ───────────────────────────────────────────────────

/** Everything held about one person (account and email), without secrets such as password hashes or 2FA keys. */
export async function buildDataExport(target: { userId: string | null; email: string }) {
  const email = target.email.toLowerCase();
  const user = target.userId
    ? await db.user.findUnique({ where: { id: target.userId }, select: { id: true, name: true, email: true, status: true, avatarUrl: true, createdAt: true, lastLoginAt: true, offerEmails: true, notifyOff: true, totpEnabledAt: true, role: { select: { name: true } }, vendor: { select: { name: true } } } })
    : null;
  const byUserOrEmail = <T extends string>(userKey: T, emailKey: string) => (user ? { OR: [{ [userKey]: user.id }, { [emailKey]: email }] } : { [emailKey]: email });
  const [consents, acceptances, cookieChoices, favourites, reviews, questions, leads, cases, sessions] = await Promise.all([
    db.userConsent.findMany({ where: byUserOrEmail("userId", "email") as Prisma.UserConsentWhereInput, include: { purpose: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db.legalAcceptance.findMany({ where: byUserOrEmail("userId", "email") as Prisma.LegalAcceptanceWhereInput, include: { document: { select: { title: true } }, version: { select: { version: true } } }, orderBy: { acceptedAt: "asc" } }),
    user ? db.cookiePreference.findMany({ where: { userId: user.id }, select: { choices: true, action: true, noticeVersion: true, createdAt: true } }) : [],
    user ? db.productFavourite.findMany({ where: { userId: user.id }, select: { createdAt: true, software: { select: { name: true, slug: true } } } }) : [],
    db.review.findMany({ where: byUserOrEmail("userId", "authorEmail") as Prisma.ReviewWhereInput, select: { createdAt: true, status: true, rating: true, title: true, pros: true, cons: true, body: true, authorName: true, authorRole: true, companyName: true, companySize: true, software: { select: { name: true } } } }),
    user ? db.productQuestion.findMany({ where: { userId: user.id }, select: { createdAt: true, status: true, question: true, answer: true, authorName: true, software: { select: { name: true } } } }) : [],
    db.lead.findMany({ where: { email }, select: { referenceNo: true, createdAt: true, name: true, email: true, phone: true, company: true, companySize: true, city: true, requirement: true, message: true, source: true, status: true, consent: true, software: { select: { software: { select: { name: true } } } } } }),
    db.privacyCase.findMany({ where: byUserOrEmail("userId", "email") as Prisma.PrivacyCaseWhereInput, select: { referenceNo: true, kind: true, type: true, status: true, createdAt: true, resolvedAt: true, resolution: true } }),
    user ? db.session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { createdAt: true, lastSeenAt: true, userAgent: true } }) : [],
  ]);
  return {
    generatedAt: new Date().toISOString(),
    note: "Personal data held about you on this platform. Passwords and two-step verification keys are stored only in protected form and are never included.",
    account: user
      ? { name: user.name, email: user.email, status: user.status, accountType: user.role.name, company: user.vendor?.name ?? null, createdAt: user.createdAt, lastSignIn: user.lastLoginAt, twoStepVerification: Boolean(user.totpEnabledAt), offerEmails: user.offerEmails, notificationsSwitchedOff: user.notifyOff, photo: user.avatarUrl }
      : null,
    activeSignIns: sessions,
    consents: consents.map((c) => ({ purpose: c.purpose.name, status: c.status, givenAt: c.grantedAt, withdrawnAt: c.withdrawnAt, where: c.source, noticeVersion: c.noticeVersion })),
    legalAcceptances: acceptances.map((a) => ({ document: a.document.title, version: a.version.version, acceptedAt: a.acceptedAt, where: a.context })),
    cookieChoices,
    favourites: favourites.map((f) => ({ product: f.software.name, savedAt: f.createdAt })),
    reviews: reviews.map((r) => ({ ...r, software: r.software.name })),
    questions: questions.map((q) => ({ ...q, software: q.software.name })),
    enquiries: leads.map((l) => ({ ...l, software: l.software.map((s) => s.software.name) })),
    dataRequestsAndComplaints: cases,
  };
}

/** Account › Privacy center › Download my data. */
export async function exportMyData(user: Principal) {
  await enforce(RULES.dataExport, user.id, "You've downloaded your data several times in the last hour. Try again later.");
  const data = await buildDataExport({ userId: user.id, email: user.email });
  await audit({ actorId: user.id, actorType: isBuyerRoleKey(user.roleKey) ? "buyer" : user.vendorId ? "vendor" : "staff", action: "privacy.self_export", entityType: "user", entityId: user.id, summary: "Downloaded their personal data" });
  return data;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export const caseListQuery = z.object({
  kind: z.enum(["DATA_REQUEST", "GRIEVANCE", "CONTENT_COMPLAINT"]),
  status: z.enum(["PENDING_VERIFICATION", "OPEN", "IN_PROGRESS", "AWAITING_REQUESTER", "RESOLVED", "REJECTED", "CLOSED", "ACTIVE", "OVERDUE", "ALL"]).default("ACTIVE"),
  type: z.string().max(40).optional(),
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
const PAGE = 30;

export async function listCases(user: Principal, query: z.infer<typeof caseListQuery>) {
  assertCan(user, "compliance.view");
  const now = new Date();
  const where: Prisma.PrivacyCaseWhereInput = {
    kind: query.kind,
    ...(query.type ? { type: query.type } : {}),
    ...(query.q ? { OR: [{ referenceNo: { contains: query.q.toUpperCase() } }, { email: { contains: query.q.toLowerCase() } }, { name: { contains: query.q, mode: "insensitive" } }] } : {}),
    ...(query.status === "ACTIVE"
      ? { status: { in: OPEN_STATUSES } }
      : query.status === "OVERDUE"
        ? { status: { in: OPEN_STATUSES }, OR: [{ dueAt: { lt: now } }, { ackDueAt: { lt: now }, acknowledgedAt: null }] }
        : query.status === "ALL"
          ? {}
          : { status: query.status as PrivacyCaseStatus }),
  };
  const [total, rows, counts, overdue] = await Promise.all([
    db.privacyCase.count({ where }),
    db.privacyCase.findMany({ where, orderBy: [{ createdAt: "desc" }], skip: (query.page - 1) * PAGE, take: PAGE, include: { assignedTo: { select: { name: true } } } }),
    db.privacyCase.groupBy({ by: ["status"], where: { kind: query.kind }, _count: { _all: true } }),
    db.privacyCase.count({ where: { kind: query.kind, status: { in: OPEN_STATUSES }, OR: [{ dueAt: { lt: now } }, { ackDueAt: { lt: now }, acknowledgedAt: null }] } }),
  ]);
  const reveal = can(user, "compliance.sensitive");
  return {
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / PAGE)),
    masked: !reveal,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Partial<Record<CaseStatus, number>>,
    overdue,
    rows: rows.map((r) => ({ ...r, email: reveal ? r.email : maskEmail(r.email) })),
  };
}

export async function getCase(user: Principal, id: string) {
  assertCan(user, "compliance.view");
  const c = await db.privacyCase.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true, status: true, createdAt: true, role: { select: { key: true, name: true } }, vendorId: true } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!c) throw notFound("Case");
  const reveal = can(user, "compliance.sensitive");
  if (reveal) await auditAccess(user.id, "privacyCase", c.id, `Opened ${c.referenceNo}`);
  const otherAccount = !c.userId ? await db.user.findUnique({ where: { email: c.email }, select: { id: true, name: true, role: { select: { key: true, name: true } } } }) : null;
  return {
    ...c,
    masked: !reveal,
    email: reveal ? c.email : maskEmail(c.email),
    phone: c.phone ? (reveal ? c.phone : maskPhone(c.phone)) : null,
    // A website request whose email matches an account (once confirmed, the email proves it's theirs).
    matchedAccount: otherAccount && c.verifiedAt ? otherAccount : null,
  };
}

async function load(id: string) {
  const c = await db.privacyCase.findUnique({ where: { id } });
  if (!c) throw notFound("Case");
  return c;
}

export async function assignCase(user: Principal, id: string, assigneeId: string | null) {
  assertCan(user, "compliance.manage");
  const c = await load(id);
  if (assigneeId) {
    const a = await db.user.findUnique({ where: { id: assigneeId }, select: { id: true, name: true, vendorId: true, role: { select: { key: true, permissions: { select: { permission: { select: { key: true } } } } } } } });
    const ok = a && !a.vendorId && (a.role.key === "SUPER_ADMIN" || a.role.permissions.some((p) => p.permission.key === "compliance.view"));
    if (!ok) throw new AppError("Assign it to someone with Compliance & Privacy access.", "BAD_REQUEST");
  }
  await db.privacyCase.update({ where: { id }, data: { assignedToId: assigneeId, events: { create: { type: "assigned", actorId: user.id, internal: true, message: assigneeId ? "Assigned" : "Unassigned", metadata: { assigneeId } } } } });
  await audit({ actorId: user.id, action: "privacy.case_assigned", entityType: "privacyCase", entityId: id, summary: `${c.referenceNo} ${assigneeId ? "assigned" : "unassigned"}` });
}

export const caseUpdateInput = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "AWAITING_REQUESTER", "RESOLVED", "REJECTED", "CLOSED"]).nullable(),
  message: z.string().trim().max(5000).optional().default(""),
  /** Email the message (and new status) to the requester; otherwise it's an internal note. */
  toRequester: z.boolean().default(false),
  /** Content complaints: what was done with the content. */
  actionTaken: z.enum(CONTENT_ACTIONS.map((a) => a.value) as [string, ...string[]]).nullable().optional(),
});

/** Status change, internal note, or message to the requester (emailed and shown in their account). */
export async function updateCase(user: Principal, id: string, input: z.infer<typeof caseUpdateInput>) {
  assertCan(user, "compliance.manage");
  const c = await load(id);
  const status = input.status && input.status !== c.status ? input.status : null;
  if (status && !nextStatuses(c.status).includes(status)) throw new AppError(`A case that's “${STATUS_LABEL[c.status]}” can't move to “${STATUS_LABEL[status]}”.`, "BAD_REQUEST");
  if (!status && !input.message && !(input.actionTaken && input.actionTaken !== c.actionTaken)) throw new AppError("Write a note or choose a new status.", "BAD_REQUEST", { message: ["Required"] });
  if ((status === "REJECTED" || status === "RESOLVED") && !input.message) throw new AppError("Explain the outcome: it's sent to the requester and kept on record.", "BAD_REQUEST", { message: ["Required when resolving or declining"] });
  if (c.status === "PENDING_VERIFICATION" && input.toRequester) throw new AppError("This request hasn't been confirmed yet, so we can't be sure the email belongs to the requester.", "BAD_REQUEST");
  const toRequester = input.toRequester || status === "RESOLVED" || status === "REJECTED";
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.privacyCase.update({
      where: { id },
      data: {
        ...(status ? { status } : {}),
        // Any reply or status change from staff counts as acknowledging it.
        ...(!c.acknowledgedAt && c.status !== "PENDING_VERIFICATION" ? { acknowledgedAt: now } : {}),
        ...(status === "RESOLVED" || status === "REJECTED" || status === "CLOSED" ? { resolvedAt: now, resolution: input.message || c.resolution } : {}),
        ...(status === "IN_PROGRESS" && c.resolvedAt ? { resolvedAt: null } : {}),
        ...(input.actionTaken && c.kind === "CONTENT_COMPLAINT" ? { actionTaken: input.actionTaken } : {}),
      },
    });
    if (input.actionTaken && c.kind === "CONTENT_COMPLAINT" && input.actionTaken !== c.actionTaken) {
      await tx.privacyCaseEvent.create({ data: { caseId: id, type: "action", actorId: user.id, internal: false, message: `Action on the content: ${CONTENT_ACTIONS.find((a) => a.value === input.actionTaken)?.label}` } });
    }
    if (status) await tx.privacyCaseEvent.create({ data: { caseId: id, type: "status", actorId: user.id, internal: false, message: `${STATUS_LABEL[c.status]} → ${STATUS_LABEL[status]}`, metadata: { from: c.status, to: status } } });
    if (input.message) await tx.privacyCaseEvent.create({ data: { caseId: id, type: toRequester ? "message" : "note", actorId: user.id, internal: !toRequester, message: input.message } });
    await audit({ actorId: user.id, action: "privacy.case_updated", entityType: "privacyCase", entityId: id, summary: `${c.referenceNo}: ${status ? `${STATUS_LABEL[c.status]} → ${STATUS_LABEL[status]}` : toRequester ? "message to requester" : "internal note"}` }, tx);
  });
  if (toRequester) {
    const s = await getSettings();
    await sendTemplate("privacy_update", c.email, {
      site_name: s.site.name,
      requester_name: c.name,
      reference: c.referenceNo,
      case_kind: kindWord(c.kind),
      case_type: typeLabel(c.kind, c.type),
      status: STATUS_LABEL[status ?? c.status],
      message_block: input.message ? `<div style="border-left:3px solid #0F766E;padding:4px 12px;margin:12px 0;white-space:pre-line">${escapeHtml(input.message)}</div>` : "",
      contact_block: await contactBlock(),
    }).catch((e) => console.error("[privacy] update email failed", e));
    if (c.userId) notify({ users: [c.userId] }, { type: "privacy.update", title: `Update on ${c.referenceNo}`, body: STATUS_LABEL[status ?? c.status], href: "/account/privacy" });
  }
}

/** Staff export for an access request: the requester's data as JSON. Needs "view personal data". */
export async function exportForCase(user: Principal, id: string) {
  assertCan(user, "compliance.manage");
  if (!can(user, "compliance.sensitive")) throw forbidden("Exporting someone's data needs the “view personal data” permission.");
  const c = await load(id);
  if (!c.verifiedAt) throw new AppError("Confirm the requester's identity first (the request isn't verified).", "BAD_REQUEST");
  const account = c.userId ?? (await db.user.findUnique({ where: { email: c.email }, select: { id: true } }))?.id ?? null;
  const data = await buildDataExport({ userId: account, email: c.email });
  await db.privacyCaseEvent.create({ data: { caseId: id, type: "export", actorId: user.id, internal: true, message: "Personal data export downloaded" } });
  await audit({ actorId: user.id, action: "privacy.export", entityType: "privacyCase", entityId: id, summary: `Exported personal data for ${c.referenceNo}` });
  return { fileName: `personal-data-${c.referenceNo}.json`, data };
}

/** Withdraws every open optional consent of the requester (consent withdrawal requests). */
export async function withdrawConsentsForCase(user: Principal, id: string) {
  assertCan(user, "compliance.manage");
  const c = await load(id);
  if (!c.verifiedAt) throw new AppError("The request isn't verified yet.", "BAD_REQUEST");
  const { count } = await db.userConsent.updateMany({
    where: { status: "GRANTED", purpose: { isNecessary: false }, OR: [{ email: c.email }, ...(c.userId ? [{ userId: c.userId }] : [])] },
    data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawSource: "admin" },
  });
  if (c.userId) await db.user.update({ where: { id: c.userId }, data: { offerEmails: false } });
  await db.privacyCaseEvent.create({ data: { caseId: id, type: "consent_withdrawn", actorId: user.id, internal: false, message: `Optional consents withdrawn (${count})` } });
  await audit({ actorId: user.id, action: "consent.withdrawn", entityType: "privacyCase", entityId: id, summary: `Withdrew ${count} optional consent${count === 1 ? "" : "s"} for ${c.referenceNo}` });
  return count;
}

export const erasureInput = z.object({
  /** Also blank the contact details on their past enquiries (vendors keep the enquiry itself). */
  enquiries: z.boolean().default(false),
  confirm: z.literal("ERASE", { errorMap: () => ({ message: "Type ERASE to confirm" }) }),
});

/**
 * Erasure for a buyer account: signs out everywhere, removes favourites, notifications and devices,
 * withdraws optional consents, anonymises reviews/questions and the account itself. Records needed as evidence
 * (consent and acceptance history, this case, the audit log) are kept. Staff and partner accounts are handled
 * by hand (they belong to a company or the team).
 */
export async function eraseForCase(user: Principal, id: string, opts: z.infer<typeof erasureInput>) {
  assertCan(user, "compliance.manage");
  const c = await load(id);
  if (c.kind !== "DATA_REQUEST" || c.type !== "erasure") throw new AppError("Erasure runs only on an erasure request.", "BAD_REQUEST");
  if (!c.verifiedAt) throw new AppError("The request isn't verified yet.", "BAD_REQUEST");
  const account = c.userId
    ? await db.user.findUnique({ where: { id: c.userId }, select: { id: true, email: true, role: { select: { key: true } }, vendorId: true } })
    : await db.user.findUnique({ where: { email: c.email }, select: { id: true, email: true, role: { select: { key: true } }, vendorId: true } });
  if (account && (!isBuyerRoleKey(account.role.key) || account.vendorId)) throw new AppError("This is a staff or partner account. Remove or reassign it from Users (or the company's team) instead.", "BAD_REQUEST");
  const email = c.email;
  const placeholder = (uid: string) => `erased-${uid}@erased.invalid`;
  const counts: Record<string, number> = {};
  await db.$transaction(async (tx) => {
    if (account) {
      const uid = account.id;
      counts.sessions = (await tx.session.deleteMany({ where: { userId: uid } })).count;
      await tx.authToken.deleteMany({ where: { userId: uid } });
      counts.favourites = (await tx.productFavourite.deleteMany({ where: { userId: uid } })).count;
      await tx.notification.deleteMany({ where: { userId: uid } });
      await tx.pushSubscription.deleteMany({ where: { userId: uid } });
      counts.reviews = (await tx.review.updateMany({ where: { OR: [{ userId: uid }, { authorEmail: email }] }, data: { authorName: "Former user", authorEmail: placeholder(uid), authorRole: null, companyName: null, ipHash: null } })).count;
      counts.questions = (await tx.productQuestion.updateMany({ where: { userId: uid }, data: { authorName: "Former user" } })).count;
      await tx.user.update({
        where: { id: uid },
        data: { name: "Erased user", email: placeholder(uid), passwordHash: null, avatarUrl: null, status: "SUSPENDED", totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null, backupCodeHashes: [], offerEmails: false, notifyOff: [] },
      });
    } else {
      counts.reviews = (await tx.review.updateMany({ where: { authorEmail: email }, data: { authorName: "Former user", authorEmail: `erased-${c.id}@erased.invalid`, authorRole: null, companyName: null, ipHash: null } })).count;
    }
    counts.consents = (await tx.userConsent.updateMany({ where: { status: "GRANTED", OR: [{ email }, ...(account ? [{ userId: account.id }] : [])] }, data: { status: "WITHDRAWN", withdrawnAt: new Date(), withdrawSource: "erasure" } })).count;
    if (opts.enquiries) {
      counts.enquiries = (await tx.lead.updateMany({ where: { email }, data: { name: "Erased", email: `erased-${c.id}@erased.invalid`, phone: "", company: null, city: null, message: null, ipHash: null, userAgent: null } })).count;
    }
    await tx.privacyCaseEvent.create({ data: { caseId: id, type: "erasure", actorId: user.id, internal: false, message: "Account data erased", metadata: counts } });
    await audit({ actorId: user.id, action: "privacy.erasure", entityType: "privacyCase", entityId: id, summary: `Erased personal data for ${c.referenceNo}`, metadata: counts }, tx);
  });
  return counts;
}

/** Staff who can be assigned cases. */
export async function caseAssignees() {
  return db.user.findMany({
    where: { status: "ACTIVE", vendorId: null, role: { OR: [{ key: "SUPER_ADMIN" }, { permissions: { some: { permission: { key: "compliance.view" } } } }] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export type { PrivacyCaseKind };
