import { z } from "zod";
import { BLOCK_TYPES } from "@/lib/blocks/schemas";
import { href, optionalId, optionalText, requiredText, seoInput, slug } from "./common";

export const pageInput = z.object({
  title: requiredText(120),
  slug: slug.refine((s) => !RESERVED_SLUGS.has(s), "This URL is reserved by the site"),
  template: z.enum(["DEFAULT", "LANDING", "LEGAL", "CONTACT", "HOMEPAGE"]).default("DEFAULT"),
  seo: seoInput.default({ noIndex: false }),
  revisionMessage: optionalText(200),
});
export type PageInput = z.infer<typeof pageInput>;

/** Top-level routes that a CMS page slug must not shadow. */
export const RESERVED_SLUGS = new Set([
  "admin", "vendor", "api", "login", "logout", "software", "categories", "category", "vendors", "industries", "compare",
  "search", "blog", "sitemap.xml", "robots.txt", "uploads", "reset-password", "invite", "_next", "preview",
]);

export const sectionInput = z.object({
  id: z.string().cuid().optional(),
  type: z.enum(BLOCK_TYPES as [string, ...string[]]),
  label: optionalText(80),
  isEnabled: z.boolean().default(true),
  data: z.unknown(),
  reusableBlockId: optionalId,
});
export type SectionInput = z.infer<typeof sectionInput>;

export const sectionsInput = z.object({
  pageId: z.string().cuid(),
  sections: z.array(sectionInput).max(60),
  revisionMessage: optionalText(200),
});

export const reusableBlockInput = z.object({
  name: requiredText(80),
  type: z.enum(BLOCK_TYPES as [string, ...string[]]),
  data: z.unknown(),
});

export const publishInput = z.object({
  id: z.string().cuid(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  scheduledAt: z.coerce.date().nullish(),
});

const menuItemBase = z.object({
  id: z.string().optional(),
  label: requiredText(60),
  url: z.string().trim().max(500).nullish(),
  pageId: optionalId,
  categoryId: optionalId,
  badge: optionalText(20),
  openInNewTab: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type MenuItemInput = z.infer<typeof menuItemBase> & { children: MenuItemInput[] };
export const menuItemInput: z.ZodType<MenuItemInput, z.ZodTypeDef, unknown> = menuItemBase
  .extend({ children: z.lazy(() => z.array(menuItemInput).max(40)).default([]) })
  .refine((m) => Boolean(m.url || m.pageId || m.categoryId) || (m.children?.length ?? 0) > 0, { message: "Add a link, page or category" })
  .refine((m) => !m.url || href.safeParse(m.url).success, { path: ["url"], message: "Use a path like /about or a full https:// URL" });

export const menuInput = z.object({
  key: z.string().regex(/^[a-z0-9.-]{2,40}$/),
  name: requiredText(60),
  items: z.array(menuItemInput).max(60),
});

/** datetime-local values carry no zone; admin times are entered in IST. */
export const istDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? `${v}:00+05:30` : v);
const optionalDate = z.preprocess((v) => (v === "" || v === undefined ? null : istDate(v)), z.coerce.date().nullable());

export const bannerInput = z
  .object({
    title: requiredText(120),
    subtitle: optionalText(240),
    placement: z.string().trim().regex(/^[a-z0-9.-]{2,60}$/, "Use lowercase like home.hero"),
    imageId: optionalId,
    mobileImageId: optionalId,
    ctaLabel: optionalText(40),
    ctaUrl: href.nullish().or(z.literal("").transform(() => null)),
    theme: z.enum(["light", "dark", "brand"]).default("brand"),
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean().default(true),
  })
  .refine((b) => !b.startsAt || !b.endsAt || b.endsAt > b.startsAt, { path: ["endsAt"], message: "End must be after start" });
export type BannerInput = z.infer<typeof bannerInput>;

export const announcementInput = z
  .object({
    message: requiredText(200),
    linkLabel: optionalText(40),
    linkUrl: href.nullish().or(z.literal("").transform(() => null)),
    variant: z.enum(["info", "promo", "warning"]).default("info"),
    startsAt: optionalDate,
    endsAt: optionalDate,
    isActive: z.boolean().default(true),
  })
  .refine((b) => !b.startsAt || !b.endsAt || b.endsAt > b.startsAt, { path: ["endsAt"], message: "End must be after start" });
export type AnnouncementInput = z.infer<typeof announcementInput>;

export const testimonialInput = z.object({
  name: requiredText(80),
  role: optionalText(80),
  company: optionalText(80),
  quote: requiredText(600),
  rating: z.coerce.number().int().min(1).max(5).nullish(),
  avatarId: optionalId,
  isActive: z.boolean().default(true),
});

export const faqGroupInput = z.object({
  key: z.string().regex(/^[a-z0-9-]{2,40}$/),
  title: requiredText(80),
  items: z
    .array(z.object({ id: z.string().optional(), question: requiredText(300), answer: requiredText(3000), isActive: z.boolean().default(true) }))
    .max(80),
});

export const redirectInput = z
  .object({
    fromPath: z.string().trim().regex(/^\/[^\s?#]*$/, "Start with / and leave out query strings").max(500),
    toPath: href,
    statusCode: z.coerce.number().refine((c) => c === 301 || c === 302 || c === 307 || c === 308),
    isActive: z.boolean().default(true),
    note: optionalText(200),
  })
  .refine((r) => r.fromPath !== r.toPath, { path: ["toPath"], message: "A redirect can't point to itself" })
  .refine((r) => !r.fromPath.startsWith("/admin") && !r.fromPath.startsWith("/api") && !r.fromPath.startsWith("/_next"), {
    path: ["fromPath"],
    message: "Admin, API and asset paths can't be redirected",
  });
export type RedirectInput = z.infer<typeof redirectInput>;

export const postInput = z.object({
  title: requiredText(160),
  slug,
  type: z.enum(["ARTICLE", "GUIDE", "NEWS", "RESOURCE"]).default("ARTICLE"),
  excerpt: optionalText(300),
  content: z.string().max(200_000).default(""),
  coverId: optionalId,
  authorId: optionalId,
  categoryId: optionalId,
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  softwareIds: z.array(z.string().cuid()).max(20).default([]),
  isFeatured: z.boolean().default(false),
  seo: seoInput.default({ noIndex: false }),
  revisionMessage: optionalText(200),
});
export type PostInput = z.infer<typeof postInput>;

export const authorInput = z.object({
  name: requiredText(80),
  slug,
  bio: optionalText(1000),
  jobTitle: optionalText(80),
  avatarId: optionalId,
  userId: optionalId,
});

export const blogCategoryInput = z.object({ name: requiredText(60), slug, description: optionalText(300) });
