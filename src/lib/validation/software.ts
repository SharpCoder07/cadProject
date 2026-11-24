import { z } from "zod";
import { money, optionalId, optionalText, optionalUrl, requiredText, seoInput, slug, urlQuery } from "./common";

export const PRICING_MODELS = ["FREE", "FREEMIUM", "SUBSCRIPTION", "ONE_TIME", "USAGE_BASED", "QUOTE_BASED"] as const;
export const DEPLOYMENTS = ["CLOUD", "ON_PREMISE", "HYBRID", "MOBILE", "DESKTOP"] as const;
export const BILLING_PERIODS = ["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME", "CUSTOM"] as const;
export const SOFTWARE_FLAGS = ["isFeatured", "isPopular", "isTrending", "isRecommended", "isSponsored"] as const;
export type SoftwareFlag = (typeof SOFTWARE_FLAGS)[number];

export const featureInput = z.object({
  title: requiredText(120),
  description: optionalText(500),
  icon: optionalText(40),
});

export const planInput = z.object({
  name: requiredText(80),
  price: money,
  currency: z.string().length(3).default("INR"),
  billingPeriod: z.enum(BILLING_PERIODS).default("MONTHLY"),
  priceUnit: optionalText(60),
  description: optionalText(300),
  features: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
  isPopular: z.boolean().default(false),
  ctaLabel: optionalText(40),
});

export const faqInput = z.object({
  question: requiredText(300),
  answer: requiredText(3000),
});

export const mediaInput = z.object({
  kind: z.enum(["SCREENSHOT", "VIDEO", "DOCUMENT"]).default("SCREENSHOT"),
  mediaId: optionalId,
  videoUrl: optionalUrl,
  caption: optionalText(200),
}).refine((m) => (m.kind === "VIDEO" ? Boolean(m.videoUrl) : Boolean(m.mediaId)), {
  message: "Screenshots and documents need a file; videos need a URL.",
});

export const attributeValueInput = z.object({
  attributeId: z.string().cuid(),
  optionIds: z.array(z.string().cuid()).default([]),
  valueText: optionalText(300),
  valueNumber: z.coerce.number().nullish(),
  valueBool: z.boolean().nullish(),
});

export const softwareInput = z
  .object({
    name: requiredText(120),
    slug,
    tagline: optionalText(160),
    shortDescription: optionalText(400),
    description: z.string().max(100_000).nullish(),
    vendorId: optionalId,
    brandId: optionalId,
    logoId: optionalId,
    websiteUrl: optionalUrl,
    demoVideoUrl: optionalUrl,

    pricingModel: z.enum(PRICING_MODELS),
    startingPrice: money,
    currency: z.string().length(3).default("INR"),
    priceUnit: optionalText(60),
    priceIncludesGst: z.boolean().default(false),
    hasFreeTrial: z.boolean().default(false),
    hasFreeVersion: z.boolean().default(false),
    deployment: z.array(z.enum(DEPLOYMENTS)).default([]),

    /** Editorial assessment on the product page (staff only). */
    pros: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
    cons: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
    bestFor: optionalText(400),
    notIdealFor: optionalText(400),

    isFeatured: z.boolean().default(false),
    isPopular: z.boolean().default(false),
    isTrending: z.boolean().default(false),
    isRecommended: z.boolean().default(false),
    isSponsored: z.boolean().default(false),
    sponsoredRank: z.coerce.number().int().min(1).max(999).nullish(),
    /** Product ID on the previous website (staff only), for redirecting old comparison links. */
    legacyId: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(1, "Enter a whole number").max(2_000_000_000).nullable()).optional(),

    primaryCategoryId: optionalId,
    categoryIds: z.array(z.string().cuid()).max(20).default([]),
    industryIds: z.array(z.string().cuid()).max(30).default([]),
    /** Professions, use cases, features, platforms, … (see src/lib/taxonomies.ts). */
    termIds: z.array(z.string().cuid()).max(200).default([]),
    tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),

    features: z.array(featureInput).max(60).default([]),
    plans: z.array(planInput).max(12).default([]),
    faqs: z.array(faqInput).max(40).default([]),
    media: z.array(mediaInput).max(30).default([]),
    attributes: z.array(attributeValueInput).max(200).default([]),
    relatedIds: z.array(z.string().cuid()).max(20).default([]),
    alternativeIds: z.array(z.string().cuid()).max(20).default([]),

    seo: seoInput.default({ noIndex: false }),
    revisionMessage: optionalText(200),
  })
  .superRefine((s, ctx) => {
    if (s.pricingModel === "FREE" && s.startingPrice && s.startingPrice > 0) {
      ctx.addIssue({ code: "custom", path: ["startingPrice"], message: "Free products can't have a starting price." });
    }
    if (s.plans.filter((p) => p.isPopular).length > 1) {
      ctx.addIssue({ code: "custom", path: ["plans"], message: "Mark at most one plan as most popular." });
    }
  })
  // The primary category is always also one of the assigned categories.
  .transform((s) => ({
    ...s,
    categoryIds: s.primaryCategoryId && !s.categoryIds.includes(s.primaryCategoryId) ? [s.primaryCategoryId, ...s.categoryIds] : s.categoryIds,
  }));

export type SoftwareInput = z.infer<typeof softwareInput>;
export type SoftwareFormValues = z.input<typeof softwareInput>;

export const statusTransition = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"]),
  scheduledAt: z.coerce.date().nullish(),
});

export const bulkFlag = z.object({
  ids: z.array(z.string().cuid()).min(1).max(200),
  flag: z.enum(SOFTWARE_FLAGS),
  value: z.boolean(),
});

export const softwareListQuery = urlQuery({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED", "ALL"]).catch("ALL"),
  categoryId: z.string().cuid().optional().catch(undefined),
  vendorId: z.string().cuid().optional().catch(undefined),
  flag: z.enum(SOFTWARE_FLAGS).optional().catch(undefined),
  sort: z.enum(["updated", "name", "popular", "created"]).catch("updated"),
  page: z.coerce.number().int().min(1).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});
