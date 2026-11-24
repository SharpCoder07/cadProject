import { z } from "zod";
import { layoutSchema } from "./free-layout";

/**
 * CMS block registry. Each block type has a Zod schema for its `data` JSON,
 * a label and description for the page builder, and defaults for new blocks.
 * Adding a new block type = add a schema here + a renderer in
 * src/components/blocks + an editor form in src/components/admin/blocks.
 */

const text = (max = 200) => z.string().trim().max(max).default("");
const hrefOrEmpty = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//i.test(v), "Use /path or https:// URL")
  .default("");
const cuidList = z.array(z.string().cuid()).max(48).default([]);
const limit = (def: number, max = 48) => z.number().int().min(1).max(max).default(def);

export const blockSchemas = {
  HERO: z.object({
    heading: text(120).default("Discover, compare and buy the right software for your business"),
    lead: text(60).default("Search software, categories or brands"),
    placeholder: text(80).default("accounting, payroll, CRM…"),
    subheading: text(240).default("Compare prices, features and verified reviews of 1,000+ business tools. Free advice from software experts."),
    quickLinks: z.array(z.object({ label: text(40), href: hrefOrEmpty })).max(10).default([]),
    backgroundImageUrl: hrefOrEmpty,
    showStats: z.boolean().default(true),
    showLogos: z.boolean().default(true),
    /** Brands for the logo strip, in display order; empty = brands with an uploaded logo. */
    logoBrandIds: cuidList,
  }),
  BANNER_CAROUSEL: z.object({
    placement: z.string().trim().min(1).max(60).default("home.hero"),
    autoAdvance: z.boolean().default(false),
  }),
  FEATURED_SOFTWARE: z.object({
    title: text(100).default("Popular software"),
    subtitle: text(240),
    source: z.enum(["featured", "popular", "trending", "recommended", "sponsored", "newest", "manual", "category"]).default("popular"),
    categoryId: z.string().cuid().nullable().default(null),
    softwareIds: cuidList,
    limit: limit(8, 24),
    layout: z.enum(["rows", "grid"]).default("grid"),
    viewAllHref: hrefOrEmpty,
  }),
  SOFTWARE_TABS: z.object({
    title: text(100).default("Top picks by category"),
    tabs: z.array(z.object({ label: text(40), categoryId: z.string().cuid() })).max(8).default([]),
    limit: limit(6, 12),
  }),
  CATEGORY_GRID: z.object({
    title: text(100).default("Browse by category"),
    subtitle: text(240),
    categoryIds: cuidList,
    limit: limit(12, 48),
    showCounts: z.boolean().default(true),
  }),
  INDUSTRY_GRID: z.object({
    title: text(100).default("Software by industry"),
    industryIds: cuidList,
    limit: limit(8, 24),
  }),
  RICH_TEXT: z.object({
    html: z.string().max(50_000).default(""),
    width: z.enum(["narrow", "wide"]).default("narrow"),
  }),
  CTA: z.object({
    heading: text(120).default("Not sure what to buy?"),
    body: text(400).default("Tell us what you need. A software advisor will shortlist options that fit your budget — free."),
    primaryLabel: text(40).default("Get free advice"),
    primaryHref: hrefOrEmpty,
    openLeadForm: z.boolean().default(true),
    secondaryLabel: text(40),
    secondaryHref: hrefOrEmpty,
    tone: z.enum(["primary", "accent", "plain"]).default("primary"),
  }),
  TESTIMONIALS: z.object({
    title: text(100).default("What buyers say"),
    limit: limit(6, 12),
  }),
  FAQ: z.object({
    title: text(100).default("Frequently asked questions"),
    groupKey: z.string().trim().max(60).default("general"),
  }),
  LOGO_CLOUD: z.object({
    title: text(100).default("Trusted software vendors"),
    vendorIds: cuidList,
    limit: limit(12, 24),
  }),
  OFFERS: z.object({
    title: text(100).default("Offers this month"),
    items: z
      .array(z.object({ title: text(80), description: text(200), badge: text(30), href: hrefOrEmpty }))
      .max(8)
      .default([]),
  }),
  BLOG_POSTS: z.object({
    eyebrow: text(60).default("Expert guidance"),
    title: text(100).default("Latest software insights"),
    linkLabel: text(40).default("Visit the blog"),
    limit: limit(3, 12),
    type: z.enum(["ANY", "ARTICLE", "GUIDE", "NEWS", "RESOURCE"]).default("ANY"),
  }),
  STATS: z.object({
    items: z.array(z.object({ value: text(20), label: text(60) })).max(6).default([]),
  }),
  COMPARISONS: z.object({
    title: text(100).default("Popular comparisons"),
    limit: limit(6, 12),
  }),
  LEAD_FORM: z.object({
    title: text(100).default("Get the right software, free"),
    subtitle: text(240),
  }),
  HOW_IT_WORKS: z.object({
    title: text(100).default("Buying software made simple"),
    steps: z
      .array(z.object({ title: text(60), text: text(200), icon: text(40) }))
      .max(6)
      .default([
        { title: "Explore", text: "Browse thousands of products by category, industry and use case.", icon: "search" },
        { title: "Compare", text: "Put plans, features and verified reviews side by side.", icon: "compare" },
        { title: "Get free advice", text: "Our advisors shortlist options that fit your budget.", icon: "support" },
        { title: "Buy with confidence", text: "Get the best price and exclusive offers from verified vendors.", icon: "verified" },
      ]),
  }),
  FLOW_DIAGRAM: z.object({
    title: text(100).default("All your software needs, one trusted platform"),
    subtitle: text(240).default("Tell us what your business runs on. We help you compare, choose and buy the right software."),
    leftLabel: text(40).default("Your business needs"),
    items: z
      .array(z.object({ label: text(40), icon: text(40), href: hrefOrEmpty }))
      .max(8)
      .default([
        { label: "Accounting & GST", icon: "calculator", href: "" },
        { label: "HR & Payroll", icon: "users", href: "" },
        { label: "CRM & Sales", icon: "chat", href: "" },
        { label: "ERP & Inventory", icon: "boxes", href: "" },
        { label: "Billing & POS", icon: "store", href: "" },
        { label: "CAD & Design", icon: "design", href: "" },
      ]),
    centerText: text(80).default("Compare, get free advice and buy at the best price"),
    rightLabel: text(40).default("What you get"),
    outcomeTitle: text(80).default("The right software, at the best price"),
    outcomeText: text(120).default("with verified reviews and free expert advice"),
  }),
  DEALS: z.object({
    title: text(100).default("Exclusive deals"),
    subtitle: text(200).default("Limited-period offers on top software from verified vendors."),
    limit: limit(8, 24),
  }),
  /** Free layout: rows → columns → widgets, built on the website in edit mode (lib/blocks/free-layout.ts). */
  LAYOUT: layoutSchema,
} as const;

