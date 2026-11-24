import "server-only";
import { revalidateTag } from "next/cache";
import { db, type Tx } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, forbidden, isUniqueViolation, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { sanitizeRichText } from "@/server/sanitize";
import type { AttributeInput, BrandInput, IndustryInput, VendorInput } from "@/lib/validation/taxonomy";
import { upsertSeo } from "./seo";
import { moveToBin, withBin } from "@/server/system/trash";
import { guardDelete, guardRemovals } from "@/server/rbac/deletion";

const conflict = (e: unknown, what: string): never => {
  if (isUniqueViolation(e, "slug")) throw new AppError(`That URL slug is already used by another ${what}.`, "CONFLICT", { slug: ["Already in use"] });
  if (isUniqueViolation(e, "key")) throw new AppError(`That key is already used by another ${what}.`, "CONFLICT", { key: ["Already in use"] });
  throw e;
};

const touchCatalog = () => {
  revalidateTag("catalog");
  revalidateTag("taxonomy");
};

// ─── Vendors ─────────────────────────────────────────────────────────────────

const vendorData = (i: VendorInput) => ({
  name: i.name, slug: i.slug, legalName: i.legalName, description: i.description, website: i.website, email: i.email ?? null,
  phone: i.phone, addressLine: i.addressLine, city: i.city, state: i.state, country: i.country, foundedYear: i.foundedYear ?? null,
  employeeRange: i.employeeRange, logoId: i.logoId, isActive: i.isActive, receivesLeads: i.receivesLeads,
  serviceCities: [...new Set(i.serviceCities.map((c) => c.trim()).filter(Boolean))],
});

export async function saveVendor(user: Principal, id: string | null, input: VendorInput) {
  // Vendor-portal users propose profile changes through the approvals service instead.
  if (user.vendorId) throw forbidden("Company profile changes need Super Admin approval. Submit them from the vendor portal.");
  assertCan(user, id ? "vendors.manage" : "vendors.create");
  try {
    const vendor = await db.$transaction(async (tx) => {
      const existing = id ? await tx.vendor.findUnique({ where: { id }, select: { seoId: true, slug: true, isActive: true, receivesLeads: true } }) : null;
      if (id && !existing) throw notFound("Vendor");
      if (user.vendorId && !existing) throw notFound("Vendor");
      const seoId = user.vendorId ? existing?.seoId ?? null : await upsertSeo(tx, existing?.seoId ?? null, input.seo);
      // Vendor-portal users can't change their URL, visibility or lead access.
      const adminOnly = user.vendorId && existing ? { slug: existing.slug, isActive: existing.isActive, receivesLeads: existing.receivesLeads } : {};
      const data = { ...vendorData(input), ...adminOnly, seoId };
      // The kind (vendor or reseller) is set once, when the company is created.
      const v = id ? await tx.vendor.update({ where: { id }, data }) : await tx.vendor.create({ data: { ...data, kind: input.kind ?? "VENDOR" } });
      await audit({ actorId: user.id, action: id ? "vendor.update" : "vendor.create", entityType: "vendor", entityId: v.id, summary: `${id ? "Updated" : "Created"} vendor ${v.name}` }, tx);
      // Vendor name is part of each product's search document.
      if (id) await tx.$executeRaw`SELECT refresh_software_search(s."id") FROM "Software" s WHERE s."vendorId" = ${v.id}`;
      return v;
    });
    touchCatalog();
    return vendor;
  } catch (e) {
    return conflict(e, "vendor");
  }
}

export async function setVendorVerification(user: Principal, id: string, verification: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED", canPublish: boolean) {
  assertCan(user, "vendors.verify");
  const before = await db.vendor.findUnique({ where: { id }, select: { name: true, verification: true, canPublish: true } });
  if (!before) throw notFound("Vendor");
  await db.$transaction(async (tx) => {
    await tx.vendor.update({
      where: { id },
      data: { verification, canPublish: verification === "VERIFIED" ? canPublish : false, verifiedAt: verification === "VERIFIED" ? new Date() : null },
    });
    await audit(
      { actorId: user.id, action: "vendor.verification", entityType: "vendor", entityId: id, summary: `${before.name}: ${before.verification} → ${verification}, publishing ${canPublish ? "allowed" : "not allowed"}`, diff: { before, after: { verification, canPublish } } },
      tx,
    );
  });
  touchCatalog();
}

