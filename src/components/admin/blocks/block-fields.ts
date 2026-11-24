import type { BlockType } from "@/lib/blocks/schemas";
import type { PickerType } from "../relation-picker";

/** Declarative editor fields per block type. Rendered by <BlockForm>. */
export type BlockField =
  | { name: string; label: string; type: "text" | "textarea" | "url"; hint?: string; placeholder?: string }
  | { name: string; label: string; type: "phone"; hint?: string }
  | { name: string; label: string; type: "number"; min?: number; max?: number; hint?: string }
  | { name: string; label: string; type: "switch"; hint?: string }
  | { name: string; label: string; type: "select"; options: { value: string; label: string }[]; hint?: string }
  | { name: string; label: string; type: "rich"; hint?: string }
  | { name: string; label: string; type: "picker"; picker: PickerType; hint?: string }
  | { name: string; label: string; type: "pickers"; picker: PickerType; hint?: string }
  | { name: string; label: string; type: "image"; hint?: string }
  | { name: string; label: string; type: "list"; fields: BlockField[]; addLabel: string; hint?: string }
  | { name: string; label: string; type: "group"; fields: BlockField[]; hint?: string }
  | { name: string; label: string; type: "color"; hint?: string }
  | { name: string; label: string; type: "stringList"; hint?: string; placeholder?: string }
  /** A file from the media library, stored by id (previews come from MediaPreviews). */
  | { name: string; label: string; type: "media"; hint?: string }
  /** A comparison's content sections (Admin › Comparisons). */
  | { name: string; label: string; type: "comparisonSections"; hint?: string };

const SOURCES = [
  { value: "popular", label: "Most popular" },
  { value: "featured", label: "Featured" },
  { value: "trending", label: "Trending" },
  { value: "recommended", label: "Recommended" },
  { value: "sponsored", label: "Sponsored" },
  { value: "newest", label: "Newest" },
  { value: "category", label: "Top in a category" },
  { value: "manual", label: "Hand-picked" },
];

