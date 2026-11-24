import "server-only";
import { Prisma, type PublishStatus } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { db, type Tx } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, forbidden, isUniqueViolation, notFound } from "@/server/errors";
import { recordRevision } from "@/server/revisions";
import { sanitizeRichText, sanitizePlain } from "@/server/sanitize";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { slugify } from "@/lib/utils";
import type { SoftwareFlag, SoftwareInput } from "@/lib/validation/software";
import { softwareListQuery } from "@/lib/validation/software";
import type { z } from "zod";
import { upsertSeo } from "./seo";
import { addSlugRedirect } from "./navigation";
import { env } from "@/server/env";
import { sendTemplate } from "@/server/email/config";
import { moveToBin } from "@/server/system/trash";
import { guardDelete, guardRemovals } from "@/server/rbac/deletion";

export const CATALOG_TAG = "catalog";
export const softwareTag = (slug: string) => `software:${slug}`;

export function revalidateSoftware(slugs: (string | null | undefined)[]) {
  revalidateTag(CATALOG_TAG);
  for (const s of slugs) if (s) revalidateTag(softwareTag(s));
}

// ─── Access helpers ──────────────────────────────────────────────────────────

/** Staff need software.edit; vendor users may only *view* their own vendor's products here. */
function assertCanEdit(user: Principal, resource?: { vendorId: string | null }) {
  if (user.vendorId) assertCan(user, "vendor.listings", resource ?? { vendorId: user.vendorId });
  else assertCan(user, resource ? "software.edit" : "software.create");
}

/**
 * Vendor-portal users never change the catalogue directly. Their saves go through
 * src/server/services/approvals.ts, which stores drafts via saveVendorDraft() and
 * applies everything else only after a Super Admin approves.
 */
function assertStaffWrite(user: Principal) {
  if (user.vendorId) throw forbidden("Vendor changes need Super Admin approval. Submit them from the vendor portal.");
}

async function loadOwned(user: Principal, id: string) {
  const sw = await db.software.findUnique({ where: { id }, select: { id: true, slug: true, vendorId: true, status: true, name: true } });
  if (!sw) throw notFound("Software");
  if (user.vendorId && sw.vendorId !== user.vendorId) throw notFound("Software"); // don't reveal existence
  return sw;
}

// ─── Admin queries ───────────────────────────────────────────────────────────

