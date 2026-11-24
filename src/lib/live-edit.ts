import { BLOCK_FIELDS, type BlockField } from "@/components/admin/blocks/block-fields";
import { isBlockType } from "@/lib/blocks/schemas";
import { SETTINGS_TABS } from "@/app/admin/settings/fields";
import { TEXT_DEFAULTS } from "@/lib/site-texts";
import { TEXT_ENTRIES, TEXT_GROUPS } from "@/lib/site-text-catalog";
import { BILLING_PERIODS, PRICING_MODELS } from "@/lib/validation/software";
import { FONTS } from "@/lib/font-choices";

/**
 * Website edit mode: which fields the side panel shows for each part of a page, edited in place
 * (no admin screen). Pure data, used by the panel and, for the allow-list of saved fields, by the server.
 */
import { matchesOnly, type LiveKind, type LiveTarget } from "./live-edit-target";
export { LIVE_KINDS, liveFromHref, type LiveKind, type LiveTarget } from "./live-edit-target";

const opt = (vals: readonly string[]) => vals.map((v) => ({ value: v, label: v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ") }));
const PRICE: BlockField[] = [
  { name: "pricingModel", label: "Pricing model", type: "select", options: opt(PRICING_MODELS) },
  { name: "startingPrice", label: "Starting price (₹)", type: "number", min: 0, hint: "Empty = “On request”." },
  { name: "priceUnit", label: "Price unit", type: "text", placeholder: "per user / month" },
  { name: "priceIncludesGst", label: "Price includes GST", type: "switch" },
  { name: "hasFreeTrial", label: "Free trial", type: "switch" },
  { name: "hasFreeVersion", label: "Free version", type: "switch" },
];

const FIELDS: Record<Exclude<LiveKind, "texts" | "block">, Record<string, { title: string; fields: BlockField[] }>> = {
  software: {
    hero: { title: "Product header", fields: [
      { name: "name", label: "Product name", type: "text" },
      { name: "tagline", label: "Tagline", type: "text" },
      { name: "shortDescription", label: "Short description", type: "textarea" },
      { name: "logoId", label: "Logo", type: "media" },
      { name: "websiteUrl", label: "Website", type: "url" },
      { name: "demoVideoUrl", label: "Demo video (YouTube/Vimeo)", type: "url" },
      ...PRICE,
      { name: "primaryCategoryId", label: "Main category", type: "picker", picker: "category" },
      { name: "categoryIds", label: "Other categories", type: "pickers", picker: "category" },
      { name: "industryIds", label: "Industries", type: "pickers", picker: "industry" },
      { name: "tags", label: "Tags", type: "stringList", placeholder: "One per line" },
      { name: "isFeatured", label: "Featured", type: "switch" },
      { name: "isPopular", label: "Popular", type: "switch" },
      { name: "isTrending", label: "Trending", type: "switch" },
      { name: "isRecommended", label: "Recommended", type: "switch" },
      { name: "isSponsored", label: "Sponsored", type: "switch" },
      { name: "sponsoredRank", label: "Sponsored position", type: "number", min: 1, max: 999 },
    ] },
    overview: { title: "Description", fields: [{ name: "description", label: "Description", type: "rich" }, { name: "shortDescription", label: "Short description", type: "textarea" }] },
    pricing: { title: "Pricing", fields: [
      ...PRICE,
      { name: "plans", label: "Plans", type: "list", addLabel: "Add plan", fields: [
        { name: "name", label: "Plan name", type: "text" },
        { name: "price", label: "Price (₹)", type: "number", min: 0 },
        { name: "billingPeriod", label: "Billing", type: "select", options: opt(BILLING_PERIODS) },
        { name: "priceUnit", label: "Unit", type: "text", placeholder: "per user" },
        { name: "description", label: "Description", type: "textarea" },
        { name: "features", label: "What's included", type: "stringList", placeholder: "One per line" },
        { name: "isPopular", label: "Most popular", type: "switch" },
        { name: "ctaLabel", label: "Button text", type: "text", placeholder: "Get quote" },
      ] },
    ] },
    gallery: { title: "Screenshots & media", fields: [{ name: "media", label: "Media", type: "list", addLabel: "Add item", fields: [
      { name: "kind", label: "Type", type: "select", options: [{ value: "SCREENSHOT", label: "Screenshot" }, { value: "VIDEO", label: "Video" }, { value: "DOCUMENT", label: "Document" }] },
      { name: "mediaId", label: "File (screenshot or document)", type: "media" },
      { name: "videoUrl", label: "Video link (for videos)", type: "url" },
      { name: "caption", label: "Caption", type: "text" },
    ] }] },
    features: { title: "Key features", fields: [{ name: "features", label: "Features", type: "list", addLabel: "Add feature", fields: [
      { name: "title", label: "Title", type: "text" }, { name: "description", label: "Description", type: "textarea" }, { name: "icon", label: "Icon name (optional)", type: "text" },
    ] }] },
    faqs: { title: "FAQs", fields: [{ name: "faqs", label: "Questions", type: "list", addLabel: "Add question", fields: [{ name: "question", label: "Question", type: "text" }, { name: "answer", label: "Answer", type: "textarea" }] }] },
    fit: { title: "Who should choose it", fields: [
      { name: "bestFor", label: "Best for", type: "textarea" }, { name: "notIdealFor", label: "Not ideal for", type: "textarea" },
      { name: "pros", label: "Pros", type: "stringList", placeholder: "One per line" }, { name: "cons", label: "Cons", type: "stringList", placeholder: "One per line" },
    ] },
    compare: { title: "Compare & alternatives", fields: [{ name: "alternativeIds", label: "Alternatives", type: "pickers", picker: "software" }, { name: "relatedIds", label: "Related products", type: "pickers", picker: "software" }] },
    alternatives: { title: "Alternatives", fields: [{ name: "alternativeIds", label: "Alternatives", type: "pickers", picker: "software" }] },
    vendor: { title: "Company", fields: [{ name: "vendorId", label: "Vendor", type: "picker", picker: "vendor" }, { name: "brandId", label: "Brand", type: "picker", picker: "brand" }] },
  },
  category: {
    hero: { title: "Category header", fields: [
      { name: "name", label: "Name", type: "text" }, { name: "shortName", label: "Short name", type: "text" },
      { name: "description", label: "Description", type: "textarea" }, { name: "imageId", label: "Image", type: "media" },
      { name: "icon", label: "Icon name", type: "text" }, { name: "parentId", label: "Parent category", type: "picker", picker: "category" },
      { name: "showInNav", label: "Show in the Categories menu", type: "switch" }, { name: "isActive", label: "Visible", type: "switch" },
    ] },
    popular: { title: "Popular choices", fields: [
      { name: "featuredSoftwareIds", label: "Featured products (in order)", type: "pickers", picker: "software" },
      { name: "layout", label: "Show", type: "group", fields: [{ name: "showFeatured", label: "Show editor's picks", type: "switch" }] },
    ] },
    guidance: { title: "Buying guide", fields: [{ name: "content", label: "Guide text", type: "rich" }, { name: "layout", label: "Show", type: "group", fields: [{ name: "showBuyingGuide", label: "Show buying guides (blog posts)", type: "switch" }] }] },
    faqs: { title: "FAQs", fields: [{ name: "layout", label: "Show", type: "group", fields: [{ name: "showFaq", label: "Show FAQs", type: "switch" }] }] },
    banner: { title: "Banner", fields: [{ name: "bannerId", label: "Banner image", type: "media" }, { name: "layout", label: "Placement", type: "group", fields: [{ name: "bannerPlacement", label: "Banner placement key", type: "text" }] }] },
    directory: { title: "Product list", fields: [{ name: "layout", label: "List", type: "group", fields: [
      { name: "view", label: "View", type: "select", options: [{ value: "rows", label: "Rows" }, { value: "grid", label: "Grid" }] },
      { name: "defaultSort", label: "Default sort", type: "select", options: [{ value: "popular", label: "Most popular" }, { value: "rating", label: "Highest rated" }, { value: "price_asc", label: "Price: low to high" }, { value: "name", label: "Name" }, { value: "newest", label: "Newest" }] },
      { name: "showSubcategories", label: "Show subcategories", type: "switch" },
    ] }] },
  },
  post: {
    article: { title: "Article", fields: [
      { name: "title", label: "Title", type: "text" }, { name: "excerpt", label: "Summary", type: "textarea" },
      { name: "coverId", label: "Cover image", type: "media" }, { name: "content", label: "Article text", type: "rich" },
      { name: "type", label: "Type", type: "select", options: [{ value: "ARTICLE", label: "Article" }, { value: "GUIDE", label: "Guide" }, { value: "NEWS", label: "News" }, { value: "RESOURCE", label: "Resource" }] },
      { name: "tags", label: "Tags", type: "stringList", placeholder: "One per line" },
      { name: "softwareIds", label: "Software mentioned", type: "pickers", picker: "software" },
      { name: "isFeatured", label: "Featured", type: "switch" },
    ] },
    tags: { title: "Tags", fields: [{ name: "tags", label: "Tags", type: "stringList", placeholder: "One per line" }] },
  },
  comparison: {
    content: { title: "Comparison content", fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "intro", label: "Introduction (below the table)", type: "rich" },
      { name: "sections", label: "Sections", type: "comparisonSections" },
      { name: "verdict", label: "Verdict", type: "rich" },
    ] },
  },
  vendor: {
    header: { title: "Vendor details", fields: [
      { name: "legalName", label: "Legal name", type: "text" }, { name: "email", label: "Email", type: "text" }, { name: "phone", label: "Phone", type: "phone" },
      { name: "name", label: "Name", type: "text" }, { name: "logoId", label: "Logo", type: "media" }, { name: "website", label: "Website", type: "url" },
      { name: "city", label: "City", type: "text" }, { name: "country", label: "Country", type: "text" },
      { name: "foundedYear", label: "Founded", type: "number", min: 1900, max: 2100 }, { name: "employeeRange", label: "Employees", type: "text", placeholder: "51-200" },
    ] },
    description: { title: "Description", fields: [{ name: "description", label: "Description", type: "textarea" }] },
  },
  site: {
    all: { title: "Company & contact", fields: SETTINGS_TABS.find((t) => t.key === "site")?.fields ?? [] },
    header: { title: "Header", fields: (SETTINGS_TABS.find((t) => t.key === "site")?.fields ?? []).filter((f) => ["name", "tagline", "logoUrl", "contactPhone"].includes(f.name)) },
    footer: { title: "Footer", fields: (SETTINGS_TABS.find((t) => t.key === "site")?.fields ?? []).filter((f) => ["logoDarkUrl", "legalName", "contactEmail", "salesEmail", "whatsappNumber", "address", "businessHours", "social"].includes(f.name)) },
  },
  brands: { all: { title: "Brands", fields: [{ name: "items", label: "Brands (top to bottom = display order)", type: "list", addLabel: "Add brand", hint: "Removing a brand moves it to the recycle bin.", fields: [
    { name: "name", label: "Name", type: "text" }, { name: "logoId", label: "Logo", type: "media" }, { name: "website", label: "Website", type: "url" },
    { name: "description", label: "About", type: "textarea" }, { name: "vendorId", label: "Owned by vendor", type: "picker", picker: "vendor" }, { name: "isActive", label: "Visible", type: "switch" },
  ] }] } },
  industries: { all: { title: "Industries", fields: [{ name: "items", label: "Industries", type: "list", addLabel: "Add industry", hint: "Removing an industry moves it to the recycle bin.", fields: [
    { name: "name", label: "Name", type: "text" }, { name: "description", label: "Description", type: "textarea" }, { name: "imageId", label: "Image", type: "media" },
    { name: "icon", label: "Icon name", type: "text" }, { name: "content", label: "Page content", type: "rich" }, { name: "isActive", label: "Visible", type: "switch" },
  ] }] } },
  vendors: { all: { title: "Vendors", fields: [{ name: "items", label: "Vendors", type: "list", addLabel: "Add vendor", hint: "Removing a vendor moves it to the recycle bin.", fields: [
    { name: "name", label: "Name", type: "text" }, { name: "logoId", label: "Logo", type: "media" }, { name: "website", label: "Website", type: "url" },
    { name: "city", label: "City", type: "text" }, { name: "country", label: "Country", type: "text" }, { name: "description", label: "Description", type: "textarea" }, { name: "isActive", label: "Visible", type: "switch" },
  ] }] } },
  labels: { all: { title: "Buttons, labels & messages", fields: SETTINGS_TABS.find((t) => t.key === "labels")?.fields ?? [] } },
  theme: { all: { title: "Colours, fonts & footer note", fields: SETTINGS_TABS.find((t) => t.key === "theme")?.fields ?? [] } },
  style: { all: { title: "Design", fields: [
    { name: "background", label: "Background colour", type: "color", hint: "Behind this whole box / section. Leave empty to use the website's colours (applies to every field here)." },
    { name: "surface", label: "Card / box colour", type: "color", hint: "White cards and boxes inside it." },
    { name: "text", label: "Text colour", type: "color", hint: "Headings and text; lighter text and lines follow it." },
    { name: "primary", label: "Brand colour", type: "color", hint: "Links, icons, highlights and main buttons inside it." },
    { name: "accent", label: "Button colour", type: "color", hint: "Enquiry buttons like “Get free quote” and badges inside it." },
    { name: "border", label: "Border colour", type: "color" },
    { name: "displayFont", label: "Heading font", type: "select", options: [{ value: "", label: "Website default" }, ...FONTS.map((f) => ({ value: f.key, label: f.label }))] },
    { name: "bodyFont", label: "Text font", type: "select", options: [{ value: "", label: "Website default" }, ...FONTS.map((f) => ({ value: f.key, label: f.label }))] },
  ] } },
};

/** Website texts of one group as panel fields. */
const textField = (key: string, label: string): BlockField => ((TEXT_DEFAULTS[key] ?? "").length > 90 ? { name: key, label, type: "textarea" } : { name: key, label, type: "text" });
function textFields(group: string): BlockField[] {
  return TEXT_ENTRIES.filter((e) => e.group === group).map((e) => textField(e.key, e.label));
}

export function liveSection(t: LiveTarget): { title: string; fields: BlockField[] } | null {
  if (t.kind === "texts" && t.id === "*") {
    // Every website text (filtered to what's shown in this part of the page).
    return { title: t.title ?? "Wording", fields: TEXT_ENTRIES.map((e) => textField(e.key, e.label)).filter((f) => matchesOnly(f.name, t.only)) };
  }
  if (t.kind === "texts") {
    const g = TEXT_GROUPS.find((x) => x.key === t.id);
    return g ? { title: `Wording: ${g.label}`, fields: textFields(t.id).filter((f) => matchesOnly(f.name, t.only)) } : null;
  }
  if (t.kind === "block") return isBlockType(t.section) ? { title: t.title ?? "Section", fields: BLOCK_FIELDS[t.section].filter((f) => matchesOnly(f.name, t.only)) } : null;
  const def = FIELDS[t.kind][t.section];
  return def ? { ...def, fields: def.fields.filter((f) => matchesOnly(f.name, t.only)) } : null;
}

export const hasLive = (kind: LiveKind, section: string) => kind === "texts" || (kind === "block" ? isBlockType(section) : Boolean(FIELDS[kind as Exclude<LiveKind, "texts" | "block">]?.[section]));

/** Every field the panel can save for this kind (the server only accepts these). */
export function liveFieldNames(kind: LiveKind, id: string): Set<string> {
  if (kind === "texts") return new Set(TEXT_ENTRIES.filter((e) => id === "*" || e.group === id).map((e) => e.key));
  if (kind === "block") return new Set(); // checked against the section's own block type when saving
  return new Set(Object.values(FIELDS[kind]).flatMap((s) => s.fields.map((f) => f.name)));
}

/**
 * Fields of this kind whose current value is shown in the part of the page being edited (`seen`:
 * its texts, labels and links). Website texts with {placeholders} match whatever fills them in.
 */
export function discoverFields(t: LiveTarget, values: Record<string, unknown>, seen: string[]): string[] {
  const def = liveSection({ ...t, only: undefined });
  if (!def) return [];
  const norm = (x: string) => x.replace(/\s+/g, " ").trim();
  const texts = new Set(seen.map(norm).filter(Boolean));
  const list = [...texts];
  const out: string[] = [];
  for (const f of def.fields) {
    if (f.type !== "text" && f.type !== "textarea" && f.type !== "url" && f.type !== "phone") continue;
    const raw = values[f.name];
    if (typeof raw !== "string") continue;
    const v = norm(raw);
    if (v.length < 2) continue;
    if (texts.has(v)) { out.push(f.name); continue; }
    if (!/\{\w+\}/.test(v)) continue;
    const parts = v.split(/\{\w+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    if (parts.join("").trim().length < 3) continue;
    const re = new RegExp(`^${parts.join(".+?")}$`);
    if (list.some((x) => re.test(x))) out.push(f.name);
  }
  return out;
}