export const BLOCK_FIELDS: Record<BlockType, BlockField[]> = {
  HERO: [
    { name: "heading", label: "Heading", type: "text", hint: "The big headline. Leave empty to show \"Discover, compare and buy the right software for your business\"." },
    { name: "lead", label: "Search box label (hidden)", type: "text", hint: "Not shown on the page: screen readers read it out for the search box." },
    { name: "placeholder", label: "Search placeholder", type: "text" },
    { name: "subheading", label: "Supporting text", type: "textarea" },
    { name: "quickLinks", label: "Popular searches", type: "list", addLabel: "Add link", fields: [{ name: "label", label: "Label", type: "text" }, { name: "href", label: "Link", type: "url", placeholder: "/categories/crm" }] },
    { name: "backgroundImageUrl", label: "Background image", type: "image", hint: "Faint image behind the hero (optional)." },
    { name: "showStats", label: "Show live stats", type: "switch", hint: "Products, categories, vendors and reviews counted from the catalogue." },
    { name: "showLogos", label: "Show “Top software brands” logos", type: "switch" },
    { name: "logoBrandIds", label: "Brands in the logo strip", type: "pickers", picker: "brand", hint: "Pick the brands to show, in order. Only brands with an uploaded logo appear (Products → Brands). Leave empty to show brands with a logo, in their display order." },
  ],
  // Built on the website in edit mode (drag widgets into rows and columns); nothing to fill in here.
  LAYOUT: [],
  BANNER_CAROUSEL: [
    { name: "placement", label: "Banner placement", type: "text", hint: "Shows active banners with this placement key (Content → Banners)." },
  ],
  FEATURED_SOFTWARE: [
    { name: "title", label: "Heading", type: "text" },
    { name: "subtitle", label: "Supporting text", type: "text" },
    { name: "source", label: "Products", type: "select", options: SOURCES },
    { name: "categoryId", label: "Category", type: "picker", picker: "category", hint: "Used when products = “Top in a category”." },
    { name: "softwareIds", label: "Hand-picked products", type: "pickers", picker: "software", hint: "Used when products = “Hand-picked”. Drag order = display order." },
    { name: "limit", label: "How many", type: "number", min: 1, max: 24 },
    { name: "layout", label: "Layout", type: "select", options: [{ value: "grid", label: "Cards" }, { value: "rows", label: "Comparable rows" }] },
    { name: "viewAllHref", label: "“View all” link", type: "url" },
  ],
  SOFTWARE_TABS: [
    { name: "title", label: "Heading", type: "text" },
    { name: "tabs", label: "Tabs", type: "list", addLabel: "Add tab", fields: [{ name: "label", label: "Tab label", type: "text" }, { name: "categoryId", label: "Category", type: "picker", picker: "category" }] },
    { name: "limit", label: "Products per tab", type: "number", min: 1, max: 12 },
  ],
  CATEGORY_GRID: [
    { name: "title", label: "Heading", type: "text" },
    { name: "subtitle", label: "Supporting text", type: "text" },
    { name: "categoryIds", label: "Categories", type: "pickers", picker: "category", hint: "Leave empty to show all top-level categories." },
    { name: "limit", label: "Maximum shown", type: "number", min: 1, max: 48 },
    { name: "showCounts", label: "Show product counts", type: "switch" },
  ],
  INDUSTRY_GRID: [
    { name: "title", label: "Heading", type: "text" },
    { name: "industryIds", label: "Industries", type: "pickers", picker: "industry", hint: "Leave empty to show all." },
    { name: "limit", label: "Maximum shown", type: "number", min: 1, max: 24 },
  ],
  RICH_TEXT: [
    { name: "html", label: "Content", type: "rich" },
    { name: "width", label: "Width", type: "select", options: [{ value: "narrow", label: "Readable column" }, { value: "wide", label: "Full width" }] },
  ],
  CTA: [
    { name: "heading", label: "Heading", type: "text" },
    { name: "body", label: "Text", type: "textarea" },
    { name: "primaryLabel", label: "Button label", type: "text" },
    { name: "openLeadForm", label: "Button opens the enquiry form", type: "switch" },
    { name: "primaryHref", label: "Button link", type: "url", hint: "Used when the button doesn’t open the enquiry form." },
    { name: "secondaryLabel", label: "Second button label", type: "text" },
    { name: "secondaryHref", label: "Second button link", type: "url" },
    { name: "tone", label: "Colour", type: "select", options: [{ value: "primary", label: "Brand" }, { value: "accent", label: "Accent" }, { value: "plain", label: "Plain" }] },
  ],
  TESTIMONIALS: [
    { name: "title", label: "Heading", type: "text" },
    { name: "limit", label: "How many", type: "number", min: 1, max: 12 },
  ],
  FAQ: [
    { name: "title", label: "Heading", type: "text" },
    { name: "groupKey", label: "FAQ group key", type: "text", hint: "From Content → FAQs, e.g. general." },
  ],
  LOGO_CLOUD: [
    { name: "title", label: "Heading", type: "text" },
    { name: "vendorIds", label: "Vendors", type: "pickers", picker: "vendor", hint: "Leave empty to show verified vendors with logos." },
    { name: "limit", label: "Maximum shown", type: "number", min: 1, max: 24 },
  ],
  OFFERS: [
    { name: "title", label: "Heading", type: "text" },
    { name: "items", label: "Offers", type: "list", addLabel: "Add offer", fields: [
      { name: "badge", label: "Badge", type: "text", placeholder: "20% off" },
      { name: "title", label: "Title", type: "text" },
      { name: "description", label: "Description", type: "text" },
      { name: "href", label: "Link", type: "url" },
    ] },
  ],
  BLOG_POSTS: [
    { name: "eyebrow", label: "Small label above the heading", type: "text", placeholder: "Expert guidance" },
    { name: "title", label: "Heading", type: "text" },
    { name: "linkLabel", label: "Link to the blog", type: "text", placeholder: "Visit the blog" },
    { name: "type", label: "Post type", type: "select", options: [{ value: "ANY", label: "Any" }, { value: "GUIDE", label: "Guides" }, { value: "ARTICLE", label: "Articles" }, { value: "NEWS", label: "News" }, { value: "RESOURCE", label: "Resources" }] },
    { name: "limit", label: "How many", type: "number", min: 1, max: 12 },
  ],
  STATS: [
    { name: "items", label: "Figures", type: "list", addLabel: "Add figure", fields: [{ name: "value", label: "Value", type: "text", placeholder: "1,200+" }, { name: "label", label: "Label", type: "text", placeholder: "Products listed" }] },
  ],
  COMPARISONS: [
    { name: "title", label: "Heading", type: "text" },
    { name: "limit", label: "How many", type: "number", min: 1, max: 12 },
  ],
  LEAD_FORM: [
    { name: "title", label: "Heading", type: "text" },
    { name: "subtitle", label: "Supporting text", type: "text", hint: "Defaults to the lead form subtitle in Settings → Labels." },
  ],
  HOW_IT_WORKS: [
    { name: "title", label: "Heading", type: "text" },
    { name: "steps", label: "Steps", type: "list", addLabel: "Add step", fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "text", label: "Text", type: "text" },
      { name: "icon", label: "Icon", type: "text", hint: "Icon key, e.g. search, compare, support, verified, offer." },
    ] },
  ],
  FLOW_DIAGRAM: [
    { name: "title", label: "Heading", type: "text" },
    { name: "subtitle", label: "Supporting text", type: "text" },
    { name: "leftLabel", label: "Label above the left cards", type: "text" },
    { name: "items", label: "Left cards", type: "list", addLabel: "Add card", fields: [
      { name: "label", label: "Text", type: "text" },
      { name: "icon", label: "Icon", type: "text", hint: "Icon key, e.g. calculator, users, chat, boxes, store, design, health, cloud, security." },
      { name: "href", label: "Link (optional)", type: "url", placeholder: "/categories/crm" },
    ] },
    { name: "centerText", label: "Centre card text", type: "text", hint: "Shown under your logo and site name." },
    { name: "rightLabel", label: "Label above the right card", type: "text" },
    { name: "outcomeTitle", label: "Right card heading", type: "text" },
    { name: "outcomeText", label: "Right card text", type: "text" },
  ],
  DEALS: [
    { name: "title", label: "Heading", type: "text" },
    { name: "subtitle", label: "Supporting text", type: "text" },
    { name: "limit", label: "How many", type: "number", min: 1, max: 24 },
  ],
};