export async function listSoftwareAdmin(user: Principal, rawQuery: unknown) {
  if (user.vendorId) assertCan(user, "vendor.listings");
  else assertCan(user, "software.view");
  const q = softwareListQuery.parse(rawQuery);

  const where: Prisma.SoftwareWhereInput = {
    ...(user.vendorId ? { vendorId: user.vendorId } : q.vendorId ? { vendorId: q.vendorId } : {}),
    ...(q.status !== "ALL" ? { status: q.status } : {}),
    ...(q.categoryId ? { categories: { some: { categoryId: q.categoryId } } } : {}),
    ...(q.flag ? { [q.flag]: true } : {}),
    ...(q.q
      ? {
          OR: [
            { name: { contains: q.q, mode: "insensitive" } },
            { slug: { contains: q.q.toLowerCase() } },
            { vendor: { name: { contains: q.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.SoftwareOrderByWithRelationInput =
    q.sort === "name" ? { name: "asc" } : q.sort === "popular" ? { popularityScore: "desc" } : q.sort === "created" ? { createdAt: "desc" } : { updatedAt: "desc" };

  const [items, total, counts] = await db.$transaction([
    db.software.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.perPage,
      take: q.perPage,
      select: {
        id: true, name: true, slug: true, status: true, updatedAt: true, publishedAt: true, scheduledAt: true,
        isFeatured: true, isPopular: true, isTrending: true, isRecommended: true, isSponsored: true,
        ratingAvg: true, ratingCount: true, enquiryCount: true,
        vendor: { select: { name: true } },
        primaryCategory: { select: { name: true } },
        logo: { select: { url: true } },
      },
    }),
    db.software.count({ where }),
    db.software.groupBy({
      by: ["status"],
      where: user.vendorId ? { vendorId: user.vendorId } : {},
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
  ]);
  const statusCounts = Object.fromEntries(counts.map((c) => [c.status, typeof c._count === "object" ? (c._count._all ?? 0) : 0])) as Partial<Record<PublishStatus, number>>;
  return { items, total, page: q.page, perPage: q.perPage, pages: Math.max(1, Math.ceil(total / q.perPage)), statusCounts, query: q };
}
export type SoftwareListQuery = z.infer<typeof softwareListQuery>;

export async function getSoftwareForEdit(user: Principal, id: string) {
  const owned = await loadOwned(user, id);
  assertCanEdit(user, owned);
  const sw = await db.software.findUnique({
    where: { id },
    include: {
      seo: true,
      logo: true,
      categories: true,
      industries: true,
      terms: true,
      tags: { include: { tag: true } },
      features: { orderBy: { sortOrder: "asc" } },
      plans: { orderBy: { sortOrder: "asc" } },
      faqs: { orderBy: { sortOrder: "asc" } },
      media: { orderBy: { sortOrder: "asc" }, include: { media: true } },
      attributes: true,
      related: { orderBy: { sortOrder: "asc" }, include: { related: { select: { id: true, name: true } } } },
      vendor: { select: { id: true, name: true, canPublish: true } },
    },
  });
  if (!sw) throw notFound("Software");
  return sw;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

function scalarData(input: SoftwareInput) {
  return {
    name: input.name,
    slug: input.slug,
    tagline: input.tagline,
    shortDescription: input.shortDescription,
    description: sanitizeRichText(input.description),
    brandId: input.brandId,
    logoId: input.logoId,
    websiteUrl: input.websiteUrl,
    demoVideoUrl: input.demoVideoUrl,
    pricingModel: input.pricingModel,
    startingPrice: input.pricingModel === "FREE" ? 0 : input.startingPrice ?? null,
    currency: input.currency,
    priceUnit: input.priceUnit,
    priceIncludesGst: input.priceIncludesGst,
    hasFreeTrial: input.hasFreeTrial,
    hasFreeVersion: input.hasFreeVersion || input.pricingModel === "FREEMIUM" || input.pricingModel === "FREE",
    deployment: input.deployment,
    primaryCategoryId: input.primaryCategoryId,
  } satisfies Prisma.SoftwareUncheckedUpdateInput;
}

const flagData = (input: SoftwareInput) => ({
  pros: input.pros,
  cons: input.cons,
  bestFor: input.bestFor ?? null,
  notIdealFor: input.notIdealFor ?? null,
  isFeatured: input.isFeatured,
  isPopular: input.isPopular,
  isTrending: input.isTrending,
  isRecommended: input.isRecommended,
  isSponsored: input.isSponsored,
  sponsoredRank: input.isSponsored ? input.sponsoredRank ?? null : null,
  ...(input.legacyId !== undefined ? { legacyId: input.legacyId } : {}),
});

/** Replaces all child collections in one transaction (simplest correct approach for a full-form editor). */
async function writeChildren(tx: Tx, softwareId: string, input: SoftwareInput) {
  await Promise.all([
    tx.softwareCategory.deleteMany({ where: { softwareId } }),
    tx.softwareIndustry.deleteMany({ where: { softwareId } }),
    tx.softwareTerm.deleteMany({ where: { softwareId } }),
    tx.softwareTag.deleteMany({ where: { softwareId } }),
    tx.softwareFeature.deleteMany({ where: { softwareId } }),
    tx.pricingPlan.deleteMany({ where: { softwareId } }),
    tx.softwareFaq.deleteMany({ where: { softwareId } }),
    tx.softwareMedia.deleteMany({ where: { softwareId } }),
    tx.softwareAttributeValue.deleteMany({ where: { softwareId } }),
    tx.relatedSoftware.deleteMany({ where: { softwareId } }),
  ]);

  if (input.categoryIds.length) {
    await tx.softwareCategory.createMany({
      data: input.categoryIds.map((categoryId) => ({ softwareId, categoryId, isPrimary: categoryId === input.primaryCategoryId })),
    });
  }
  if (input.industryIds.length) {
    await tx.softwareIndustry.createMany({ data: input.industryIds.map((industryId) => ({ softwareId, industryId })) });
  }
  if (input.termIds.length) {
    // Only ids that exist (a term may have been deleted while the form was open).
    const valid = await tx.taxonomyTerm.findMany({ where: { id: { in: [...new Set(input.termIds)] } }, select: { id: true } });
    if (valid.length) await tx.softwareTerm.createMany({ data: valid.map((t) => ({ softwareId, termId: t.id })) });
  }
  for (const name of new Set(input.tags.map((t) => t.trim()).filter(Boolean))) {
    const tagSlug = slugify(name);
    if (!tagSlug) continue;
    const tag = await tx.tag.upsert({ where: { slug: tagSlug }, create: { slug: tagSlug, name }, update: {} });
    await tx.softwareTag.create({ data: { softwareId, tagId: tag.id } });
  }
  if (input.features.length) {
    await tx.softwareFeature.createMany({ data: input.features.map((f, i) => ({ ...f, softwareId, sortOrder: i })) });
  }
  if (input.plans.length) {
    await tx.pricingPlan.createMany({
      data: input.plans.map((p, i) => ({ ...p, price: p.price ?? null, softwareId, sortOrder: i })),
    });
  }
  if (input.faqs.length) {
    await tx.softwareFaq.createMany({
      data: input.faqs.map((f, i) => ({ question: sanitizePlain(f.question), answer: sanitizePlain(f.answer), softwareId, sortOrder: i })),
    });
  }
  if (input.media.length) {
    await tx.softwareMedia.createMany({
      data: input.media.map((m, i) => ({ kind: m.kind, mediaId: m.kind === "VIDEO" ? null : m.mediaId, videoUrl: m.kind === "VIDEO" ? m.videoUrl : null, caption: m.caption, softwareId, sortOrder: i })),
    });
  }
  if (input.attributes.length) {
    const attrs = await tx.attribute.findMany({ where: { id: { in: input.attributes.map((a) => a.attributeId) } }, select: { id: true, type: true } });
    const typeOf = new Map(attrs.map((a) => [a.id, a.type]));
    const rows: Prisma.SoftwareAttributeValueCreateManyInput[] = [];
    for (const a of input.attributes) {
      const type = typeOf.get(a.attributeId);
      if (!type) continue;
      if (type === "SELECT" || type === "MULTISELECT") {
        const optionIds = type === "SELECT" ? a.optionIds.slice(0, 1) : a.optionIds;
        for (const optionId of optionIds) rows.push({ softwareId, attributeId: a.attributeId, optionId });
      } else if (type === "BOOLEAN" && a.valueBool !== null && a.valueBool !== undefined) {
        rows.push({ softwareId, attributeId: a.attributeId, valueBool: a.valueBool });
      } else if (type === "NUMBER" && a.valueNumber !== null && a.valueNumber !== undefined) {
        rows.push({ softwareId, attributeId: a.attributeId, valueNumber: a.valueNumber });
      } else if (type === "TEXT" && a.valueText) {
        rows.push({ softwareId, attributeId: a.attributeId, valueText: a.valueText });
      }
    }
    if (rows.length) await tx.softwareAttributeValue.createMany({ data: rows });
  }
  const relations = [
    ...input.relatedIds.filter((id) => id !== softwareId).map((relatedId, i) => ({ softwareId, relatedId, kind: "RELATED" as const, sortOrder: i })),
    ...input.alternativeIds.filter((id) => id !== softwareId).map((relatedId, i) => ({ softwareId, relatedId, kind: "ALTERNATIVE" as const, sortOrder: i })),
  ];
  if (relations.length) await tx.relatedSoftware.createMany({ data: relations, skipDuplicates: true });
  await refreshSearchDocument(tx, softwareId);
}

/** Rebuilds the full-text document (name, vendor, tags, categories, description). */
export const refreshSearchDocument = (tx: Tx | typeof db, softwareId: string) => tx.$executeRaw`SELECT refresh_software_search(${softwareId})`;

async function snapshot(tx: Tx, id: string): Promise<Prisma.InputJsonValue> {
  const full = await tx.software.findUniqueOrThrow({
    where: { id },
    include: { seo: true, categories: true, industries: true, terms: true, tags: { include: { tag: true } }, features: true, plans: true, faqs: true, media: true, attributes: true, related: true },
  });
  return JSON.parse(JSON.stringify(full)) as Prisma.InputJsonValue;
}

export async function createSoftware(user: Principal, input: SoftwareInput) {
  assertStaffWrite(user);
  assertCanEdit(user);
  const vendorId = user.vendorId ?? input.vendorId;
  try {
    const created = await db.$transaction(async (tx) => {
      const seoId = await upsertSeo(tx, null, input.seo);
      const sw = await tx.software.create({
        data: {
          ...scalarData(input),
          ...(user.vendorId ? {} : flagData(input)),
          vendorId,
          seoId,
          status: "DRAFT",
          updatedById: user.id,
        },
      });
      await writeChildren(tx, sw.id, input);
      await recordRevision(tx, "software", sw.id, await snapshot(tx, sw.id), user.id, input.revisionMessage ?? "Created");
      await audit({ actorId: user.id, action: "software.create", entityType: "software", entityId: sw.id, summary: `Created ${sw.name}` }, tx);
      return sw;
    }, { timeout: 20_000 });
    revalidateSoftware([created.slug]);
    return created;
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new AppError("That URL slug is already used by another product.", "CONFLICT", { slug: ["Already in use"] });
    if (isUniqueViolation(e, "legacyId")) throw new AppError("That old website ID is already used by another product.", "CONFLICT", { legacyId: ["Already in use"] });
    throw e;
  }
}

export async function updateSoftware(user: Principal, id: string, input: SoftwareInput) {
  assertStaffWrite(user);
  const existing = await loadOwned(user, id);
  assertCanEdit(user, existing);
  const current = await db.software.findUniqueOrThrow({ where: { id }, select: { seoId: true } });
  // Removing a feature, plan, FAQ or image needs Delete permission (or the Super Admin's approval).
  const was = toSoftwareInput(await getSoftwareForEdit(user, id));
  const parts = (i: SoftwareInput) => ({ features: i.features, plans: i.plans, faqs: i.faqs, media: i.media });
  await guardRemovals(user, { kind: "software.save", args: { id, input }, label: `Product “${was.name}”`, before: parts(was), after: parts(input), root: "the product" });


  try {
    const updated = await db.$transaction(async (tx) => {
      const seoId = await upsertSeo(tx, current.seoId, input.seo);
      const sw = await tx.software.update({
        where: { id },
        data: {
          ...scalarData(input),
          ...(user.vendorId ? {} : { ...flagData(input), vendorId: input.vendorId }),
          seoId,
          updatedById: user.id,
        },
      });
      await writeChildren(tx, id, input);
      await recordRevision(tx, "software", id, await snapshot(tx, id), user.id, input.revisionMessage ?? undefined);
      await audit(
        { actorId: user.id, action: "software.update", entityType: "software", entityId: id, summary: `Updated ${sw.name}` },
        tx,
      );
      return sw;
    }, { timeout: 20_000 });
    if (existing.slug !== updated.slug) await addSlugRedirect(`/software/${existing.slug}`, `/software/${updated.slug}`);
    revalidateSoftware([existing.slug, updated.slug]);
    return { software: updated, sentForReview: false };
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new AppError("That URL slug is already used by another product.", "CONFLICT", { slug: ["Already in use"] });
    if (isUniqueViolation(e, "legacyId")) throw new AppError("That old website ID is already used by another product.", "CONFLICT", { legacyId: ["Already in use"] });
    throw e;
  }
}

/**
 * Writes a vendor's draft (never-live or currently unpublished product). Only called by the
 * approvals service, which also opens the approval request. Staff-only fields (promotion
 * flags, vendor, SEO) are never taken from vendor input.
 */
export async function saveVendorDraft(user: Principal, id: string | null, input: SoftwareInput) {
  if (!user.vendorId) throw forbidden();
  assertCan(user, "vendor.listings.submit", { vendorId: user.vendorId });
  const data = { ...scalarData(input), vendorId: user.vendorId, updatedById: user.id };
  try {
    const saved = await db.$transaction(async (tx) => {
      let sw;
      if (id) {
        const existing = await tx.software.findUnique({ where: { id }, select: { vendorId: true, status: true } });
        if (!existing || existing.vendorId !== user.vendorId) throw notFound("Software");
        if (existing.status === "PUBLISHED") throw new AppError("This product is live. Changes to it need approval before they apply.", "CONFLICT");
        sw = await tx.software.update({ where: { id }, data: { ...data, status: "DRAFT" } });
      } else {
        sw = await tx.software.create({ data: { ...data, status: "DRAFT" } });
      }
      await writeChildren(tx, sw.id, input);
      await recordRevision(tx, "software", sw.id, await snapshot(tx, sw.id), user.id, input.revisionMessage ?? (id ? "Draft updated by vendor" : "Created by vendor"));
      await audit({ actorId: user.id, action: id ? "software.vendor_draft" : "software.vendor_create", entityType: "software", entityId: sw.id, summary: `${id ? "Updated draft" : "Created draft"} ${sw.name}` }, tx);
      return sw;
    }, { timeout: 20_000 });
    revalidateSoftware([saved.slug]);
    return saved;
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new AppError("That URL slug is already used by another product.", "CONFLICT", { slug: ["Already in use"] });
    if (isUniqueViolation(e, "legacyId")) throw new AppError("That old website ID is already used by another product.", "CONFLICT", { legacyId: ["Already in use"] });
    throw e;
  }
}

type EditRecord = Awaited<ReturnType<typeof getSoftwareForEdit>>;

/** Converts a loaded product into the editor/approval input shape. */
export function toSoftwareInput(sw: EditRecord): SoftwareInput {
  return {
    name: sw.name, slug: sw.slug, tagline: sw.tagline, shortDescription: sw.shortDescription, description: sw.description ?? "",
    vendorId: sw.vendorId, brandId: sw.brandId, logoId: sw.logoId, websiteUrl: sw.websiteUrl, demoVideoUrl: sw.demoVideoUrl,
    pricingModel: sw.pricingModel, startingPrice: sw.startingPrice === null ? null : Number(sw.startingPrice), currency: sw.currency, priceUnit: sw.priceUnit,
    priceIncludesGst: sw.priceIncludesGst, hasFreeTrial: sw.hasFreeTrial, hasFreeVersion: sw.hasFreeVersion, deployment: sw.deployment,
    pros: sw.pros, cons: sw.cons, bestFor: sw.bestFor, notIdealFor: sw.notIdealFor,
    isFeatured: sw.isFeatured, isPopular: sw.isPopular, isTrending: sw.isTrending, isRecommended: sw.isRecommended, isSponsored: sw.isSponsored, sponsoredRank: sw.sponsoredRank, legacyId: sw.legacyId ?? null,
    primaryCategoryId: sw.primaryCategoryId,
    categoryIds: sw.categories.map((c) => c.categoryId).filter((c) => c !== sw.primaryCategoryId),
    industryIds: sw.industries.map((i) => i.industryId),
    termIds: sw.terms.map((t) => t.termId),
    tags: sw.tags.map((t) => t.tag.name),
    features: sw.features.map((f) => ({ title: f.title, description: f.description, icon: f.icon })),
    plans: sw.plans.map((p) => ({ name: p.name, price: p.price === null ? null : Number(p.price), currency: p.currency, billingPeriod: p.billingPeriod, priceUnit: p.priceUnit, description: p.description, features: p.features, isPopular: p.isPopular, ctaLabel: p.ctaLabel })),
    faqs: sw.faqs.map((f) => ({ question: f.question, answer: f.answer })),
    media: sw.media.map((m) => ({ kind: m.kind, mediaId: m.mediaId, videoUrl: m.videoUrl, caption: m.caption })),
    attributes: groupAttributeValues(sw.attributes),
    relatedIds: sw.related.filter((r) => r.kind === "RELATED").map((r) => r.relatedId),
    alternativeIds: sw.related.filter((r) => r.kind === "ALTERNATIVE").map((r) => r.relatedId),
    seo: { title: sw.seo?.title ?? null, description: sw.seo?.description ?? null, keywords: sw.seo?.keywords ?? null, canonicalUrl: sw.seo?.canonicalUrl ?? null, noIndex: sw.seo?.noIndex ?? false, ogImageId: sw.seo?.ogImageId ?? null },
    revisionMessage: null,
  } as SoftwareInput;
}

/**
 * Status workflow.
 * - Staff with software.publish: any transition; PUBLISHED with a future
 *   scheduledAt stays DRAFT and is published by the scheduler.
 * - Vendor users: may submit their own drafts for review (DRAFT → IN_REVIEW),
 *   or publish directly when their vendor has canPublish.
 */
export async function setSoftwareStatus(user: Principal, ids: string[], status: PublishStatus, scheduledAt?: Date | null) {
  const items = await db.software.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, status: true, vendorId: true, publishedAt: true, vendor: { select: { canPublish: true } } },
  });
  if (items.length !== ids.length) throw notFound("One or more listings");

  for (const sw of items) {
    if (user.vendorId) {
      if (!can(user, "vendor.listings", sw)) throw notFound("Software");
      throw forbidden("Publishing and unpublishing need Super Admin approval. Use “Request” in the vendor portal.");
    }
    assertCan(user, status === "IN_REVIEW" || status === "DRAFT" ? "software.edit" : "software.publish");
  }

  const now = new Date();
  const isScheduled = status === "PUBLISHED" && scheduledAt && scheduledAt > now;

  await db.$transaction(async (tx) => {
    for (const sw of items) {
      await tx.software.update({
        where: { id: sw.id },
        data: isScheduled
          ? { status: "DRAFT", scheduledAt }
          : {
              status,
              scheduledAt: null,
              ...(status === "PUBLISHED" && !sw.publishedAt ? { publishedAt: now } : {}),
              updatedById: user.id,
            },
      });
    }
    await audit(
      {
        actorId: user.id,
        action: isScheduled ? "software.schedule" : `software.status.${status.toLowerCase()}`,
        entityType: "software",
        entityId: ids.length === 1 ? ids[0] : null,
        summary: `${isScheduled ? `Scheduled for ${scheduledAt?.toISOString()}` : `Set to ${status}`}: ${items.map((i) => i.name).join(", ").slice(0, 400)}`,
        diff: { ids },
      },
      tx,
    );
  });
  revalidateSoftware(items.map((i) => i.slug));
  const submitted = status === "IN_REVIEW" ? items.filter((i) => i.status !== "IN_REVIEW") : [];
  if (submitted.length) void notifyPublishers(user, submitted).catch((e) => console.error("[software] review notify failed", e));
  return { count: items.length, scheduled: Boolean(isScheduled) };
}

/** Emails everyone who can publish when staff submit listings for review. */
async function notifyPublishers(by: Principal, items: { id: string; name: string }[]) {
  const publishers = await db.user.findMany({
    where: { status: "ACTIVE", vendorId: null, id: { not: by.id }, role: { permissions: { some: { permission: { key: "software.publish" } } } } },
    select: { email: true },
  });
  if (!publishers.length) return;
  await sendTemplate("software_review", publishers.map((p) => p.email), {
    requester_name: by.name,
    item: items.length === 1 ? (items[0]?.name ?? "") : `${items.length} listings`,
    item_list: items.map((i) => i.name).join(", "),
    review_url: items.length === 1 ? `${env.APP_URL}/admin/software/${items[0]?.id}` : `${env.APP_URL}/admin/software?status=IN_REVIEW`,
  });
}

/** Listings submitted for review, for the admin notifications bell and sidebar badge. */
export async function pendingSoftwareReviewSummary(user: Principal) {
  if (!can(user, "software.publish")) return { count: 0, latest: [] };
  const [count, latest] = await Promise.all([
    db.software.count({ where: { status: "IN_REVIEW" } }),
    db.software.findMany({ where: { status: "IN_REVIEW" }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, name: true, updatedAt: true, updatedBy: { select: { name: true } } } }),
  ]);
  return { count, latest };
}

export async function setSoftwareFlag(user: Principal, ids: string[], flag: SoftwareFlag, value: boolean) {
  assertCan(user, "software.edit");
  const items = await db.software.findMany({ where: { id: { in: ids } }, select: { slug: true } });
  await db.$transaction(async (tx) => {
    await tx.software.updateMany({ where: { id: { in: ids } }, data: { [flag]: value, ...(flag === "isSponsored" && !value ? { sponsoredRank: null } : {}) } });
    await audit({ actorId: user.id, action: "software.flag", entityType: "software", summary: `${value ? "Set" : "Cleared"} ${flag} on ${ids.length} listing(s)`, diff: { ids, flag, value } }, tx);
  });
  revalidateSoftware(items.map((i) => i.slug));
}

export async function deleteSoftware(user: Principal, ids: string[]) {
  await guardDelete(user, "software", { ids });
  const items = await db.software.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, name: true, seoId: true } });
  await db.$transaction(async (tx) => {
    await moveToBin(tx, user, "Software", items.map((i) => i.id));
    await tx.software.deleteMany({ where: { id: { in: items.map((i) => i.id) } } });
    const seoIds = items.map((i) => i.seoId).filter((x): x is string => Boolean(x));
    if (seoIds.length) await tx.seoMeta.deleteMany({ where: { id: { in: seoIds } } });
    await tx.revision.deleteMany({ where: { entityType: "software", entityId: { in: items.map((i) => i.id) } } });
    await audit({ actorId: user.id, action: "software.delete", entityType: "software", summary: `Deleted ${items.map((i) => i.name).join(", ").slice(0, 400)}`, diff: { ids } }, tx);
  }, { timeout: 60_000, maxWait: 10_000 });
  revalidateSoftware(items.map((i) => i.slug));
  return items.length;
}

export async function duplicateSoftware(user: Principal, id: string) {
  assertCan(user, "software.create");
  const src = await getSoftwareForEdit(user, id);
  let slug = `${src.slug}-copy`;
  for (let n = 2; await db.software.findUnique({ where: { slug }, select: { id: true } }); n++) slug = `${src.slug}-copy-${n}`;
  const input: SoftwareInput = {
    name: `${src.name} (copy)`,
    slug,
    tagline: src.tagline,
    shortDescription: src.shortDescription,
    description: src.description,
    vendorId: src.vendorId,
    brandId: src.brandId,
    logoId: src.logoId,
    websiteUrl: src.websiteUrl,
    demoVideoUrl: src.demoVideoUrl,
    pricingModel: src.pricingModel,
    startingPrice: src.startingPrice ? Number(src.startingPrice) : null,
    currency: src.currency,
    priceUnit: src.priceUnit,
    priceIncludesGst: src.priceIncludesGst,
    hasFreeTrial: src.hasFreeTrial,
    hasFreeVersion: src.hasFreeVersion,
    deployment: src.deployment,
    pros: src.pros, cons: src.cons, bestFor: src.bestFor, notIdealFor: src.notIdealFor,
    isFeatured: false, isPopular: false, isTrending: false, isRecommended: false, isSponsored: false, sponsoredRank: null,
    primaryCategoryId: src.primaryCategoryId,
    categoryIds: src.categories.map((c) => c.categoryId),
    industryIds: src.industries.map((i) => i.industryId),
    termIds: src.terms.map((t) => t.termId),
    tags: src.tags.map((t) => t.tag.name),
    features: src.features.map((f) => ({ title: f.title, description: f.description, icon: f.icon })),
    plans: src.plans.map((p) => ({ name: p.name, price: p.price ? Number(p.price) : null, currency: p.currency, billingPeriod: p.billingPeriod, priceUnit: p.priceUnit, description: p.description, features: p.features, isPopular: p.isPopular, ctaLabel: p.ctaLabel })),
    faqs: src.faqs.map((f) => ({ question: f.question, answer: f.answer })),
    media: src.media.map((m) => ({ kind: m.kind, mediaId: m.mediaId, videoUrl: m.videoUrl, caption: m.caption })),
    attributes: groupAttributeValues(src.attributes),
    relatedIds: src.related.filter((r) => r.kind === "RELATED").map((r) => r.relatedId),
    alternativeIds: src.related.filter((r) => r.kind === "ALTERNATIVE").map((r) => r.relatedId),
    seo: { title: null, description: null, keywords: null, canonicalUrl: null, noIndex: false, ogImageId: null },
    revisionMessage: `Duplicated from ${src.name}`,
  };
  return createSoftware(user, input);
}

/** Converts stored attribute rows back into editor input shape (one entry per attribute). */
export function groupAttributeValues(rows: { attributeId: string; optionId: string | null; valueText: string | null; valueNumber: Prisma.Decimal | null; valueBool: boolean | null }[]) {
  const map = new Map<string, SoftwareInput["attributes"][number]>();
  for (const r of rows) {
    const entry = map.get(r.attributeId) ?? { attributeId: r.attributeId, optionIds: [], valueText: null, valueNumber: null, valueBool: null };
    if (r.optionId) entry.optionIds.push(r.optionId);
    if (r.valueText !== null) entry.valueText = r.valueText;
    if (r.valueNumber !== null) entry.valueNumber = Number(r.valueNumber);
    if (r.valueBool !== null) entry.valueBool = r.valueBool;
    map.set(r.attributeId, entry);
  }
  return [...map.values()];
}

/** Restores a revision snapshot by replaying it through the normal update path. */
export async function restoreSoftwareRevision(user: Principal, revisionId: string) {
  const rev = await db.revision.findUnique({ where: { id: revisionId } });
  if (!rev || rev.entityType !== "software") throw notFound("Revision");
  type Snap = Awaited<ReturnType<typeof getSoftwareForEdit>>;
  const s = rev.snapshot as unknown as Snap;
  const input: SoftwareInput = {
    name: s.name, slug: s.slug, tagline: s.tagline, shortDescription: s.shortDescription, description: s.description,
    vendorId: s.vendorId, brandId: s.brandId, logoId: s.logoId, websiteUrl: s.websiteUrl, demoVideoUrl: s.demoVideoUrl,
    pricingModel: s.pricingModel, startingPrice: s.startingPrice === null ? null : Number(s.startingPrice), currency: s.currency,
    priceUnit: s.priceUnit, priceIncludesGst: s.priceIncludesGst, hasFreeTrial: s.hasFreeTrial, hasFreeVersion: s.hasFreeVersion,
    deployment: s.deployment, pros: s.pros ?? [], cons: s.cons ?? [], bestFor: s.bestFor ?? null, notIdealFor: s.notIdealFor ?? null, isFeatured: s.isFeatured, isPopular: s.isPopular, isTrending: s.isTrending, isRecommended: s.isRecommended,
    isSponsored: s.isSponsored, sponsoredRank: s.sponsoredRank, primaryCategoryId: s.primaryCategoryId,
    categoryIds: s.categories.map((c) => c.categoryId), industryIds: s.industries.map((i) => i.industryId), termIds: (s.terms ?? []).map((t) => t.termId), tags: s.tags.map((t) => t.tag.name),
    features: s.features.map((f) => ({ title: f.title, description: f.description, icon: f.icon })),
    plans: s.plans.map((p) => ({ name: p.name, price: p.price === null ? null : Number(p.price), currency: p.currency, billingPeriod: p.billingPeriod, priceUnit: p.priceUnit, description: p.description, features: p.features, isPopular: p.isPopular, ctaLabel: p.ctaLabel })),
    faqs: s.faqs.map((f) => ({ question: f.question, answer: f.answer })),
    media: s.media.map((m) => ({ kind: m.kind, mediaId: m.mediaId, videoUrl: m.videoUrl, caption: m.caption })),
    attributes: groupAttributeValues(s.attributes.map((a) => ({ ...a, valueNumber: a.valueNumber === null ? null : new Prisma.Decimal(a.valueNumber) }))),
    relatedIds: s.related.filter((r) => r.kind === "RELATED").map((r) => r.relatedId),
    alternativeIds: s.related.filter((r) => r.kind === "ALTERNATIVE").map((r) => r.relatedId),
    seo: { title: s.seo?.title ?? null, description: s.seo?.description ?? null, keywords: s.seo?.keywords ?? null, canonicalUrl: s.seo?.canonicalUrl ?? null, noIndex: s.seo?.noIndex ?? false, ogImageId: s.seo?.ogImageId ?? null },
    revisionMessage: `Restored version ${rev.version}`,
  };
  return updateSoftware(user, rev.entityId, input);
}

/** Publishes items whose scheduledAt has passed. Called by the cron route. */
export async function publishDueSoftware(): Promise<number> {
  const due = await db.software.findMany({ where: { scheduledAt: { lte: new Date() }, status: { not: "PUBLISHED" } }, select: { id: true, slug: true, publishedAt: true } });
  for (const sw of due) {
    await db.software.update({ where: { id: sw.id }, data: { status: "PUBLISHED", scheduledAt: null, publishedAt: sw.publishedAt ?? new Date() } });
  }
  if (due.length) {
    await audit({ actorId: null, action: "software.scheduled_publish", entityType: "software", summary: `Published ${due.length} scheduled listing(s)`, diff: { ids: due.map((d) => d.id) } });
    revalidateSoftware(due.map((d) => d.slug));
  }
  return due.length;
}

/** Recomputes rating aggregates and popularity after reviews/leads change. */
export async function refreshSoftwareStats(tx: Tx | typeof db, softwareId: string) {
  const agg = await tx.review.aggregate({ where: { softwareId, status: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
  const sw = await tx.software.findUnique({ where: { id: softwareId }, select: { viewCount: true, enquiryCount: true } });
  if (!sw) return;
  const ratingAvg = agg._avg.rating ?? 0;
  const ratingCount = agg._count._all;
  // Popularity: enquiries weigh most, then reviews, then (log) views.
  const popularityScore = sw.enquiryCount * 5 + ratingCount * 3 + ratingAvg * 2 + Math.log10(1 + sw.viewCount) * 4;
  await tx.software.update({ where: { id: softwareId }, data: { ratingAvg, ratingCount, popularityScore } });
}
