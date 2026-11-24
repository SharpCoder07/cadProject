import "server-only";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { hashIp } from "@/server/request";
import { sanitizePlain } from "@/server/sanitize";
import { getSettings } from "@/server/settings";
import { assertNoBlockedWords } from "@/server/moderation";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { env } from "@/server/env";
import { sendTemplate } from "@/server/email/config";
import { escapeHtml } from "@/server/email/templates";
import { optionalText, requiredText } from "@/lib/validation/common";
import { refreshSoftwareStats, softwareTag } from "./software";
import { moveToBin } from "@/server/system/trash";
import { notify } from "@/server/notifications/notify";
import { guardDelete } from "@/server/rbac/deletion";

const subRating = z.coerce.number().int().min(1).max(5).nullish();

/** Reviews are written from a signed-in buyer account; the name and email come from the account. */
export const reviewSubmission = z.object({
  softwareSlug: z.string().max(80),
  authorRole: optionalText(80),
  companyName: optionalText(120),
  companySize: optionalText(40),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  ratingEase: subRating,
  ratingValue: subRating,
  ratingSupport: subRating,
  ratingFeatures: subRating,
  title: requiredText(120),
  pros: optionalText(1500),
  cons: optionalText(1500),
  body: requiredText(5000),
  website: z.string().max(0).optional().default(""),
});
export type ReviewSubmission = z.infer<typeof reviewSubmission>;

export async function submitReview(user: Principal | null, input: ReviewSubmission, ip: string | null) {
  if (!user) throw new AppError("Sign in to write a review.", "UNAUTHENTICATED");
  assertCan(user, "buyer.account");
  const settings = await getSettings();
  if (!settings.reviews.enabled) throw new AppError("Reviews are not open right now.");
  if (input.website) return { status: "PENDING" as const }; // honeypot: pretend success
  await assertNoBlockedWords({ title: input.title, body: input.body, pros: input.pros, cons: input.cons, authorRole: input.authorRole, companyName: input.companyName });
  if (input.body.length < settings.reviews.minBodyLength) {
    throw new AppError("Check the highlighted fields.", "BAD_REQUEST", { body: [`Write at least ${settings.reviews.minBodyLength} characters so others can learn from your experience.`] });
  }
  const sw = await db.software.findFirst({ where: { slug: input.softwareSlug, status: "PUBLISHED" }, select: { id: true, slug: true } });
  if (!sw) throw notFound("Software");
  const already = await db.review.findUnique({ where: { softwareId_userId: { softwareId: sw.id, userId: user.id } }, select: { id: true } });
  if (already) throw new AppError("You've already reviewed this product. You can edit or delete it under My account → My reviews.", "CONFLICT");

  const status = settings.reviews.autoApprove ? "APPROVED" : "PENDING";
  await db.$transaction(async (tx) => {
    await tx.review.create({
      data: {
        softwareId: sw.id,
        userId: user.id,
        authorName: sanitizePlain(user.name),
        authorEmail: user.email,
        authorRole: input.authorRole && sanitizePlain(input.authorRole),
        companyName: input.companyName && sanitizePlain(input.companyName),
        companySize: input.companySize,
        rating: input.rating,
        ratingEase: input.ratingEase ?? null,
        ratingValue: input.ratingValue ?? null,
        ratingSupport: input.ratingSupport ?? null,
        ratingFeatures: input.ratingFeatures ?? null,
        title: sanitizePlain(input.title),
        pros: input.pros && sanitizePlain(input.pros),
        cons: input.cons && sanitizePlain(input.cons),
        body: sanitizePlain(input.body),
        status,
        ipHash: hashIp(ip),
      },
    });
    if (status === "APPROVED") await refreshSoftwareStats(tx, sw.id);
  });
  if (status === "APPROVED") revalidateTag(softwareTag(sw.slug));
  void notifyModerators(sw.id, user.name, input, status).catch((e) => console.error("[reviews] notify failed", e));
  return { status };
}