export type BlockType = keyof typeof blockSchemas;
export type BlockData<T extends BlockType> = z.infer<(typeof blockSchemas)[T]>;
export const BLOCK_TYPES = Object.keys(blockSchemas) as BlockType[];

export const BLOCK_META: Record<BlockType, { label: string; description: string }> = {
  HERO: { label: "Top banner with search", description: "The big banner at the top: headline, search box, popular searches, live stats and the “Top software brands” logos." },
  BANNER_CAROUSEL: { label: "Banners", description: "Shows active banners from a placement." },
  FEATURED_SOFTWARE: { label: "Software list", description: "Featured, popular, trending, a category, or hand-picked." },
  SOFTWARE_TABS: { label: "Software by category tabs", description: "Tabs that each show top software in a category." },
  CATEGORY_GRID: { label: "Category grid", description: "Top-level or chosen categories." },
  INDUSTRY_GRID: { label: "Industry grid", description: "Links to industry landing pages." },
  RICH_TEXT: { label: "Text", description: "Formatted text, headings, lists, links." },
  CTA: { label: "Call to action", description: "Heading, text and buttons; can open the lead form." },
  TESTIMONIALS: { label: "Testimonials", description: "Active testimonials in display order." },
  FAQ: { label: "FAQ", description: "Questions from an FAQ group." },
  LOGO_CLOUD: { label: "Vendor logos", description: "Logos of verified or chosen vendors." },
  OFFERS: { label: "Offers", description: "Promotional cards with badges and links." },
  BLOG_POSTS: { label: "Latest insights (blog)", description: "Recent blog posts as cards: cover, date, title, summary and “Read article”." },
  STATS: { label: "Stats", description: "A row of figures with labels." },
  COMPARISONS: { label: "Comparisons", description: "Curated head-to-head comparisons." },
  LEAD_FORM: { label: "Lead form", description: "Inline enquiry form." },
  HOW_IT_WORKS: { label: "How it works", description: "Numbered steps such as Explore, Compare, Get advice, Buy." },
  FLOW_DIAGRAM: { label: "Connection diagram", description: "Your needs on the left flow through a centre card to one result on the right, joined by animated dashed lines." },
  DEALS: { label: "Live deals", description: "Published product offers that are live right now." },
  LAYOUT: { label: "Free layout", description: "Build your own design on the website: rows and columns with headings, text, images, buttons, lists, videos… dragged in from the Widgets panel (edit mode)." },
};

export const isBlockType = (t: string): t is BlockType => t in blockSchemas;

export function parseBlockData<T extends BlockType>(type: T, data: unknown): BlockData<T> | null {
  const result = blockSchemas[type].safeParse(data ?? {});
  return result.success ? (result.data as BlockData<T>) : null;
}

export const defaultBlockData = <T extends BlockType>(type: T): BlockData<T> => blockSchemas[type].parse({}) as BlockData<T>;
