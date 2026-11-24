import "server-only";
import { db } from "@/server/db";
import { listRevisions } from "@/server/revisions";
import { getSoftwareForEdit, toSoftwareInput } from "@/server/services/software";
import type { SoftwareInput } from "@/lib/validation/software";
import type { Principal } from "@/server/rbac/policy";
import type { SoftwareFormValues } from "@/lib/validation/software";
import type { EditorProps } from "@/components/admin/software-editor";
import { getSettings } from "@/server/settings";

export const EMPTY_SOFTWARE: SoftwareFormValues = {
  name: "", slug: "", tagline: null, shortDescription: null, description: "", vendorId: null, brandId: null, logoId: null, websiteUrl: null, demoVideoUrl: null,
  pricingModel: "SUBSCRIPTION", startingPrice: null, currency: "INR", priceUnit: "per user / month", priceIncludesGst: false, hasFreeTrial: false, hasFreeVersion: false, deployment: ["CLOUD"],
  pros: [], cons: [], bestFor: null, notIdealFor: null,
  isFeatured: false, isPopular: false, isTrending: false, isRecommended: false, isSponsored: false, sponsoredRank: null,
  primaryCategoryId: null, categoryIds: [], industryIds: [], termIds: [], tags: [], features: [], plans: [], faqs: [], media: [], attributes: [], relatedIds: [], alternativeIds: [],
  seo: { title: null, description: null, keywords: null, canonicalUrl: null, noIndex: false, ogImageId: null }, revisionMessage: null,
};

/** Builds everything the editor needs. Vendor users only get their own vendor's brands. */
/** `override` replaces the stored values, e.g. a vendor's pending (not yet approved) changes. */
export async function loadEditor(user: Principal, id: string | null, backHref: string, override?: SoftwareInput | null): Promise<EditorProps> {
  const [vendors, brands, categories, industries, attributes, terms] = await Promise.all([
    user.vendorId ? Promise.resolve([]) : db.vendor.findMany({ where: { kind: "VENDOR" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.brand.findMany({ where: user.vendorId ? { isActive: true, OR: [{ vendorId: user.vendorId }, { vendorId: null }] } : {}, orderBy: { name: "asc" }, select: { id: true, name: true, vendorId: true } }),
    db.category.findMany({ where: { isActive: true }, orderBy: [{ path: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, depth: true, path: true } }),
    db.industry.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.attribute.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }], include: { options: { orderBy: { sortOrder: "asc" }, select: { id: true, label: true } } } }),
    db.taxonomyTerm.findMany({ where: { isActive: true }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { name: "asc" }], select: { id: true, kind: true, name: true, parentId: true } }),
  ]);
  // Order categories as a tree: parents followed by their children.
  const sortedCats = [...categories].sort((a, b) => `${a.path}${a.id}`.localeCompare(`${b.path}${b.id}`));
  const base = {
    mode: user.vendorId ? ("vendor" as const) : ("staff" as const),
    vendors,
    brands,
    categories: sortedCats.map(({ id: cid, name, depth }) => ({ id: cid, name, depth })),
    industries,
    terms,
    attributes: attributes.map((a) => ({ id: a.id, label: a.label, group: a.group, type: a.type, unit: a.unit, options: a.options })),
    can: { publish: user.permissions.has("software.publish"), delete: user.permissions.has("software.delete"), submit: user.permissions.has("vendor.listings.submit"), requestRemoval: user.permissions.has("vendor.listings.delete") },
    backHref,
  };
  if (!id) return { ...base, defaults: { ...EMPTY_SOFTWARE, currency: (await getSettings()).rules.defaultCurrency, vendorId: user.vendorId }, previews: { media: {} }, revisions: [] };

  const sw = await getSoftwareForEdit(user, id);
  const revisions = await listRevisions("software", id);
  return {
    ...base,
    softwareId: sw.id,
    status: sw.status,
    scheduledAt: sw.scheduledAt?.toISOString() ?? null,
    publishedAt: sw.publishedAt?.toISOString() ?? null,
    vendorCanPublish: sw.vendor?.canPublish ?? false,
    defaults: (override ?? toSoftwareInput(sw)) as SoftwareFormValues,
    previews: {
      logo: sw.logo?.url ?? null,
      media: Object.fromEntries(sw.media.filter((m) => m.media).map((m) => [m.media!.id, { url: m.media!.url, filename: m.media!.filename, mimeType: m.media!.mimeType }])),
    },
    revisions: revisions.map((r) => ({ id: r.id, version: r.version, message: r.message, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null })),
  };
}