/** Emails everyone who can approve reviews that a new one was posted. */
async function notifyModerators(softwareId: string, reviewer: string, input: Pick<ReviewSubmission, "rating" | "title" | "body">, status: "PENDING" | "APPROVED", edited = false) {
  const [sw, moderators] = await Promise.all([
    db.software.findUnique({ where: { id: softwareId }, select: { name: true } }),
    db.user.findMany({ where: { status: "ACTIVE", vendorId: null, role: { permissions: { some: { permission: { key: "reviews.moderate" } } } } }, select: { email: true } }),
  ]);
  if (sw) {
    notify({ staff: "reviews.moderate" }, {
      type: "review.new",
      title: `${status === "PENDING" ? "Review to approve" : "New review published"}${edited ? " (edited)" : ""}: ${sw.name}`,
      body: `${"★".repeat(input.rating)} “${input.title}” by ${reviewer}`,
      href: `/admin/reviews?status=${status}`,
    });
  }
  if (!sw || !moderators.length) return;
  const excerpt = input.body.length > 400 ? `${input.body.slice(0, 400)}…` : input.body;
  await sendTemplate("review_new", moderators.map((m) => m.email), {
    reviewer_name: reviewer,
    product_name: sw.name,
    rating: String(input.rating),
    review_title: input.title,
    review_excerpt: `<p style="white-space:pre-line">${escapeHtml(excerpt)}</p>`,
    status_line: (edited ? "They edited an earlier review. " : "") + (status === "PENDING" ? (edited ? "The changes are waiting for your approval; the review is hidden from the website until you approve it." : "It's waiting for your approval and won't appear on the website until you approve it.") : edited ? "The changes were published straight away (reviews are set to publish without moderation)." : "It was published straight away (reviews are set to publish without moderation)."),
    status_suffix: (edited ? " (edited)" : "") + (status === "PENDING" ? " — approval needed" : ""),
    moderate_url: `${env.APP_URL}/admin/reviews?status=${status}`,
  });
}

/** What a buyer can change on their own review (the product can't change). */
export const reviewEdit = reviewSubmission.omit({ softwareSlug: true, website: true }).extend({ id: z.string().cuid() });
export type ReviewEdit = z.infer<typeof reviewEdit>;

async function ownReview(user: Principal, id: string) {
  assertCan(user, "buyer.account");
  const review = await db.review.findFirst({ where: { id, userId: user.id }, select: { id: true, status: true, softwareId: true, software: { select: { slug: true } } } });
  if (!review) throw notFound("Review");
  return review;
}

/**
 * A buyer edits their own review. Changed text goes back through moderation (unless reviews publish
 * without it), so an approved review is hidden again until a moderator approves the new version.
 */
export async function updateMyReview(user: Principal, input: ReviewEdit) {
  const review = await ownReview(user, input.id);
  const settings = await getSettings();
  if (!settings.reviews.enabled) throw new AppError("Reviews are closed right now, so they can't be edited.");
  await assertNoBlockedWords({ title: input.title, body: input.body, pros: input.pros, cons: input.cons, authorRole: input.authorRole, companyName: input.companyName });
  if (input.body.length < settings.reviews.minBodyLength) {
    throw new AppError("Check the highlighted fields.", "BAD_REQUEST", { body: [`Write at least ${settings.reviews.minBodyLength} characters so others can learn from your experience.`] });
  }
  const status = settings.reviews.autoApprove ? "APPROVED" : "PENDING";
  await db.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: review.id },
      data: {
        authorName: sanitizePlain(user.name),
        authorRole: input.authorRole ? sanitizePlain(input.authorRole) : null,
        companyName: input.companyName ? sanitizePlain(input.companyName) : null,
        companySize: input.companySize || null,
        rating: input.rating,
        ratingEase: input.ratingEase ?? null,
        ratingValue: input.ratingValue ?? null,
        ratingSupport: input.ratingSupport ?? null,
        ratingFeatures: input.ratingFeatures ?? null,
        title: sanitizePlain(input.title),
        pros: input.pros ? sanitizePlain(input.pros) : null,
        cons: input.cons ? sanitizePlain(input.cons) : null,
        body: sanitizePlain(input.body),
        status,
        moderatedAt: null,
      },
    });
    if (review.status === "APPROVED" || status === "APPROVED") await refreshSoftwareStats(tx, review.softwareId);
  });
  if (review.status === "APPROVED" || status === "APPROVED") revalidateTag(softwareTag(review.software.slug));
  void notifyModerators(review.softwareId, user.name, input, status, true).catch((e) => console.error("[reviews] notify failed", e));
  return { status };
}

