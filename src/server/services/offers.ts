import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { AppError, forbidden, notFound } from "@/server/errors";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { BUYER_ROLE_KEY } from "@/server/rbac/permissions";
import { sendTemplate } from "@/server/email/config";
import { detailsTable } from "@/server/email/templates";
import { openRequest } from "./approvals";
import { assertCompanyKind } from "./resellers";
import { assertNoBlockedWords } from "@/server/moderation";
import { revalidateSoftware } from "./software";
import { withBin } from "@/server/system/trash";
import { notifyNow } from "@/server/notifications/notify";
import { guardDelete } from "@/server/rbac/deletion";

/**
 * Product offers (staff create them directly; vendors propose them on their own products and a
 * Super Admin approves) and product favourites (buyer accounts bookmark any product). When an offer
 * goes live — on approval/publish if it has started, otherwise from the cron job — everyone who
 * favourited the product gets one email.
 */

const OFFERS_TAG = "offers";
const offersTag = (softwareId: string) => `offers:${softwareId}`;

const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
const optText = (max: number) => z.string().max(max).transform(clean).optional().nullable().transform((v) => v || null);

export const offerInput = z
  .object({
    softwareId: z.string().cuid("Choose a product"),
    title: z.string().min(1, "Enter a title").max(100).transform(clean),
    discount: z.string().min(1, "Enter the discount, e.g. 20% off").max(60).transform(clean),
    description: optText(500),
    couponCode: z
      .string()
      .max(40)
      .transform((v) => v.trim().toUpperCase())
      .refine((v) => !v || /^[A-Z0-9][A-Z0-9_-]*$/.test(v), "Letters, numbers, - and _ only")
      .optional()
      .nullable()
      .transform((v) => v || null),
    terms: optText(1000),
    url: z.union([z.string().trim().url("Enter a full link starting with https://").max(500).refine((u) => /^https?:\/\//.test(u), "Use an http(s) link"), z.literal("")]).optional().nullable().transform((v) => v || null),
    startsAt: z.coerce.date({ invalid_type_error: "Choose a start date" }),
    // "" and null mean "no end date" (checked before coercion: Date(null) would be 1970).
    endsAt: z.union([z.literal(""), z.null(), z.coerce.date()]).optional().transform((v) => (v instanceof Date ? v : null)),
  })
  .refine((o) => !o.endsAt || o.endsAt > o.startsAt, { message: "The end must be after the start", path: ["endsAt"] });
export type OfferInput = z.infer<typeof offerInput>;

const toData = (i: OfferInput) => ({ title: i.title, discount: i.discount, description: i.description, couponCode: i.couponCode, terms: i.terms, url: i.url, startsAt: i.startsAt, endsAt: i.endsAt });

/** What's stored on an approval request (dates as ISO strings so the diff reads well). */
export const offerSnapshot = (o: { softwareId: string; title: string; discount: string; description: string | null; couponCode: string | null; terms: string | null; url: string | null; startsAt: Date; endsAt: Date | null }) => ({
  softwareId: o.softwareId,
  title: o.title,
  discount: o.discount,
  description: o.description,
  couponCode: o.couponCode,
  terms: o.terms,
  url: o.url,
  startsAt: o.startsAt.toISOString(),
  endsAt: o.endsAt?.toISOString() ?? null,
});

export type OfferPhase = "draft" | "scheduled" | "live" | "ended";
export function offerPhase(o: { status: string; startsAt: Date; endsAt: Date | null }, now = new Date()): OfferPhase {
  if (o.status !== "PUBLISHED") return "draft";
  if (o.endsAt && o.endsAt <= now) return "ended";
  return o.startsAt > now ? "scheduled" : "live";
}

function refresh(softwareId: string, slug?: string | null) {
  revalidateTag(OFFERS_TAG);
  revalidateTag(offersTag(softwareId));
  revalidateSoftware([slug]);
}

// ─── Public ──────────────────────────────────────────────────────────────────

/**
 * Published offers that haven't ended (cached 5 minutes); callers filter by start time at render.
 * The data cache stores JSON, so dates are turned back into Date objects here.
 */
export const currentOffers = async (softwareId: string) =>
  (await cachedOffers(softwareId)).map((o) => ({ ...o, startsAt: new Date(o.startsAt), endsAt: o.endsAt ? new Date(o.endsAt) : null }));

const cachedOffers = (softwareId: string) =>
  unstable_cache(
    () =>
      db.productOffer.findMany({
        where: { softwareId, status: "PUBLISHED", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
        orderBy: { startsAt: "desc" },
        select: { id: true, title: true, discount: true, description: true, couponCode: true, terms: true, url: true, startsAt: true, endsAt: true },
      }),
    ["offers:current", softwareId],
    { tags: [OFFERS_TAG, offersTag(softwareId)], revalidate: 300 },
  )();

/** Offers live right now across the catalogue, newest first (homepage "Live deals" block, cached 5 minutes). */
export async function liveDeals(limit: number) {
  const rows = await cachedDeals(limit);
  const now = new Date();
  return rows
    .map((o) => ({ ...o, startsAt: new Date(o.startsAt), endsAt: o.endsAt ? new Date(o.endsAt) : null }))
    .filter((o) => o.startsAt <= now && (!o.endsAt || o.endsAt > now));
}

const cachedDeals = (limit: number) =>
  unstable_cache(
    () =>
      db.productOffer.findMany({
        where: { status: "PUBLISHED", startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }], software: { status: "PUBLISHED" } },
        orderBy: { startsAt: "desc" },
        take: limit,
        select: {
          id: true, title: true, discount: true, couponCode: true, url: true, startsAt: true, endsAt: true,
          software: { select: { name: true, slug: true, logo: { select: { url: true, alt: true } }, vendor: { select: { name: true } }, primaryCategory: { select: { name: true } } } },
        },
      }),
    ["offers:live", String(limit)],
    { tags: [OFFERS_TAG], revalidate: 300 },
  )();

// ─── Staff ───────────────────────────────────────────────────────────────────

export async function listOffersAdmin(user: Principal, q: { phase?: string; softwareId?: string }) {
  assertCan(user, "offers.view");
  const now = new Date();
  const where: Prisma.ProductOfferWhereInput = {
    ...(q.softwareId ? { softwareId: q.softwareId } : {}),
    ...(q.phase === "live"
      ? { status: "PUBLISHED", startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
      : q.phase === "scheduled"
        ? { status: "PUBLISHED", startsAt: { gt: now } }
        : q.phase === "ended"
          ? { status: "PUBLISHED", endsAt: { lte: now } }
          : q.phase === "draft"
            ? { status: "DRAFT" }
            : {}),
  };
  return db.productOffer.findMany({
    where,
    orderBy: [{ startsAt: "desc" }],
    take: 200,
    include: { software: { select: { id: true, name: true, slug: true, vendor: { select: { name: true } } } }, createdBy: { select: { name: true, vendorId: true } } },
  });
}

function assertStaff(user: Principal) {
  if (user.vendorId) throw forbidden("Vendors propose offers from the vendor portal.");
  assertCan(user, "offers.manage");
}

/** Creates or edits an offer. `publish` makes it live (now or at its start date). */
export async function saveOffer(user: Principal, id: string | null, raw: unknown, publish: boolean) {
  assertStaff(user);
  const input = offerInput.parse(raw);
  await assertNoBlockedWords({ title: input.title, discount: input.discount, description: input.description, terms: input.terms, couponCode: input.couponCode });
  const sw = await db.software.findUnique({ where: { id: input.softwareId }, select: { id: true, slug: true, name: true } });
  if (!sw) throw notFound("Product");
  const before = id ? await db.productOffer.findUnique({ where: { id } }) : null;
  if (id && !before) throw notFound("Offer");
  const data = { ...toData(input), softwareId: sw.id, status: publish ? ("PUBLISHED" as const) : (before?.status ?? "DRAFT") };
  const offer = id ? await db.productOffer.update({ where: { id }, data }) : await db.productOffer.create({ data: { ...data, createdById: user.id } });
  await audit({ actorId: user.id, action: id ? "offer.update" : "offer.create", entityType: "offer", entityId: offer.id, summary: `${offer.title} (${offer.discount}) on ${sw.name}${offer.status === "PUBLISHED" ? "" : " — draft"}` });
  refresh(sw.id, sw.slug);
  if (offer.status === "PUBLISHED") void dispatchOfferLaunches([offer.id]);
  return offer;
}

export async function endOffer(user: Principal, id: string) {
  assertStaff(user);
  const o = await db.productOffer.update({ where: { id }, data: { endsAt: new Date() }, include: { software: { select: { slug: true } } } });
  await audit({ actorId: user.id, action: "offer.end", entityType: "offer", entityId: id, summary: `Ended ${o.title}` });
  refresh(o.softwareId, o.software.slug);
}

export async function deleteOffer(user: Principal, id: string) {
  assertStaff(user);
  const o = await db.productOffer.findUnique({ where: { id }, include: { software: { select: { slug: true } } } });
  if (!o) throw notFound("Offer");
  await guardDelete(user, "offer", { id }, o.title);
  await withBin(user, "ProductOffer", [id], (tx) => Promise.all([
    tx.productOffer.delete({ where: { id } }),
    tx.approvalRequest.updateMany({ where: { entityType: "OFFER", entityId: id, status: "PENDING" }, data: { status: "CANCELLED", decisionNote: "The offer was deleted by staff", decidedAt: new Date() } }),
  ]));
  await audit({ actorId: user.id, action: "offer.delete", entityType: "offer", entityId: id, summary: o.title });
  refresh(o.softwareId, o.software.slug);
}

// ─── Vendor proposals ────────────────────────────────────────────────────────

function vendorOf(user: Principal) {
  if (!user.vendorId) throw forbidden();
  assertCan(user, "vendor.offers", { vendorId: user.vendorId });
  return user.vendorId;
}

export async function listVendorOffers(user: Principal & { vendorId: string }) {
  const [offers, products, requests] = await Promise.all([
    db.productOffer.findMany({
      where: { software: { vendorId: user.vendorId } },
      orderBy: [{ startsAt: "desc" }],
      include: { software: { select: { id: true, name: true, slug: true, status: true } } },
    }),
    db.software.findMany({ where: { vendorId: user.vendorId, status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true } }),
    db.approvalRequest.findMany({
      where: { vendorId: user.vendorId, entityType: "OFFER" },
      orderBy: { createdAt: "desc" },
      select: { entityId: true, action: true, status: true, decisionNote: true, payload: true, createdAt: true },
    }),
  ]);
  return { offers, products, requests };
}

/** New offer, or a change to an existing one: becomes an approval request. */
export async function proposeOffer(user: Principal, id: string | null, raw: unknown, note?: string | null) {
  const vendorId = vendorOf(user);
  await assertCompanyKind(user, "VENDOR");
  const input = offerInput.parse(raw);
  await assertNoBlockedWords({ ...{ title: input.title, discount: input.discount, description: input.description, terms: input.terms, couponCode: input.couponCode }, note });
  const sw = await db.software.findUnique({ where: { id: input.softwareId }, select: { id: true, name: true, vendorId: true } });
  if (!sw || sw.vendorId !== vendorId) throw notFound("Product");

  if (!id) {
    const draft = await db.productOffer.create({ data: { ...toData(input), softwareId: sw.id, status: "DRAFT", createdById: user.id } });
    await openRequest({ vendorId, requestedById: user.id, entityType: "OFFER", entityId: draft.id, entityLabel: `${input.title} — ${sw.name}`, action: "CREATE", payload: offerSnapshot({ ...draft }), before: null, note });
    return { message: "Offer sent for approval" };
  }

  const current = await db.productOffer.findUnique({ where: { id }, include: { software: { select: { vendorId: true, name: true } } } });
  if (!current || current.software.vendorId !== vendorId) throw notFound("Offer");
  if (current.software.vendorId !== sw.vendorId) throw new AppError("An offer can only move between your own products.");
  if (current.status === "DRAFT") {
    // Not live yet: edit the draft and refresh (or reopen) its creation request.
    const draft = await db.productOffer.update({ where: { id }, data: { ...toData(input), softwareId: sw.id } });
    await openRequest({ vendorId, requestedById: user.id, entityType: "OFFER", entityId: id, entityLabel: `${input.title} — ${sw.name}`, action: "CREATE", payload: offerSnapshot(draft), before: null, note });
    return { message: "Offer sent for approval" };
  }
  await openRequest({
    vendorId, requestedById: user.id, entityType: "OFFER", entityId: id, entityLabel: `${input.title} — ${sw.name}`, action: "UPDATE",
    payload: offerSnapshot({ ...input, softwareId: sw.id }), before: offerSnapshot(current), note,
  });
  return { message: "Changes sent for approval. The current offer stays as it is until then." };
}

/** Removing a live offer needs approval; an unapproved draft is simply withdrawn. */
export async function proposeOfferRemoval(user: Principal, id: string, note?: string | null) {
  const vendorId = vendorOf(user);
  await assertCompanyKind(user, "VENDOR");
  const current = await db.productOffer.findUnique({ where: { id }, include: { software: { select: { vendorId: true, name: true } } } });
  if (!current || current.software.vendorId !== vendorId) throw notFound("Offer");
  if (current.status === "DRAFT") {
    await db.$transaction([
      db.approvalRequest.updateMany({ where: { entityType: "OFFER", entityId: id, status: "PENDING" }, data: { status: "CANCELLED", decisionNote: "Withdrawn by the vendor", decidedAt: new Date() } }),
      db.productOffer.delete({ where: { id } }),
    ]);
    await audit({ actorId: user.id, action: "offer.withdraw", entityType: "offer", entityId: id, summary: current.title });
    return { message: "Offer withdrawn" };
  }
  await openRequest({ vendorId, requestedById: user.id, entityType: "OFFER", entityId: id, entityLabel: `${current.title} — ${current.software.name}`, action: "DELETE", payload: null, before: offerSnapshot(current), note });
  return { message: "Removal sent for approval" };
}

/** Called by the approvals service when a Super Admin approves an OFFER request. */
export async function applyOfferRequest(approver: Principal, r: { entityId: string; action: string; payload: Prisma.JsonValue }) {
  const current = await db.productOffer.findUnique({ where: { id: r.entityId }, include: { software: { select: { slug: true } } } });
  if (!current) throw new AppError("This offer no longer exists.", "CONFLICT");
  if (r.action === "DELETE") {
    // Approved removals go to the recycle bin too, so the Super Admin can undo them.
    await withBin(approver, "ProductOffer", [r.entityId], (tx) => tx.productOffer.delete({ where: { id: r.entityId } }));
    refresh(current.softwareId, current.software.slug);
    return;
  }
  const input = offerInput.parse(r.payload);
  const sw = await db.software.findUnique({ where: { id: input.softwareId }, select: { slug: true } });
  if (!sw) throw new AppError("The product no longer exists.", "CONFLICT");
  await db.productOffer.update({ where: { id: r.entityId }, data: { ...toData(input), softwareId: input.softwareId, status: "PUBLISHED" } });
  await audit({ actorId: approver.id, action: r.action === "CREATE" ? "offer.publish" : "offer.update", entityType: "offer", entityId: r.entityId, summary: `${input.title} (${input.discount}) — vendor offer approved` });
  refresh(input.softwareId, sw.slug);
  void dispatchOfferLaunches([r.entityId]);
}

// ─── Launch emails ───────────────────────────────────────────────────────────

const ist = (d: Date) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" }).format(d);

/**
 * Emails everyone who favourited the product of each offer that is live and hasn't been announced.
 * Safe to call repeatedly (each offer is claimed once). Returns how many emails were sent.
 */
export async function dispatchOfferLaunches(onlyIds?: string[]): Promise<number> {
  const now = new Date();
  let sent = 0;
  try {
    const due = await db.productOffer.findMany({
      where: {
        ...(onlyIds ? { id: { in: onlyIds } } : {}),
        status: "PUBLISHED",
        launchNotifiedAt: null,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        software: { status: "PUBLISHED" },
      },
      include: { software: { select: { id: true, name: true, slug: true } } },
      take: 50,
    });
    for (const offer of due) {
      const claimed = await db.productOffer.updateMany({ where: { id: offer.id, launchNotifiedAt: null }, data: { launchNotifiedAt: new Date() } });
      if (!claimed.count) continue;
      const fans = await db.productFavourite.findMany({
        // Buyer accounts only (favourites used to be a vendor-portal feature).
        where: { softwareId: offer.softwareId, user: { status: "ACTIVE", offerEmails: true, role: { key: BUYER_ROLE_KEY } } },
        select: { user: { select: { id: true, name: true, email: true } } },
      });
      // Bell + browser push for every buyer who saved the product (separate from the offer-email switch).
      const savers = await db.productFavourite.findMany({ where: { softwareId: offer.softwareId, user: { status: "ACTIVE", role: { key: BUYER_ROLE_KEY } } }, select: { userId: true } });
      if (savers.length) {
        await notifyNow({ users: savers.map((f) => f.userId) }, {
          type: "offer.new",
          title: `New offer on ${offer.software.name}: ${offer.discount}`,
          body: offer.title + (offer.couponCode ? ` · Code ${offer.couponCode}` : "") + (offer.endsAt ? ` · Until ${ist(offer.endsAt)}` : ""),
          href: `/software/${offer.software.slug}`,
        });
      }
      const productUrl = `${env.APP_URL}/software/${offer.software.slug}`;
      const vars = {
        product_name: offer.software.name,
        offer_title: offer.title,
        discount: offer.discount,
        coupon_code: offer.couponCode ?? "",
        valid_until: offer.endsAt ? ist(offer.endsAt) : "until further notice",
        offer_details: detailsTable([
          ["Offer", offer.title],
          ["Discount", offer.discount],
          ["Coupon code", offer.couponCode],
          ["Valid", `${ist(offer.startsAt)} – ${offer.endsAt ? ist(offer.endsAt) : "until further notice"}`],
          ["Details", offer.description],
          ["Terms", offer.terms],
        ]),
        offer_url: offer.url ?? productUrl,
        favourites_url: `${env.APP_URL}/account/favourites`,
      };
      for (const { user } of fans) {
        const r = await sendTemplate("offer_launched", user.email, { ...vars, user_name: user.name }).catch((e: unknown) => ({ delivered: false, reason: e instanceof Error ? e.message : "error" }));
        if (r.delivered) sent++;
      }
      await audit({ actorId: null, action: "offer.announced", entityType: "offer", entityId: offer.id, summary: `${offer.title}: emailed ${fans.length} favourite${fans.length === 1 ? "" : "s"}` });
    }
  } catch (e) {
    console.error("[offers] launch emails failed", e);
  }
  return sent;
}

// ─── Favourites ──────────────────────────────────────────────────────────────

function assertFavouriter(user: Principal | null): asserts user is Principal {
  if (!user) throw new AppError("Sign in to save favourites.", "UNAUTHENTICATED");
  if (!can(user, "buyer.account")) throw forbidden("Favourites are for buyer accounts. Sign in with a buyer account to save products.");
}

export async function setFavourite(user: Principal | null, softwareId: string, on: boolean) {
  assertFavouriter(user);
  const sw = await db.software.findFirst({ where: { id: softwareId, status: "PUBLISHED" }, select: { id: true } });
  if (!sw) throw notFound("Product");
  if (on) await db.productFavourite.upsert({ where: { userId_softwareId: { userId: user.id, softwareId } }, create: { userId: user.id, softwareId }, update: {} });
  else await db.productFavourite.deleteMany({ where: { userId: user.id, softwareId } });
}

/**
 * State of the heart on a product page. Signed-out visitors see it too (clicking asks them to sign
 * in); staff and vendor accounts don't (`eligible: false`).
 */
export async function favouriteStatus(user: Principal | null, slug: string) {
  const sw = await db.software.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } });
  if (!sw) return { signedIn: Boolean(user), eligible: false, favourited: false, softwareId: null };
  if (!user) return { signedIn: false, eligible: true, favourited: false, softwareId: sw.id };
  if (!user.permissions.has("buyer.account")) return { signedIn: true, eligible: false, favourited: false, softwareId: null };
  const fav = await db.productFavourite.findUnique({ where: { userId_softwareId: { userId: user.id, softwareId: sw.id } }, select: { id: true } });
  return { signedIn: true, eligible: true, favourited: Boolean(fav), softwareId: sw.id };
}