export async function deleteVendor(user: Principal, id: string) {
  await guardDelete(user, "vendor", { id });
  const v = await db.vendor.findUnique({ where: { id }, include: { _count: { select: { software: true, users: true } } } });
  if (!v) throw notFound("Vendor");
  if (v._count.software > 0) throw new AppError(`Reassign or delete this vendor's ${v._count.software} listing(s) first.`, "CONFLICT");
  if (v._count.users > 0) throw new AppError("Remove this vendor's portal users first.", "CONFLICT");
  await db.$transaction(async (tx) => {
    await moveToBin(tx, user, "Vendor", [id]);
    await tx.vendor.delete({ where: { id } });
    if (v.seoId) await tx.seoMeta.delete({ where: { id: v.seoId } }).catch(() => undefined);
    await audit({ actorId: user.id, action: "vendor.delete", entityType: "vendor", entityId: id, summary: `Deleted vendor ${v.name}` }, tx);
  }, { timeout: 60_000, maxWait: 10_000 });
  touchCatalog();
}

// ─── Brands ──────────────────────────────────────────────────────────────────

export async function saveBrand(user: Principal, id: string | null, input: BrandInput) {
  assertCan(user, id ? "vendors.manage" : "vendors.create");
  try {
    const brand = await db.$transaction(async (tx) => {
      const existing = id ? await tx.brand.findUnique({ where: { id }, select: { seoId: true } }) : null;
      const seoId = await upsertSeo(tx, existing?.seoId ?? null, input.seo);
      const { seo: _seo, ...rest } = input;
      const data = { ...rest, vendorId: input.vendorId ?? null, logoId: input.logoId ?? null, seoId };
      return id ? tx.brand.update({ where: { id }, data }) : tx.brand.create({ data });
    });
    await audit({ actorId: user.id, action: id ? "brand.update" : "brand.create", entityType: "brand", entityId: brand.id, summary: `${id ? "Updated" : "Created"} brand ${brand.name}` });
    touchCatalog();
    return brand;
  } catch (e) {
    return conflict(e, "brand");
  }
}

export async function deleteBrand(user: Principal, id: string) {
  await guardDelete(user, "brand", { id });
  const b = await withBin(user, "Brand", [id], (tx) => tx.brand.delete({ where: { id } })).catch(() => null);
  if (!b) throw notFound("Brand");
  await audit({ actorId: user.id, action: "brand.delete", entityType: "brand", entityId: id, summary: `Deleted brand ${b.name}` });
  touchCatalog();
}

// ─── Industries ──────────────────────────────────────────────────────────────

export async function saveIndustry(user: Principal, id: string | null, input: IndustryInput) {
  assertCan(user, id ? "taxonomy.manage" : "taxonomy.create");
  try {
    const result = await db.$transaction(async (tx) => {
      const existing = id ? await tx.industry.findUnique({ where: { id }, select: { seoId: true } }) : null;
      const seoId = await upsertSeo(tx, existing?.seoId ?? null, input.seo);
      const data = { name: input.name, slug: input.slug, description: input.description, content: sanitizeRichText(input.content), icon: input.icon, imageId: input.imageId, isActive: input.isActive, seoId };
      const ind = id ? await tx.industry.update({ where: { id }, data }) : await tx.industry.create({ data });
      await audit({ actorId: user.id, action: id ? "industry.update" : "industry.create", entityType: "industry", entityId: ind.id, summary: ind.name }, tx);
      return ind;
    });
    touchCatalog();
    return result;
  } catch (e) {
    return conflict(e, "industry");
  }
}

