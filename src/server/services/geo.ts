import "server-only";
import { z } from "zod";
import type { GeoLevel, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { sanitizePlain } from "@/server/sanitize";
import { getSettings, type Settings } from "@/server/settings";
import { GEO_STARTER } from "@/lib/geo-starter";
import { withBin } from "@/server/system/trash";
import { guardDelete } from "@/server/rbac/deletion";

/**
 * Geo: Country → State → City → Area locations, and local landing pages for a product or a brand
 * (vendor) in a city or area. URLs: /{location}/{vendor} and /{location}/{productRouteBase}/{product}.
 */

export const GEO_LEVELS = ["COUNTRY", "STATE", "CITY", "AREA"] as const;
export const PARENT_LEVEL: Record<GeoLevel, GeoLevel | null> = { COUNTRY: null, STATE: "COUNTRY", CITY: "STATE", AREA: "CITY" };
export const SECTION_KEYS = ["hero", "introduction", "guide", "faqs"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const slugRule = z
  .string()
  .trim()
  .max(80)
  .transform((s) => s.toLowerCase())
  .refine((s) => !s || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s), "Lowercase letters, numbers and hyphens only");
const toSlug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
const list = (max: number, item: z.ZodString) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : v.split(/[,\n]/)).map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(item).max(max));

export const locationInput = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  slug: slugRule.optional().default(""),
  level: z.enum(GEO_LEVELS),
  parentId: z.string().cuid().nullable().optional().default(null),
  isPublished: z.boolean().default(true),
  priority: z.coerce.number().int().min(-100).max(100).default(0),
  latitude: z.union([z.literal(""), z.null(), z.coerce.number().min(-90).max(90)]).optional().transform((v) => (typeof v === "number" ? v : null)),
  longitude: z.union([z.literal(""), z.null(), z.coerce.number().min(-180).max(180)]).optional().transform((v) => (typeof v === "number" ? v : null)),
  pinCodes: list(500, z.string().regex(/^\d{6}$/, "PIN codes have 6 digits")).default([]),
  businessZones: list(100, z.string().max(80)).default([]),
});

function refreshGeo() {
  revalidatePath("/", "layout");
}

// ─── Locations ───────────────────────────────────────────────────────────────

export async function listLocations(user: Principal) {
  assertCan(user, "geo.view");
  const rows = await db.geoLocation.findMany({
    orderBy: [{ level: "asc" }, { priority: "desc" }, { name: "asc" }],
    include: { _count: { select: { children: true, pages: true } } },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const pathOf = (id: string | null): string[] => {
    const out: string[] = [];
    for (let cur = id ? byId.get(id) : undefined, i = 0; cur && i < 6; cur = cur.parentId ? byId.get(cur.parentId) : undefined, i++) out.unshift(cur.name);
    return out;
  };
  return rows.map((r) => ({ ...r, path: pathOf(r.id).join(" › ") }));
}

async function assertParent(level: GeoLevel, parentId: string | null, id: string | null) {
  const want = PARENT_LEVEL[level];
  if (!want) {
    if (parentId) throw new AppError("Countries don't have a parent.", "BAD_REQUEST", { parentId: ["Leave empty for a country"] });
    return;
  }
  if (!parentId) throw new AppError(`Choose the ${want.toLowerCase()} this ${level.toLowerCase()} is in.`, "BAD_REQUEST", { parentId: ["Required"] });
  if (parentId === id) throw new AppError("A location can't be its own parent.", "BAD_REQUEST", { parentId: ["Choose another"] });
  const parent = await db.geoLocation.findUnique({ where: { id: parentId }, select: { level: true } });
  if (!parent || parent.level !== want) throw new AppError(`The parent of a ${level.toLowerCase()} must be a ${want.toLowerCase()}.`, "BAD_REQUEST", { parentId: ["Wrong level"] });
}

export async function saveLocation(user: Principal, id: string | null, raw: unknown) {
  assertCan(user, id ? "geo.manage" : "geo.create");
  const i = locationInput.parse(raw);
  const slug = i.slug || toSlug(i.name);
  await assertParent(i.level, i.parentId, id);
  const clash = await db.geoLocation.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) }, select: { name: true } });
  if (clash) throw new AppError(`“${clash.name}” already uses this slug. Slugs must be unique because they appear in URLs.`, "CONFLICT", { slug: ["Already in use"] });
  if (id) {
    const current = await db.geoLocation.findUnique({ where: { id }, select: { level: true, _count: { select: { children: true } } } });
    if (!current) throw notFound("Location");
    if (current.level !== i.level && current._count.children) throw new AppError("Move or delete the locations inside this one before changing its level.");
  }
  const data = { name: sanitizePlain(i.name), slug, level: i.level, parentId: i.parentId, isPublished: i.isPublished, priority: i.priority, latitude: i.latitude, longitude: i.longitude, pinCodes: i.pinCodes, businessZones: i.businessZones.map(sanitizePlain) };
  const loc = id ? await db.geoLocation.update({ where: { id }, data }) : await db.geoLocation.create({ data });
  await audit({ actorId: user.id, action: id ? "geo.location_update" : "geo.location_create", entityType: "geo_location", entityId: loc.id, summary: `${loc.level.toLowerCase()} ${loc.name}` });
  refreshGeo();
  return loc;
}

