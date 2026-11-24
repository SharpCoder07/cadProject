import "server-only";
import { withBin } from "@/server/system/trash";
import type { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, forbidden, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { sanitizePlain } from "@/server/sanitize";
import { assertNoBlockedWords } from "@/server/moderation";
import { openRequest } from "./approvals";
import { revalidateSoftware, softwareTag } from "./software";
import { guardDelete } from "@/server/rbac/deletion";

/**
 * Resellers are channel partners that resell vendors' products. They are Vendor rows with
 * kind = RESELLER, so they share the portal, team, approvals and plans. Differences:
 * - they don't own products; instead they propose "authorised products" (needs approval),
 * - every enquiry for a product they resell is shared with them automatically and emailed to them;
 *   contact details stay masked until they buy a reseller plan.
 */

export type PartnerKind = "VENDOR" | "RESELLER";

export async function companyKind(companyId: string): Promise<PartnerKind> {
  const v = await db.vendor.findUnique({ where: { id: companyId }, select: { kind: true } });
  if (!v) throw notFound("Company");
  return v.kind;
}

/** Throws when a portal user's company isn't of the given kind (e.g. a reseller trying to add a product). */
export async function assertCompanyKind(user: Principal, kind: PartnerKind) {
  if (!user.vendorId) return;
  if ((await companyKind(user.vendorId)) !== kind) {
    throw forbidden(kind === "VENDOR" ? "Resellers can't manage products, offers or reviews. Use Authorised products instead." : "Only resellers can do this.");
  }
}

function resellerOf(user: Principal) {
  if (!user.vendorId) throw forbidden("Only reseller-portal users can do this.");
  assertCan(user, "vendor.authorised", { vendorId: user.vendorId });
  return user.vendorId;
}

const entityKey = (resellerId: string, softwareId: string) => `${resellerId}:${softwareId}`;
const cleanLevel = (s: string | null | undefined) => (s ? sanitizePlain(s).trim().slice(0, 60) || null : null);

// ─── Reseller portal ─────────────────────────────────────────────────────────

export async function listMyAuthorised(user: Principal) {
  const resellerId = user.vendorId;
  if (!resellerId) throw forbidden();
  assertCan(user, "vendor.portal", { vendorId: resellerId });
  const [items, pending] = await Promise.all([
    db.resellerProduct.findMany({
      where: { resellerId },
      orderBy: { software: { name: "asc" } },
      select: { id: true, partnerLevel: true, createdAt: true, software: { select: { id: true, name: true, slug: true, status: true, logo: { select: { url: true } }, vendor: { select: { name: true } } } } },
    }),
    db.approvalRequest.findMany({ where: { vendorId: resellerId, entityType: "RESELLER_PRODUCT", status: "PENDING" }, select: { id: true, entityId: true, action: true, entityLabel: true, payload: true, createdAt: true } }),
  ]);
  return {
    items: items.map((i) => ({ ...i, pending: pending.find((p) => p.entityId === entityKey(resellerId, i.software.id)) ?? null })),
    pendingNew: pending.filter((p) => p.action === "CREATE"),
  };
}

/** Published products a reseller can still ask to resell. */
export async function searchProductsToResell(user: Principal, q: string) {
  const resellerId = resellerOf(user);
  return db.software.findMany({
    where: { status: "PUBLISHED", name: { contains: q.trim(), mode: "insensitive" }, resellers: { none: { resellerId } } },
    orderBy: { name: "asc" },
    take: 12,
    select: { id: true, name: true, logo: { select: { url: true } }, vendor: { select: { name: true } } },
  });
}

/**
 * The catalogue a reseller browses to pick products to resell: published products with search,
 * category and status filters, each marked authorised / waiting for approval / available.
 */
export async function browseProductsForReseller(user: Principal, opts: { q?: string; category?: string; show?: "all" | "available" | "mine"; page?: number }) {
  const resellerId = user.vendorId;
  if (!resellerId) throw forbidden();
  assertCan(user, "vendor.portal", { vendorId: resellerId });
  const perPage = 24;
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim().slice(0, 80);
  const pending = await db.approvalRequest.findMany({ where: { vendorId: resellerId, entityType: "RESELLER_PRODUCT", status: "PENDING" }, select: { entityId: true, action: true } });
  const pendingIds = new Map(pending.map((p) => [p.entityId.split(":")[1] ?? "", p.action]));
  const where: Prisma.SoftwareWhereInput = {
    status: "PUBLISHED",
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { vendor: { name: { contains: q, mode: "insensitive" } } }, { brand: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    ...(opts.category ? { categories: { some: { category: { OR: [{ slug: opts.category }, { parent: { slug: opts.category } }] } } } } : {}),
    ...(opts.show === "mine" ? { resellers: { some: { resellerId } } } : opts.show === "available" ? { resellers: { none: { resellerId } } } : {}),
  };
  const [items, total, categories, mine] = await Promise.all([
    db.software.findMany({
      where,
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true, name: true, slug: true, tagline: true, startingPrice: true, currency: true, pricingModel: true,
        logo: { select: { url: true } },
        vendor: { select: { name: true } },
        brand: { select: { name: true, isActive: true } },
        primaryCategory: { select: { name: true } },
        resellers: { where: { resellerId }, select: { partnerLevel: true } },
        _count: { select: { resellers: true } },
      },
    }),
    db.software.count({ where }),
    db.category.findMany({ where: { parentId: null, isActive: true }, orderBy: { name: "asc" }, select: { slug: true, name: true } }),
    db.resellerProduct.count({ where: { resellerId } }),
  ]);
  return {
    items: items.map(({ resellers, _count, ...i }) => ({
      ...i,
      authorised: resellers[0] ? { partnerLevel: resellers[0].partnerLevel } : null,
      pending: pendingIds.get(i.id) ?? null,
      otherResellers: Math.max(0, _count.resellers - (resellers[0] ? 1 : 0)),
    })),
    total,
    page,
    perPage,
    pages: Math.max(1, Math.ceil(total / perPage)),
    categories,
    mine,
    pendingCount: pending.filter((p) => p.action === "CREATE").length,
  };
}

/** Reseller asks to resell a product, or to change its partner level. Needs Super Admin approval. */
export async function proposeResellerProduct(user: Principal, softwareId: string, partnerLevel: string | null, note?: string | null) {
  const resellerId = resellerOf(user);
  await assertCompanyKind(user, "RESELLER");
  await assertNoBlockedWords({ partnerLevel, note });
  const sw = await db.software.findFirst({ where: { id: softwareId, status: "PUBLISHED" }, select: { id: true, name: true } });
  if (!sw) throw notFound("Product");
  const existing = await db.resellerProduct.findUnique({ where: { resellerId_softwareId: { resellerId, softwareId } } });
  const level = cleanLevel(partnerLevel);
  if (existing && existing.partnerLevel === level) throw new AppError("Nothing to change.");
  await openRequest({
    vendorId: resellerId,
    requestedById: user.id,
    entityType: "RESELLER_PRODUCT",
    entityId: entityKey(resellerId, softwareId),
    entityLabel: sw.name,
    action: existing ? "UPDATE" : "CREATE",
    payload: { softwareId, partnerLevel: level },
    before: existing ? { softwareId, partnerLevel: existing.partnerLevel } : null,
    note,
  });
  return { message: existing ? "Change sent for approval" : `Request to resell ${sw.name} sent for approval` };
}

export async function proposeResellerProductRemoval(user: Principal, softwareId: string, note?: string | null) {
  const resellerId = resellerOf(user);
  const existing = await db.resellerProduct.findUnique({ where: { resellerId_softwareId: { resellerId, softwareId } }, include: { software: { select: { name: true } } } });
  if (!existing) throw notFound("Authorised product");
  await openRequest({
    vendorId: resellerId,
    requestedById: user.id,
    entityType: "RESELLER_PRODUCT",
    entityId: entityKey(resellerId, softwareId),
    entityLabel: existing.software.name,
    action: "DELETE",
    before: { softwareId, partnerLevel: existing.partnerLevel },
    note,
  });
  return { message: "Removal sent for approval" };
}

/** Applies an approved RESELLER_PRODUCT request (approver's authority). */
export async function applyResellerProductRequest(approver: Principal, r: { vendorId: string; entityId: string; action: string; payload: Prisma.JsonValue }) {
  const softwareId = r.entityId.split(":")[1] ?? "";
  const sw = await db.software.findUnique({ where: { id: softwareId }, select: { slug: true } });
  if (!sw) throw new AppError("This product no longer exists.", "CONFLICT");
  if (r.action === "DELETE") {
    // Approved removals go to the recycle bin too, so the Super Admin can undo them.
    const row = await db.resellerProduct.findUnique({ where: { resellerId_softwareId: { resellerId: r.vendorId, softwareId } }, include: { software: { select: { name: true } }, reseller: { select: { name: true } } } });
    if (row) await withBin(approver, "ResellerProduct", [row.id], (tx) => tx.resellerProduct.delete({ where: { id: row.id } }), { [row.id]: `${row.software.name} (resold by ${row.reseller.name})` });
  } else {
    const level = cleanLevel((r.payload as { partnerLevel?: string | null } | null)?.partnerLevel);
    await db.resellerProduct.upsert({ where: { resellerId_softwareId: { resellerId: r.vendorId, softwareId } }, create: { resellerId: r.vendorId, softwareId, partnerLevel: level }, update: { partnerLevel: level } });
  }
  revalidateSoftware([sw.slug]);
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/** Staff add or update an authorised product directly (no approval needed). */
export async function setAuthorisedProduct(user: Principal, resellerId: string, softwareId: string, partnerLevel: string | null) {
  assertCan(user, "vendors.manage");
  if ((await companyKind(resellerId)) !== "RESELLER") throw new AppError("This company isn't a reseller.");
  const sw = await db.software.findUnique({ where: { id: softwareId }, select: { name: true, slug: true } });
  if (!sw) throw notFound("Product");
  const level = cleanLevel(partnerLevel);
  await db.resellerProduct.upsert({ where: { resellerId_softwareId: { resellerId, softwareId } }, create: { resellerId, softwareId, partnerLevel: level }, update: { partnerLevel: level } });
  await audit({ actorId: user.id, action: "reseller.product_set", entityType: "vendor", entityId: resellerId, summary: `Authorised to resell ${sw.name}${level ? ` (${level})` : ""}` });
  revalidateSoftware([sw.slug]);
}

export async function removeAuthorisedProduct(user: Principal, resellerId: string, softwareId: string) {
  const row = await db.resellerProduct.findUnique({ where: { resellerId_softwareId: { resellerId, softwareId } }, include: { software: { select: { name: true, slug: true } }, reseller: { select: { name: true } } } });
  if (!row) return;
  await guardDelete(user, "resellerProduct", { resellerId, softwareId }, `${row.software.name} (resold by ${row.reseller.name})`);
  // Kept in the recycle bin so it can be restored.
  await withBin(user, "ResellerProduct", [row.id], (tx) => tx.resellerProduct.delete({ where: { id: row.id } }), { [row.id]: `${row.software.name} (resold by ${row.reseller.name})` });
  await audit({ actorId: user.id, action: "reseller.product_remove", entityType: "vendor", entityId: resellerId, summary: `No longer authorised to resell ${row.software.name}` });
  revalidateSoftware([row.software.slug]);
}

// ─── Website ─────────────────────────────────────────────────────────────────

/** Authorised resellers shown on a product page. */
export const authorisedResellers = (softwareId: string, slug: string) =>
  unstable_cache(
    () =>
      db.resellerProduct.findMany({
        where: { softwareId, reseller: { kind: "RESELLER", isActive: true } },
        orderBy: { reseller: { name: "asc" } },
        take: 24,
        select: { partnerLevel: true, reseller: { select: { name: true, slug: true, city: true, state: true, serviceCities: true, verification: true, logo: { select: { url: true } } } } },
      }),
    ["resellers", softwareId],
    { tags: [softwareTag(slug), "catalog"], revalidate: 3600 },
  )().then((rows) => rows.sort((a, b) => Number(b.reseller.verification === "VERIFIED") - Number(a.reseller.verification === "VERIFIED")).slice(0, 12));
