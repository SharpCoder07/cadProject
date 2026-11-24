import { z } from "zod";
import { email, optionalId, optionalPhone, optionalText, optionalUrl, requiredText, seoInput, slug } from "./common";

export const categoryLayout = z.object({
  view: z.enum(["rows", "grid"]).default("rows"),
  defaultSort: z.enum(["relevance", "popular", "rating", "price_asc", "price_desc", "name", "newest"]).default("popular"),
  showSubcategories: z.boolean().default(true),
  showFeatured: z.boolean().default(true),
  showBuyingGuide: z.boolean().default(true),
  showFaq: z.boolean().default(true),
  bannerPlacement: z.string().max(60).default(""),
});
export type CategoryLayout = z.infer<typeof categoryLayout>;

export const categoryInput = z.object({
  name: requiredText(80),
  slug,
  shortName: optionalText(40),
  description: optionalText(400),
  content: z.string().max(100_000).nullish(),
  icon: optionalText(40),
  parentId: optionalId,
  isActive: z.boolean().default(true),
  showInNav: z.boolean().default(true),
  imageId: optionalId,
  bannerId: optionalId,
  layout: categoryLayout.default({}),
  featuredSoftwareIds: z.array(z.string().cuid()).max(24).default([]),
  attributes: z.array(z.object({ attributeId: z.string().cuid(), isFilter: z.boolean().default(true) })).max(40).default([]),
  seo: seoInput.default({ noIndex: false }),
});
export type CategoryInput = z.infer<typeof categoryInput>;

export const categoryMove = z.object({
  id: z.string().cuid(),
  parentId: z.string().cuid().nullable(),
  /** Sibling ids in their new order under parentId (including id). */
  orderedSiblingIds: z.array(z.string().cuid()).max(500),
});

export const industryInput = z.object({
  name: requiredText(80),
  slug,
  description: optionalText(400),
  content: z.string().max(100_000).nullish(),
  icon: optionalText(40),
  imageId: optionalId,
  isActive: z.boolean().default(true),
  seo: seoInput.default({ noIndex: false }),
});
export type IndustryInput = z.infer<typeof industryInput>;

export const vendorInput = z.object({
  name: requiredText(120),
  slug,
  legalName: optionalText(160),
  description: optionalText(4000),
  website: optionalUrl,
  email: email.nullish().or(z.literal("").transform(() => null)),
  phone: optionalPhone,
  addressLine: optionalText(200),
  city: optionalText(80),
  state: optionalText(80),
  country: optionalText(80),
  foundedYear: z.coerce.number().int().min(1900).max(2100).nullish(),
  employeeRange: optionalText(40),
  logoId: optionalId,
  isActive: z.boolean().default(true),
  receivesLeads: z.boolean().default(true),
  /** Resellers: cities they serve. */
  serviceCities: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  /** Only used when creating: a software vendor or a reseller. */
  kind: z.enum(["VENDOR", "RESELLER"]).optional(),
  seo: seoInput.default({ noIndex: false }),
});
export type VendorInput = z.infer<typeof vendorInput>;

export const vendorVerification = z.object({
  id: z.string().cuid(),
  verification: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]),
  canPublish: z.boolean(),
});

export const brandInput = z.object({
  name: requiredText(120),
  slug,
  description: optionalText(1000),
  website: optionalUrl,
  /** Optional: the company that owns the brand. */
  vendorId: optionalId,
  logoId: optionalId,
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  seo: seoInput.default({ noIndex: false }),
});
export type BrandInput = z.infer<typeof brandInput>;

export const attributeInput = z
  .object({
    key: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, "Lowercase letters, digits and underscores"),
    label: requiredText(80),
    type: z.enum(["BOOLEAN", "SELECT", "MULTISELECT", "NUMBER", "TEXT"]),
    group: requiredText(60).default("General"),
    unit: optionalText(20),
    description: optionalText(300),
    isFilterable: z.boolean().default(false),
    isComparable: z.boolean().default(true),
    showOnDetail: z.boolean().default(true),
    options: z
      .array(z.object({ id: z.string().cuid().optional(), value: z.string().trim().regex(/^[a-z0-9-]{1,60}$/, "Use lowercase-hyphen values"), label: requiredText(80) }))
      .max(100)
      .default([]),
  })
  .refine((a) => !(a.type === "SELECT" || a.type === "MULTISELECT") || a.options.length > 0, {
    path: ["options"],
    message: "Select attributes need at least one option.",
  })
  .refine((a) => !a.isFilterable || a.type !== "TEXT", { path: ["isFilterable"], message: "Text attributes can't be used as filters." });
export type AttributeInput = z.infer<typeof attributeInput>;