/** Publishes or unpublishes a location (bulk select on City pages › Geo locations). */
export async function setLocationPublished(user: Principal, id: string, isPublished: boolean) {
  assertCan(user, "geo.manage");
  const loc = await db.geoLocation.update({ where: { id }, data: { isPublished }, select: { name: true } });
  await audit({ actorId: user.id, action: isPublished ? "geo.location_publish" : "geo.location_unpublish", entityType: "geo_location", entityId: id, summary: loc.name });
  refreshGeo();
}

export async function deleteLocation(user: Principal, id: string) {
  await guardDelete(user, "geoLocation", { id });
  const loc = await db.geoLocation.findUnique({ where: { id }, include: { _count: { select: { children: true, pages: true } } } });
  if (!loc) throw notFound("Location");
  if (loc._count.children) throw new AppError(`${loc.name} has ${loc._count.children} locations inside it. Delete or move those first.`, "CONFLICT");
  if (loc._count.pages) throw new AppError(`${loc.name} has ${loc._count.pages} geo pages. Delete those first, or unpublish the location instead.`, "CONFLICT");
  await withBin(user, "GeoLocation", [id], (tx) => tx.geoLocation.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "geo.location_delete", entityType: "geo_location", entityId: id, summary: loc.name });
  refreshGeo();
}

/** Adds missing starter locations and re-attaches starter locations that lost their parent. */
export async function installStarterLocations(user: Principal) {
  assertCan(user, "geo.create");
  const existing = await db.geoLocation.findMany({ select: { id: true, slug: true, parentId: true } });
  const idOf = new Map(existing.map((l) => [l.slug, l.id]));
  let added = 0;
  let repaired = 0;
  for (const loc of GEO_STARTER) {
    const parentId = loc.parent ? idOf.get(loc.parent) ?? null : null;
    const found = existing.find((e) => e.slug === loc.slug);
    if (found) {
      if (loc.parent && !found.parentId && parentId) {
        await db.geoLocation.update({ where: { id: found.id }, data: { parentId } });
        repaired++;
      }
      continue;
    }
    const created = await db.geoLocation.create({ data: { name: loc.name, slug: loc.slug, level: loc.level, parentId, priority: loc.priority ?? 0 } });
    idOf.set(loc.slug, created.id);
    added++;
  }
  await audit({ actorId: user.id, action: "geo.install", entityType: "geo_location", summary: `Starter locations: ${added} added, ${repaired} repaired` });
  refreshGeo();
  return { added, repaired };
}

// ─── Geo pages ───────────────────────────────────────────────────────────────

const faq = z.object({ question: z.string().trim().max(300), answer: z.string().trim().max(2000) });

