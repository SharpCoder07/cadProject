import "server-only";
import type { ApprovalAction, ApprovalEntity, ApprovalStatus, Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { sendTemplate } from "@/server/email/config";
import { escapeHtml } from "@/server/email/templates";
import { AppError, forbidden, notFound } from "@/server/errors";
import { assertCan, can, isSuperAdmin, type Principal } from "@/server/rbac/policy";
import { withoutQueue } from "@/server/rbac/deletion";
import { softwareInput, type SoftwareInput } from "@/lib/validation/software";
import { vendorInput, type VendorInput } from "@/lib/validation/taxonomy";
import { sanitizePlain } from "@/server/sanitize";
import { assertNoBlockedWords } from "@/server/moderation";
import {
  deleteSoftware, getSoftwareForEdit, revalidateSoftware, saveVendorDraft, setSoftwareStatus, toSoftwareInput, updateSoftware,
} from "./software";
import { saveVendor } from "./taxonomy";
import { applyTeamRequest } from "./vendor-team";
import { applyOfferRequest } from "./offers";
import { applyResellerProductRequest, assertCompanyKind } from "./resellers";
import { notify } from "@/server/notifications/notify";

/**
 * Centralised approval workflow for the vendor portal.
 *
 * Vendor users never change live data. Every create, edit, publish, unpublish and delete
 * becomes an ApprovalRequest; a user with `approvals.manage` (Super Admin by default)
 * approves it, which applies the change with the approver's authority, or rejects it with
 * a reason. One request per record can be pending at a time: a newer request for the same
 * action replaces the proposal; a different action supersedes (cancels) the older one.
 */

export const ACTION_LABEL: Record<ApprovalAction, string> = {
  CREATE: "Publish new",
  UPDATE: "Edit",
  DELETE: "Delete",
  PUBLISH: "Re-publish",
  UNPUBLISH: "Unpublish",
  PASSWORD: "Change password",
};
export const ENTITY_LABEL: Record<ApprovalEntity, string> = {
  SOFTWARE: "Product",
  VENDOR_PROFILE: "Company profile",
  REVIEW_REPLY: "Review reply",
  VENDOR_USER: "Team member",
  OFFER: "Offer",
  RESELLER_PRODUCT: "Authorised product",
};

type RequestInput = {
  vendorId: string;
  requestedById: string;
  entityType: ApprovalEntity;
  entityId: string;
  entityLabel: string;
  action: ApprovalAction;
  payload?: Prisma.InputJsonValue | null;
  before?: Prisma.InputJsonValue | null;
  note?: string | null;
};

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const cleanNote = (n?: string | null) => (n ? sanitizePlain(n).slice(0, 1000) || null : null);

/** Opens (or refreshes) the pending request for a record and notifies approvers when it's new. */
export async function openRequest(input: RequestInput) {
  const pending = await db.approvalRequest.findFirst({ where: { entityType: input.entityType, entityId: input.entityId, status: "PENDING" } });
  const data = {
    entityLabel: input.entityLabel.slice(0, 200),
    payload: input.payload ?? undefined,
    before: input.before ?? undefined,
    note: cleanNote(input.note),
    requestedById: input.requestedById,
  };
  if (pending && pending.action === input.action) {
    const updated = await db.approvalRequest.update({ where: { id: pending.id }, data });
    await audit({ actorId: input.requestedById, action: "approval.update", entityType: "approval", entityId: updated.id, summary: `${ACTION_LABEL[input.action]} ${ENTITY_LABEL[input.entityType].toLowerCase()} “${input.entityLabel}” — proposal updated` });
    revalidateTag(APPROVALS_TAG);
    // The vendor changed a request that's still waiting: tell approvers so they review the latest version.
    void notifyApprovers(updated.id, true).catch((e) => console.error("[approvals] notify failed", e));
    return { request: updated, isNew: false };
  }
  const request = await db.$transaction(async (tx) => {
    if (pending) {
      await tx.approvalRequest.update({ where: { id: pending.id }, data: { status: "CANCELLED", decisionNote: "Replaced by a newer request", decidedAt: new Date() } });
    }
    const created = await tx.approvalRequest.create({ data: { ...data, vendorId: input.vendorId, entityType: input.entityType, entityId: input.entityId, action: input.action } });
    await audit({ actorId: input.requestedById, action: "approval.request", entityType: "approval", entityId: created.id, summary: `${ACTION_LABEL[input.action]} ${ENTITY_LABEL[input.entityType].toLowerCase()} “${input.entityLabel}”` }, tx);
    return created;
  });
  revalidateTag(APPROVALS_TAG);
  void notifyApprovers(request.id).catch((e) => console.error("[approvals] notify failed", e));
  return { request, isNew: true };
}

export const APPROVALS_TAG = "approvals";

async function notifyApprovers(requestId: string, updated = false) {
  const r = await db.approvalRequest.findUnique({ where: { id: requestId }, include: { vendor: { select: { name: true } }, requestedBy: { select: { name: true, email: true } } } });
  if (!r) return;
  notify({ staff: "approvals.manage" }, {
    type: "approval.new",
    title: `${updated ? "Updated request" : "Approval request"}: ${ACTION_LABEL[r.action].toLowerCase()} ${ENTITY_LABEL[r.entityType].toLowerCase()}`,
    body: `${r.entityLabel} · ${r.vendor.name}${r.requestedBy ? ` (${r.requestedBy.name})` : ""}`,
    href: `/admin/approvals/${r.id}`,
  });
  const approvers = await db.user.findMany({
    where: { status: "ACTIVE", vendorId: null, role: { permissions: { some: { permission: { key: "approvals.manage" } } } } },
    select: { email: true },
  });
  if (!approvers.length) return;
  await sendTemplate("approval_request", approvers.map((a) => a.email), {
    vendor_name: r.vendor.name,
    requester_name: r.requestedBy?.name ?? "A vendor user",
    action: ACTION_LABEL[r.action].toLowerCase(),
    item_type: ENTITY_LABEL[r.entityType].toLowerCase(),
    item: r.entityLabel,
    note_block: [updated ? "<p><strong>They updated this request</strong> while it was waiting — review the latest version.</p>" : "", r.note ? `<p><strong>Their note:</strong> ${escapeHtml(r.note)}</p>` : ""].join(""),
    review_url: `${env.APP_URL}/admin/approvals/${r.id}`,
  });
}

async function notifyRequester(requestId: string) {
  const r = await db.approvalRequest.findUnique({ where: { id: requestId }, include: { requestedBy: { select: { name: true, email: true, status: true } } } });
  if (r?.requestedById && (r.status === "APPROVED" || r.status === "REJECTED")) {
    notify({ users: [r.requestedById] }, {
      type: "request.decided",
      title: `${r.status === "APPROVED" ? "Approved" : "Rejected"}: ${ACTION_LABEL[r.action].toLowerCase()} ${ENTITY_LABEL[r.entityType].toLowerCase()}`,
      body: r.decisionNote ? `${r.entityLabel}: ${r.decisionNote}` : r.entityLabel,
      href: "/vendor/requests",
    });
  }
  if (!r?.requestedBy || r.requestedBy.status !== "ACTIVE") return;
  await sendTemplate("approval_decision", r.requestedBy.email, {
    user_name: r.requestedBy.name,
    decision: r.status === "APPROVED" ? "approved" : "rejected",
    action: ACTION_LABEL[r.action].toLowerCase(),
    item_type: ENTITY_LABEL[r.entityType].toLowerCase(),
    item: r.entityLabel,
    reason_block: r.decisionNote ? `<p><strong>Note from the reviewer:</strong> ${escapeHtml(r.decisionNote)}</p>` : "",
    requests_url: `${env.APP_URL}/vendor/requests`,
  });
}

// ─── Vendor proposals ────────────────────────────────────────────────────────

function vendorOf(user: Principal) {
  if (!user.vendorId) throw forbidden("Only vendor-portal users submit approval requests.");
  return user.vendorId;
}

async function ownSoftware(user: Principal, id: string) {
  const sw = await db.software.findUnique({ where: { id }, select: { id: true, name: true, slug: true, status: true, vendorId: true, publishedAt: true } });
  if (!sw || sw.vendorId !== user.vendorId) throw notFound("Software");
  return sw;
}

/**
 * Vendor saves a product.
 * - New product → saved as a draft and a “publish new” request is opened.
 * - Not live (draft / unpublished) → the draft is updated and the publish request refreshed.
 * - Live → nothing changes yet; the proposal waits in an “edit” request.
 */
export async function proposeSoftware(user: Principal, id: string | null, raw: SoftwareInput, note?: string | null) {
  const vendorId = vendorOf(user);
  await assertCompanyKind(user, "VENDOR");
  assertCan(user, "vendor.listings.submit", { vendorId });
  const input = softwareInput.parse({ ...raw, vendorId });
  await assertNoBlockedWords({ name: input.name, tagline: input.tagline, shortDescription: input.shortDescription, description: input.description, note });
  if (input.brandId) {
    const brand = await db.brand.findUnique({ where: { id: input.brandId }, select: { vendorId: true } });
    // Vendors can use their own brands or any standalone brand (e.g. a reseller listing Autodesk products).
    if (!brand || (brand.vendorId && brand.vendorId !== vendorId)) throw new AppError("Choose one of the listed brands.", "BAD_REQUEST", { brandId: ["Not available for your company"] });
  }

  if (!id) {
    const sw = await saveVendorDraft(user, null, input);
    await openRequest({ vendorId, requestedById: user.id, entityType: "SOFTWARE", entityId: sw.id, entityLabel: sw.name, action: "CREATE", note });
    return { id: sw.id, message: "Saved as a draft and sent to the Super Admin for approval" };
  }

  const sw = await ownSoftware(user, id);
  if (sw.status !== "PUBLISHED") {
    const saved = await saveVendorDraft(user, id, input);
    await openRequest({ vendorId, requestedById: user.id, entityType: "SOFTWARE", entityId: id, entityLabel: saved.name, action: sw.publishedAt ? "PUBLISH" : "CREATE", note });
    return { id, message: "Draft saved and sent to the Super Admin for approval" };
  }

  const current = toSoftwareInput(await getSoftwareForEdit(user, id));
  await openRequest({ vendorId, requestedById: user.id, entityType: "SOFTWARE", entityId: id, entityLabel: input.name, action: "UPDATE", payload: json(input), before: json(current), note });
  return { id, message: "Changes sent for approval. The live listing stays unchanged until they're approved." };
}

/** Vendor asks to unpublish, re-publish or delete a product. */
export async function requestSoftwareAction(user: Principal, id: string, action: "DELETE" | "UNPUBLISH" | "PUBLISH", note?: string | null) {
  const vendorId = vendorOf(user);
  await assertCompanyKind(user, "VENDOR");
  assertCan(user, action === "PUBLISH" ? "vendor.listings.submit" : "vendor.listings.delete", { vendorId });
  const sw = await ownSoftware(user, id);
  if (action === "UNPUBLISH" && sw.status !== "PUBLISHED") throw new AppError("This product isn't live.");
  if (action === "PUBLISH" && sw.status === "PUBLISHED") throw new AppError("This product is already live.");
  await openRequest({ vendorId, requestedById: user.id, entityType: "SOFTWARE", entityId: id, entityLabel: sw.name, action: action === "PUBLISH" && !sw.publishedAt ? "CREATE" : action, note });
  return { message: action === "DELETE" ? "Deletion requested. The Super Admin will review it." : action === "UNPUBLISH" ? "Unpublish requested" : "Publishing requested" };
}

export function vendorToInput(v: Prisma.VendorGetPayload<{ include: { seo: true } }>): VendorInput {
  return {
    name: v.name, slug: v.slug, legalName: v.legalName, description: v.description, website: v.website, email: v.email, phone: v.phone, addressLine: v.addressLine,
    city: v.city, state: v.state, country: v.country, foundedYear: v.foundedYear, employeeRange: v.employeeRange, logoId: v.logoId, isActive: v.isActive, receivesLeads: v.receivesLeads, serviceCities: v.serviceCities,
    seo: { title: v.seo?.title ?? null, description: v.seo?.description ?? null, keywords: v.seo?.keywords ?? null, canonicalUrl: v.seo?.canonicalUrl ?? null, noIndex: v.seo?.noIndex ?? false, ogImageId: v.seo?.ogImageId ?? null },
  } as VendorInput;
}

/** Vendor proposes company-profile changes. URL, visibility, lead access and SEO stay admin-controlled. */
export async function proposeVendorProfile(user: Principal, raw: VendorInput, note?: string | null) {
  const vendorId = vendorOf(user);
  assertCan(user, "vendor.profile", { vendorId });
  const v = await db.vendor.findUniqueOrThrow({ where: { id: vendorId }, include: { seo: true } });
  const current = vendorToInput(v);
  const input = vendorInput.parse({ ...raw, slug: current.slug, isActive: current.isActive, receivesLeads: current.receivesLeads, seo: current.seo });
  await assertNoBlockedWords({ name: input.name, description: input.description, note });
  await openRequest({ vendorId, requestedById: user.id, entityType: "VENDOR_PROFILE", entityId: vendorId, entityLabel: input.name, action: "UPDATE", payload: json(input), before: json(current), note });
  return { message: "Profile changes sent for approval" };
}

/** Vendor proposes, edits or removes a public reply to a review of one of their products. */
export async function proposeReviewReply(user: Principal, reviewId: string, reply: string | null) {
  const vendorId = vendorOf(user);
  await assertCompanyKind(user, "VENDOR");
  assertCan(user, "vendor.reviews", { vendorId });
  const review = await db.review.findUnique({ where: { id: reviewId }, select: { id: true, title: true, status: true, vendorReply: true, software: { select: { vendorId: true, name: true } } } });
  if (!review || review.software.vendorId !== vendorId) throw notFound("Review");
  if (review.status !== "APPROVED") throw new AppError("You can reply once the review is published.");
  await assertNoBlockedWords({ reply });
  const text = reply ? sanitizePlain(reply).trim().slice(0, 2000) : "";
  if (!text && !review.vendorReply) throw new AppError("Write a reply first.");
  const action: ApprovalAction = !text ? "DELETE" : review.vendorReply ? "UPDATE" : "CREATE";
  await openRequest({
    vendorId, requestedById: user.id, entityType: "REVIEW_REPLY", entityId: reviewId, entityLabel: `${review.software.name}: “${review.title}”`, action,
    payload: text ? { reply: text } : null, before: { reply: review.vendorReply ?? null },
  });
  return { message: action === "DELETE" ? "Removal of your reply sent for approval" : "Reply sent for approval" };
}

/** Requester (or any vendor user allowed to submit) withdraws a pending request. */
export async function cancelRequest(user: Principal, id: string) {
  const vendorId = vendorOf(user);
  const r = await db.approvalRequest.findUnique({ where: { id } });
  if (!r || r.vendorId !== vendorId) throw notFound("Request");
  if (r.status !== "PENDING") throw new AppError("Only pending requests can be withdrawn.");
  const allowed = r.requestedById === user.id || can(user, "vendor.listings.submit", { vendorId }) || can(user, "vendor.profile", { vendorId }) || can(user, "vendor.team.manage", { vendorId }) || can(user, "vendor.offers", { vendorId });
  if (!allowed) throw forbidden();
  await db.approvalRequest.update({ where: { id }, data: { status: "CANCELLED", decisionNote: "Withdrawn by the vendor", decidedAt: new Date(), ...scrubSecrets(r) } });
  await audit({ actorId: user.id, action: "approval.cancel", entityType: "approval", entityId: id, summary: `Withdrew request for “${r.entityLabel}”` });
  revalidateTag(APPROVALS_TAG);
}

// ─── Decisions ───────────────────────────────────────────────────────────────

/** Password hashes never outlive the request: once it's decided or withdrawn, only the mode is kept. */
function scrubSecrets(r: { entityType: ApprovalEntity; action: ApprovalAction; payload: Prisma.JsonValue }) {
  if (r.entityType !== "VENDOR_USER" || r.action !== "PASSWORD") return {};
  const mode = (r.payload as { mode?: string } | null)?.mode ?? "reset";
  return { payload: { mode } as Prisma.InputJsonValue };
}

const STAFF_ONLY_SOFTWARE_FIELDS = ["vendorId", "pros", "cons", "bestFor", "notIdealFor", "isFeatured", "isPopular", "isTrending", "isRecommended", "isSponsored", "sponsoredRank", "legacyId", "seo"] as const;

/** Applies an approved request with the approver's authority. Throws if it can't be applied (request stays pending). */
async function apply(approver: Principal, r: Prisma.ApprovalRequestGetPayload<object>) {
  if (r.entityType === "SOFTWARE") {
    const exists = await db.software.findUnique({ where: { id: r.entityId }, select: { id: true } });
    if (!exists) throw new AppError("This product no longer exists.", "CONFLICT");
    switch (r.action) {
      case "CREATE":
      case "PUBLISH":
        await setSoftwareStatus(approver, [r.entityId], "PUBLISHED");
        return;
      case "UNPUBLISH":
        await setSoftwareStatus(approver, [r.entityId], "DRAFT");
        return;
      case "DELETE":
        await deleteSoftware(approver, [r.entityId]);
        return;
      case "UPDATE": {
        const proposed = softwareInput.parse(r.payload);
        const current = toSoftwareInput(await getSoftwareForEdit(approver, r.entityId));
        const merged = { ...proposed } as SoftwareInput;
        for (const k of STAFF_ONLY_SOFTWARE_FIELDS) (merged as Record<string, unknown>)[k] = current[k];
        merged.revisionMessage = "Vendor change approved";
        await updateSoftware(approver, r.entityId, merged);
        return;
      }
    }
  }
  if (r.entityType === "VENDOR_PROFILE") {
    const v = await db.vendor.findUnique({ where: { id: r.entityId }, include: { seo: true } });
    if (!v) throw new AppError("This vendor no longer exists.", "CONFLICT");
    const current = vendorToInput(v);
    const proposed = vendorInput.parse(r.payload);
    await saveVendor(approver, r.entityId, { ...proposed, slug: current.slug, isActive: current.isActive, receivesLeads: current.receivesLeads, seo: current.seo });
    return;
  }
  if (r.entityType === "VENDOR_USER") {
    await applyTeamRequest(approver, r);
    return;
  }
  if (r.entityType === "OFFER") {
    await applyOfferRequest(approver, r);
    return;
  }
  if (r.entityType === "RESELLER_PRODUCT") {
    await applyResellerProductRequest(approver, r);
    return;
  }
  if (r.entityType === "REVIEW_REPLY") {
    const review = await db.review.findUnique({ where: { id: r.entityId }, select: { software: { select: { slug: true } } } });
    if (!review) throw new AppError("This review no longer exists.", "CONFLICT");
    const reply = r.action === "DELETE" ? null : String((r.payload as { reply?: string } | null)?.reply ?? "") || null;
    await db.review.update({ where: { id: r.entityId }, data: { vendorReply: reply, vendorReplyAt: reply ? new Date() : null } });
    revalidateSoftware([review.software.slug]);
    return;
  }
}

export async function decideRequest(user: Principal, id: string, decision: "APPROVE" | "REJECT", note?: string | null) {
  assertCan(user, "approvals.manage");
  const r = await db.approvalRequest.findUnique({ where: { id } });
  if (!r) throw notFound("Request");
  if (r.status !== "PENDING") throw new AppError(`This request was already ${r.status.toLowerCase()}.`, "CONFLICT");
  const decisionNote = cleanNote(note);
  if (decision === "REJECT" && !decisionNote) throw new AppError("Tell the vendor why you're rejecting this request.", "BAD_REQUEST", { note: ["Required when rejecting"] });

  // Deleting, or approving a change that removes something, is the Super Admin's call (rbac/deletion.ts).
  if (decision === "APPROVE" && r.action === "DELETE" && !isSuperAdmin(user)) throw forbidden("Only the Super Admin can approve deletions.");
  // Adding team members or changing their access gives them permissions: also the Super Admin's call.
  if (decision === "APPROVE" && r.entityType === "VENDOR_USER" && !isSuperAdmin(user)) throw forbidden("Only the Super Admin can approve team and access changes.");
  if (decision === "APPROVE") await withoutQueue("This change removes something (a feature, plan, FAQ, image…), so only the Super Admin can approve it.", () => apply(user, r));
  const status: ApprovalStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  await db.approvalRequest.update({ where: { id }, data: { status, decisionNote, decidedById: user.id, decidedAt: new Date(), ...scrubSecrets(r) } });
  await audit({ actorId: user.id, action: `approval.${status.toLowerCase()}`, entityType: "approval", entityId: id, summary: `${status === "APPROVED" ? "Approved" : "Rejected"}: ${ACTION_LABEL[r.action].toLowerCase()} ${ENTITY_LABEL[r.entityType].toLowerCase()} “${r.entityLabel}”` });
  revalidateTag(APPROVALS_TAG);
  void notifyRequester(id).catch((e) => console.error("[approvals] notify failed", e));
  return status;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const PAGE = 30;

export async function listApprovals(user: Principal, q: { status?: ApprovalStatus | "ALL"; vendorId?: string; entityType?: ApprovalEntity; page?: number; q?: string }) {
  const scope: Prisma.ApprovalRequestWhereInput = user.vendorId ? { vendorId: user.vendorId } : {};
  if (user.vendorId) assertCan(user, "vendor.portal", { vendorId: user.vendorId });
  else assertCan(user, "approvals.manage");
  const where: Prisma.ApprovalRequestWhereInput = {
    ...scope,
    ...(q.status && q.status !== "ALL" ? { status: q.status } : {}),
    ...(!user.vendorId && q.vendorId ? { vendorId: q.vendorId } : {}),
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.q?.trim()
      ? {
          OR: [
            { entityLabel: { contains: q.q.trim(), mode: "insensitive" as const } },
            { note: { contains: q.q.trim(), mode: "insensitive" as const } },
            { requestedBy: { name: { contains: q.q.trim(), mode: "insensitive" as const } } },
            ...(user.vendorId ? [] : [{ vendor: { name: { contains: q.q.trim(), mode: "insensitive" as const } } }]),
          ],
        }
      : {}),
  };
  const page = Math.max(1, q.page ?? 1);
  const [items, total] = await Promise.all([
    db.approvalRequest.findMany({
      where,
      orderBy: [{ createdAt: q.status === "PENDING" ? "asc" : "desc" }],
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { vendor: { select: { id: true, name: true } }, requestedBy: { select: { name: true } }, decidedBy: { select: { name: true } } },
    }),
    db.approvalRequest.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function getApproval(user: Principal, id: string) {
  const r = await db.approvalRequest.findUnique({
    where: { id },
    include: { vendor: { select: { id: true, name: true } }, requestedBy: { select: { id: true, name: true, email: true } }, decidedBy: { select: { name: true } } },
  });
  if (!r) throw notFound("Request");
  if (user.vendorId ? r.vendorId !== user.vendorId : !can(user, "approvals.manage")) throw notFound("Request");
  return r;
}

export async function pendingApprovalSummary(user: Principal) {
  if (!can(user, "approvals.manage")) return { count: 0, latest: [] };
  const [count, latest] = await Promise.all([
    db.approvalRequest.count({ where: { status: "PENDING" } }),
    db.approvalRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, action: true, entityType: true, entityLabel: true, createdAt: true, vendor: { select: { name: true } } } }),
  ]);
  return { count, latest };
}

/** Latest open (or most recently decided) request per record, for status badges in the vendor portal. */
export async function requestStateFor(vendorId: string, entityType: ApprovalEntity, entityIds: string[]) {
  if (!entityIds.length) return new Map<string, { id: string; action: ApprovalAction; status: ApprovalStatus; decisionNote: string | null; updatedAt: Date }>();
  const rows = await db.approvalRequest.findMany({
    where: { vendorId, entityType, entityId: { in: entityIds }, status: { in: ["PENDING", "REJECTED"] } },
    orderBy: { updatedAt: "desc" },
    select: { id: true, entityId: true, action: true, status: true, decisionNote: true, updatedAt: true },
  });
  const map = new Map<string, { id: string; action: ApprovalAction; status: ApprovalStatus; decisionNote: string | null; updatedAt: Date }>();
  for (const r of rows) {
    const prev = map.get(r.entityId);
    // A pending request always wins; otherwise keep the newest rejection.
    if (!prev || (prev.status !== "PENDING" && r.status === "PENDING")) map.set(r.entityId, r);
  }
  // Drop rejections older than the last approval (the record has moved on since).
  const approved = await db.approvalRequest.findMany({ where: { vendorId, entityType, entityId: { in: entityIds }, status: "APPROVED" }, orderBy: { decidedAt: "desc" }, select: { entityId: true, decidedAt: true } });
  for (const a of approved) {
    const cur = map.get(a.entityId);
    if (cur && cur.status === "REJECTED" && a.decidedAt && a.decidedAt > cur.updatedAt) map.delete(a.entityId);
  }
  return map;
}

/** The vendor's pending proposal for a live product, if any (shown in the editor instead of live values). */
export async function pendingSoftwareProposal(user: Principal, softwareId: string) {
  if (!user.vendorId) return null;
  const r = await db.approvalRequest.findFirst({ where: { vendorId: user.vendorId, entityType: "SOFTWARE", entityId: softwareId, status: "PENDING", action: "UPDATE" } });
  return r?.payload ? (softwareInput.parse(r.payload) as SoftwareInput) : null;
}

export async function pendingProfileProposal(vendorId: string) {
  const r = await db.approvalRequest.findFirst({ where: { vendorId, entityType: "VENDOR_PROFILE", entityId: vendorId, status: "PENDING" } });
  return r?.payload ? (vendorInput.parse(r.payload) as VendorInput) : null;
}