/** A buyer deletes their own review; ratings on the product page update straight away. */
export async function deleteMyReview(user: Principal, id: string) {
  const review = await ownReview(user, id);
  await db.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } });
    if (review.status === "APPROVED") await refreshSoftwareStats(tx, review.softwareId);
  });
  if (review.status === "APPROVED") revalidateTag(softwareTag(review.software.slug));
}

/** Pending reviews for the admin notifications bell and sidebar badge. */
export async function pendingReviewSummary(user: Principal) {
  if (!can(user, "reviews.view")) return { count: 0, latest: [] };
  const [count, latest] = await Promise.all([
    db.review.count({ where: { status: "PENDING" } }),
    db.review.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, title: true, rating: true, authorName: true, createdAt: true, software: { select: { name: true } } } }),
  ]);
  return { count, latest };
}

/** The signed-in buyer's own review of a product, if any (shown instead of the form). */
export async function myReviewFor(userId: string, slug: string) {
  return db.review.findFirst({ where: { userId, software: { slug } }, select: { status: true, createdAt: true } });
}

export async function listReviews(user: Principal, opts: { status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL"; page?: number; q?: string }) {
  assertCan(user, "reviews.view");
  const page = opts.page ?? 1;
  const q = opts.q?.trim();
  const where = {
    ...(opts.status && opts.status !== "ALL" ? { status: opts.status } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { body: { contains: q, mode: "insensitive" as const } }, { authorName: { contains: q, mode: "insensitive" as const } }, { software: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.review.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25, include: { software: { select: { name: true, slug: true } } } }),
    db.review.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 25)) };
}

export async function moderateReviews(user: Principal, ids: string[], status: "APPROVED" | "REJECTED" | "PENDING") {
  assertCan(user, "reviews.moderate");
  const reviews = await db.review.findMany({ where: { id: { in: ids } }, select: { softwareId: true, userId: true, status: true, title: true, software: { select: { slug: true, name: true } } } });
  await db.$transaction(async (tx) => {
    await tx.review.updateMany({ where: { id: { in: ids } }, data: { status, moderatedAt: new Date() } });
    for (const softwareId of new Set(reviews.map((r) => r.softwareId))) await refreshSoftwareStats(tx, softwareId);
    await audit({ actorId: user.id, action: `review.${status.toLowerCase()}`, entityType: "review", summary: `${status} ${ids.length} review(s)`, diff: { ids } }, tx);
  });
  for (const r of reviews) revalidateTag(softwareTag(r.software.slug));
  revalidateTag("catalog");
  if (status !== "PENDING") {
    for (const r of reviews) {
      if (!r.userId || r.status === status) continue;
      notify({ users: [r.userId] }, {
        type: "review.moderated",
        title: status === "APPROVED" ? `Your review of ${r.software.name} is published` : `Your review of ${r.software.name} wasn't published`,
        body: status === "APPROVED" ? `“${r.title}” is now live on the product page.` : `“${r.title}” didn't meet our review guidelines. You can edit it and send it again.`,
        href: status === "APPROVED" ? `/software/${r.software.slug}#reviews` : "/account/reviews",
      });
    }
  }
}

export async function deleteReviews(user: Principal, ids: string[]) {
  await guardDelete(user, "reviews", { ids });
  const reviews = await db.review.findMany({ where: { id: { in: ids } }, select: { softwareId: true } });
  await db.$transaction(async (tx) => {
    await moveToBin(tx, user, "Review", ids);
    await tx.review.deleteMany({ where: { id: { in: ids } } });
    for (const softwareId of new Set(reviews.map((r) => r.softwareId))) await refreshSoftwareStats(tx, softwareId);
    await audit({ actorId: user.id, action: "review.delete", entityType: "review", summary: `Deleted ${ids.length} review(s)`, diff: { ids } }, tx);
  }, { timeout: 60_000, maxWait: 10_000 });
  revalidateTag("catalog");
}