export const geoPageInput = z
  .object({
    locationId: z.string().cuid("Choose a city or area"),
    targetType: z.enum(["software", "vendor"]),
    targetId: z.string().cuid("Choose a product or brand"),
    template: z.enum(["generic"]).default("generic"),
    isPublished: z.boolean().default(false),
    noIndex: z.boolean().default(false),
    hero: z.string().max(400).default(""),
    introduction: z.string().max(4000).default(""),
    guide: z.string().max(6000).default(""),
    faqs: z.array(faq).max(20).default([]),
    inherit: z.array(z.enum(SECTION_KEYS)).default([...SECTION_KEYS]),
    seoTitle: z.string().max(120).default(""),
    seoDescription: z.string().max(300).default(""),
  });

async function assertTarget(locationId: string, targetType: "software" | "vendor", targetId: string) {
  const loc = await db.geoLocation.findUnique({ where: { id: locationId }, select: { level: true } });
  if (!loc || (loc.level !== "CITY" && loc.level !== "AREA")) throw new AppError("Geo pages are for a city or an area.", "BAD_REQUEST", { locationId: ["Choose a city or area"] });
  const ok = targetType === "software" ? await db.software.findUnique({ where: { id: targetId }, select: { id: true } }) : await db.vendor.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!ok) throw new AppError("That product or brand no longer exists.", "BAD_REQUEST", { targetId: ["Not found"] });
}

const sectionsJson = (i: z.infer<typeof geoPageInput>) =>
  ({
    hero: sanitizePlain(i.hero),
    introduction: sanitizePlain(i.introduction),
    guide: sanitizePlain(i.guide),
    faqs: i.faqs.filter((f) => f.question && f.answer).map((f) => ({ question: sanitizePlain(f.question), answer: sanitizePlain(f.answer) })),
  }) as Prisma.InputJsonValue;

export async function listGeoPages(user: Principal, q: { search?: string; status?: string }) {
  assertCan(user, "geo.view");
  const where: Prisma.GeoPageWhereInput = {
    ...(q.status === "published" ? { isPublished: true } : q.status === "draft" ? { isPublished: false } : {}),
    ...(q.search
      ? { OR: [{ location: { name: { contains: q.search, mode: "insensitive" } } }, { software: { name: { contains: q.search, mode: "insensitive" } } }, { vendor: { name: { contains: q.search, mode: "insensitive" } } }] }
      : {}),
  };
  return db.geoPage.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 500,
    include: { location: { select: { id: true, name: true, slug: true, level: true } }, software: { select: { id: true, name: true, slug: true, status: true } }, vendor: { select: { id: true, name: true, slug: true } } },
  });
}