export async function deleteIndustry(user: Principal, id: string) {
  await guardDelete(user, "industry", { id });
  const ind = await withBin(user, "Industry", [id], (tx) => tx.industry.delete({ where: { id } })).catch(() => null);
  if (!ind) throw notFound("Industry");
  await audit({ actorId: user.id, action: "industry.delete", entityType: "industry", entityId: id, summary: ind.name });
  touchCatalog();
}

// ─── Attributes ──────────────────────────────────────────────────────────────

/** Puts the options of an attribute that are about to be removed (all but `keepIds`) in the recycle bin. */
async function binOptions(tx: Tx, user: Principal, attributeId: string, attributeLabel: string, keepIds: string[]) {
  const gone = await tx.attributeOption.findMany({ where: { attributeId, id: { notIn: keepIds } }, select: { id: true, label: true } });
  if (gone.length) await moveToBin(tx, user, "AttributeOption", gone.map((o) => o.id), Object.fromEntries(gone.map((o) => [o.id, `${o.label} (option of “${attributeLabel}”)`])));
}

export async function saveAttribute(user: Principal, id: string | null, input: AttributeInput) {
  assertCan(user, id ? "taxonomy.manage" : "taxonomy.create");
  const { options, ...fields } = input;
  if (id) {
    const cur = await db.attribute.findUnique({ where: { id }, include: { options: true } });
    // Removing an option also removes the product values that use it.
    const kept = fields.type === "SELECT" || fields.type === "MULTISELECT" ? options : [];
    if (cur) await guardRemovals(user, { kind: "attribute.save", args: { id, input }, label: `Attribute “${cur.label}”`, before: { options: cur.options.map((o) => ({ id: o.id, label: o.label })) }, after: { options: kept.map((o) => ({ id: o.id ?? "", label: o.label })) }, root: "the attribute" });
  }
  try {
    const attr = await db.$transaction(async (tx) => {
      const a = id ? await tx.attribute.update({ where: { id }, data: fields }) : await tx.attribute.create({ data: fields });
      if (fields.type === "SELECT" || fields.type === "MULTISELECT") {
        const keepIds = options.map((o) => o.id).filter((x): x is string => Boolean(x));
        // Removing an option also removes product values that used it (cascade); both go to the recycle bin.
        await binOptions(tx, user, a.id, a.label, keepIds);
        await tx.attributeOption.deleteMany({ where: { attributeId: a.id, id: { notIn: keepIds } } });
        for (const [i, o] of options.entries()) {
          if (o.id) await tx.attributeOption.update({ where: { id: o.id }, data: { value: o.value, label: o.label, sortOrder: i } });
          else await tx.attributeOption.create({ data: { attributeId: a.id, value: o.value, label: o.label, sortOrder: i } });
        }
      } else {
        await binOptions(tx, user, a.id, a.label, []);
        await tx.attributeOption.deleteMany({ where: { attributeId: a.id } });
      }
      await audit({ actorId: user.id, action: id ? "attribute.update" : "attribute.create", entityType: "attribute", entityId: a.id, summary: a.label }, tx);
      return a;
    });
    touchCatalog();
    return attr;
  } catch (e) {
    if (isUniqueViolation(e, "value")) throw new AppError("Two options have the same value.", "CONFLICT", { options: ["Option values must be unique"] });
    return conflict(e, "attribute");
  }
}

export async function deleteAttribute(user: Principal, id: string) {
  await guardDelete(user, "attribute", { id });
  const a = await withBin(user, "Attribute", [id], (tx) => tx.attribute.delete({ where: { id } })).catch(() => null);
  if (!a) throw notFound("Attribute");
  await audit({ actorId: user.id, action: "attribute.delete", entityType: "attribute", entityId: id, summary: a.label });
  touchCatalog();
}

export async function reorderAttributes(user: Principal, orderedIds: string[]) {
  assertCan(user, "taxonomy.manage");
  await db.$transaction(orderedIds.map((id, i) => db.attribute.update({ where: { id }, data: { sortOrder: i } })));
  touchCatalog();
}