export async function listFavourites(user: Principal) {
  assertFavouriter(user);
  const now = new Date();
  const [favs, me] = await Promise.all([
    db.productFavourite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        software: {
          select: {
            id: true, name: true, slug: true, tagline: true, status: true,
            logo: { select: { url: true } },
            vendor: { select: { name: true } },
            offers: { where: { status: "PUBLISHED", startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, orderBy: { startsAt: "desc" }, select: { id: true, title: true, discount: true, couponCode: true, endsAt: true } },
          },
        },
      },
    }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { offerEmails: true } }),
  ]);
  return { favourites: favs, offerEmails: me.offerEmails };
}

export async function setOfferEmails(user: Principal, on: boolean) {
  assertFavouriter(user);
  await db.user.update({ where: { id: user.id }, data: { offerEmails: on } });
}

/** Published products matching a search, for the "add a favourite" box. */
export async function searchProductsForFavourites(user: Principal, q: string) {
  assertFavouriter(user);
  const term = q.trim();
  if (term.length < 2) return [];
  return db.software.findMany({
    where: { status: "PUBLISHED", name: { contains: term, mode: "insensitive" } },
    orderBy: [{ popularityScore: "desc" }],
    take: 8,
    select: { id: true, name: true, slug: true, vendor: { select: { name: true } }, logo: { select: { url: true } } },
  });
}