export async function saveGeoPage(user: Principal, id: string | null, raw: unknown) {
  assertCan(user, id ? "geo.manage" : "geo.create");
  const i = geoPageInput.parse(raw);
  await assertTarget(i.locationId, i.targetType, i.targetId);
  const target = i.targetType === "software" ? { softwareId: i.targetId, vendorId: null } : { vendorId: i.targetId, softwareId: null };
  const dupe = await db.geoPage.findFirst({ where: { locationId: i.locationId, ...target, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (dupe) throw new AppError("A geo page for this product or brand in this location already exists.", "CONFLICT", { locationId: ["Already has a page"] });
  const data = {
    locationId: i.locationId,
    ...target,
    template: i.template,
    isPublished: i.isPublished,
    noIndex: i.noIndex,
    sections: sectionsJson(i),
    inherit: i.inherit,
    seoTitle: i.seoTitle.trim() ? sanitizePlain(i.seoTitle) : null,
    seoDescription: i.seoDescription.trim() ? sanitizePlain(i.seoDescription) : null,
  };
  const page = id ? await db.geoPage.update({ where: { id }, data }) : await db.geoPage.create({ data });
  await audit({ actorId: user.id, action: id ? "geo.page_update" : "geo.page_create", entityType: "geo_page", entityId: page.id, summary: `${i.targetType} page${i.isPublished ? " (published)" : " (draft)"}` });
  refreshGeo();
  return page;
}

export async function deleteGeoPages(user: Principal, ids: string[]) {
  await guardDelete(user, "geoPages", { ids });
  const pages = await db.geoPage.findMany({ where: { id: { in: ids } }, select: { id: true, location: { select: { name: true } }, software: { select: { name: true } }, vendor: { select: { name: true } } } });
  const labels = Object.fromEntries(pages.map((p) => [p.id, `${p.software?.name ?? p.vendor?.name ?? "Page"} in ${p.location.name}`]));
  const res = await withBin(user, "GeoPage", pages.map((p) => p.id), (tx) => tx.geoPage.deleteMany({ where: { id: { in: pages.map((p) => p.id) } } }), labels);
  await audit({ actorId: user.id, action: "geo.page_delete", entityType: "geo_page", summary: `Deleted ${res.count} geo pages` });
  refreshGeo();
  return res.count;
}

export async function setGeoPagesPublished(user: Principal, ids: string[], isPublished: boolean) {
  assertCan(user, "geo.manage");
  const res = await db.geoPage.updateMany({ where: { id: { in: ids } }, data: { isPublished } });
  await audit({ actorId: user.id, action: "geo.page_publish", entityType: "geo_page", summary: `${isPublished ? "Published" : "Unpublished"} ${res.count} geo pages` });
  refreshGeo();
  return res.count;
}

/** Creates pages (template text only) for one product or brand in many locations; skips existing ones. */
export async function bulkCreateGeoPages(user: Principal, raw: unknown) {
  assertCan(user, "geo.create");
  const i = z.object({ targetType: z.enum(["software", "vendor"]), targetId: z.string().cuid("Choose a product or brand"), locationIds: z.array(z.string().cuid()).min(1, "Choose at least one location").max(500), isPublished: z.boolean().default(false) }).parse(raw);
  const locs = await db.geoLocation.findMany({ where: { id: { in: i.locationIds }, level: { in: ["CITY", "AREA"] } }, select: { id: true } });
  const target = i.targetType === "software" ? { softwareId: i.targetId } : { vendorId: i.targetId };
  const existing = new Set((await db.geoPage.findMany({ where: { ...target, locationId: { in: locs.map((l) => l.id) } }, select: { locationId: true } })).map((p) => p.locationId));
  const toCreate = locs.filter((l) => !existing.has(l.id));
  if (toCreate.length) {
    await db.geoPage.createMany({ data: toCreate.map((l) => ({ locationId: l.id, ...target, isPublished: i.isPublished, sections: {} })), skipDuplicates: true });
  }
  await audit({ actorId: user.id, action: "geo.page_bulk", entityType: "geo_page", summary: `Created ${toCreate.length} geo pages (${existing.size} already existed)` });
  refreshGeo();
  return { created: toCreate.length, skipped: existing.size };
}

// ─── Public ──────────────────────────────────────────────────────────────────

export interface GeoContext {
  name: string;
  city: string;
  state: string;
  country: string;
  site_name: string;
}

export const fillGeo = (text: string, ctx: GeoContext) => text.replace(/\{\{\s*(name|city|state|country|site_name)\s*\}\}/g, (_, k: keyof GeoContext) => ctx[k] ?? "");

/** Section text: the page's own, else the template's (if this section inherits), with tokens filled. */
export function resolveSections(page: { sections: Prisma.JsonValue; inherit: string[] }, template: Settings["geo"]["template"], ctx: GeoContext) {
  const own = (page.sections ?? {}) as { hero?: string; introduction?: string; guide?: string; faqs?: { question: string; answer: string }[] };
  const pick = (key: "hero" | "introduction" | "guide") => {
    const v = own[key]?.trim();
    return v ? v : page.inherit.includes(key) ? template[key] : "";
  };
  const faqs = own.faqs?.length ? own.faqs : page.inherit.includes("faqs") ? template.faqs : [];
  return {
    hero: fillGeo(pick("hero"), ctx),
    introduction: fillGeo(pick("introduction"), ctx),
    guide: fillGeo(pick("guide"), ctx),
    faqs: faqs.filter((f) => f.question && f.answer).map((f) => ({ question: fillGeo(f.question, ctx), answer: fillGeo(f.answer, ctx) })),
  };
}

async function publicLocation(slug: string) {
  const loc = await db.geoLocation.findFirst({
    where: { slug, isPublished: true, level: { in: ["CITY", "AREA"] } },
    include: { parent: { include: { parent: { include: { parent: true } } } } },
  });
  if (!loc) return null;
  const chain = [loc.parent, loc.parent?.parent, loc.parent?.parent?.parent].filter(Boolean) as { name: string; level: GeoLevel }[];
  const city = loc.level === "AREA" ? `${loc.name}, ${chain.find((c) => c.level === "CITY")?.name ?? ""}`.replace(/, $/, "") : loc.name;
  return { ...loc, cityLabel: city, state: chain.find((c) => c.level === "STATE")?.name ?? "", country: chain.find((c) => c.level === "COUNTRY")?.name ?? "" };
}

/** /{location}/{vendor} */
export async function getBrandGeoPage(locationSlug: string, vendorSlug: string) {
  const settings = await getSettings();
  if (!settings.geo.enabled) return null;
  const location = await publicLocation(locationSlug);
  if (!location) return null;
  const vendor = await db.vendor.findFirst({ where: { slug: vendorSlug, isActive: true, kind: "VENDOR" }, include: { logo: true } });
  if (!vendor) return null;
  const page = await db.geoPage.findFirst({ where: { locationId: location.id, vendorId: vendor.id, isPublished: true } });
  if (!page) return null;
  const ctx: GeoContext = { name: vendor.name, city: location.cityLabel, state: location.state, country: location.country, site_name: settings.site.name };
  const [products, otherCities] = await Promise.all([
    db.software.findMany({ where: { vendorId: vendor.id, status: "PUBLISHED" }, orderBy: { popularityScore: "desc" }, take: 12, select: { id: true } }),
    db.geoPage.findMany({ where: { vendorId: vendor.id, isPublished: true, id: { not: page.id }, location: { isPublished: true } }, take: 20, select: { location: { select: { name: true, slug: true, latitude: true, longitude: true } } } }),
  ]);
  return { settings, location, vendor, page, ctx, sections: resolveSections(page, settings.geo.template, ctx), productIds: products.map((p) => p.id), otherCities: otherCities.map((o) => o.location) };
}

/** /{location}/{productRouteBase}/{product} */
export async function getProductGeoPage(locationSlug: string, base: string, productSlug: string) {
  const settings = await getSettings();
  if (!settings.geo.enabled || base !== settings.geo.productRouteBase) return null;
  const location = await publicLocation(locationSlug);
  if (!location) return null;
  const sw = await db.software.findFirst({ where: { slug: productSlug, status: "PUBLISHED" }, select: { id: true, name: true } });
  if (!sw) return null;
  const page = await db.geoPage.findFirst({ where: { locationId: location.id, softwareId: sw.id, isPublished: true } });
  if (!page) return null;
  const ctx: GeoContext = { name: sw.name, city: location.cityLabel, state: location.state, country: location.country, site_name: settings.site.name };
  const [otherCities, nearby] = await Promise.all([
    db.geoPage.findMany({ where: { softwareId: sw.id, isPublished: true, id: { not: page.id }, location: { isPublished: true } }, take: 20, select: { location: { select: { name: true, slug: true, latitude: true, longitude: true } } } }),
    db.geoPage.findMany({ where: { locationId: location.id, isPublished: true, id: { not: page.id }, software: { status: "PUBLISHED" } }, take: 8, select: { software: { select: { name: true, slug: true } } } }),
  ]);
  return { settings, location, page, ctx, sections: resolveSections(page, settings.geo.template, ctx), otherCities: otherCities.map((o) => o.location), nearby: nearby.flatMap((n) => (n.software ? [n.software] : [])) };
}

/** URL of a geo page, for links and the sitemap. */
export const geoPagePath = (base: string, location: string, target: { software?: { slug: string } | null; vendor?: { slug: string } | null }) =>
  target.software ? `/${location}/${base}/${target.software.slug}` : target.vendor ? `/${location}/${target.vendor.slug}` : null;
