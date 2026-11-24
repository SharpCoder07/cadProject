/** Field-by-field comparison of an approval request's live data and the vendor's proposal. Pure. */

export type Lookups = Record<string, string>;

export interface DiffRow {
  key: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

const LABELS: Record<string, string> = {
  name: "Name",
  slug: "URL slug",
  tagline: "Tagline",
  shortDescription: "Short description",
  description: "Description",
  brandId: "Brand",
  logoId: "Logo",
  websiteUrl: "Website",
  demoVideoUrl: "Demo video",
  pricingModel: "Pricing model",
  startingPrice: "Starting price",
  currency: "Currency",
  priceUnit: "Price unit",
  priceIncludesGst: "Price includes GST",
  hasFreeTrial: "Free trial",
  hasFreeVersion: "Free version",
  deployment: "Deployment",
  primaryCategoryId: "Primary category",
  categoryIds: "Other categories",
  industryIds: "Industries",
  termIds: "Classifications",
  tags: "Tags",
  features: "Features",
  plans: "Pricing plans",
  faqs: "FAQs",
  media: "Screenshots & media",
  attributes: "Specifications",
  relatedIds: "Related products",
  alternativeIds: "Alternatives",
  legalName: "Legal name",
  website: "Website",
  email: "Email",
  phone: "Phone",
  addressLine: "Address",
  city: "City",
  state: "State",
  country: "Country",
  foundedYear: "Founded",
  employeeRange: "Company size",
  reply: "Public reply",
  softwareId: "Product",
  title: "Offer title",
  discount: "Discount",
  couponCode: "Coupon code",
  terms: "Terms",
  url: "Offer link",
  startsAt: "Starts",
  endsAt: "Ends",
};

/** Fields never shown in the diff: admin-controlled or bookkeeping. */
const HIDDEN = new Set(["vendorId", "pros", "cons", "bestFor", "notIdealFor", "isFeatured", "isPopular", "isTrending", "isRecommended", "isSponsored", "sponsoredRank", "seo", "revisionMessage", "isActive", "receivesLeads"]);

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const clip = (s: string, n = 600) => (s.length > n ? `${s.slice(0, n)}…` : s);

function format(key: string, v: unknown, names: Lookups): string {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (key === "description") return clip(stripHtml(String(v)));
  if (key === "logoId") return "Image set";
  if (["brandId", "primaryCategoryId", "softwareId"].includes(key)) return names[String(v)] ?? "Unknown";
  if ((key === "startsAt" || key === "endsAt") && typeof v === "string" && !Number.isNaN(Date.parse(v))) {
    return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(v));
  }
  if (["categoryIds", "industryIds", "termIds", "relatedIds", "alternativeIds"].includes(key) && Array.isArray(v)) return v.map((id) => names[String(id)] ?? "Unknown").join(", ");
  if (Array.isArray(v)) {
    if (key === "features") return v.map((f: { title?: string }) => f.title ?? "").filter(Boolean).join(" · ");
    if (key === "plans") return v.map((p: { name?: string; price?: number | null; currency?: string }) => `${p.name ?? "Plan"}${p.price != null ? ` (${p.currency ?? "INR"} ${p.price})` : ""}`).join(" · ");
    if (key === "faqs") return v.map((f: { question?: string }) => f.question ?? "").filter(Boolean).join(" · ");
    if (key === "media") return `${v.length} item${v.length === 1 ? "" : "s"}`;
    if (key === "attributes") return `${v.length} value${v.length === 1 ? "" : "s"}`;
    return v.map(String).join(", ");
  }
  if (typeof v === "object") return clip(JSON.stringify(v));
  return clip(String(v));
}

const normalise = (v: unknown) => JSON.stringify(v ?? null) === "\"\"" ? "null" : JSON.stringify(v ?? null);

export function diffObjects(before: Record<string, unknown> | null, after: Record<string, unknown> | null, names: Lookups = {}): DiffRow[] {
  const keys = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])).filter((k) => !HIDDEN.has(k));
  const order = Object.keys(LABELS);
  keys.sort((a, b) => (order.indexOf(a) === -1 ? 999 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 999 : order.indexOf(b)));
  return keys.map((key) => {
    const b = before?.[key];
    const a = after?.[key];
    return { key, label: LABELS[key] ?? key, before: format(key, b, names), after: format(key, a, names), changed: normalise(a) !== normalise(b) };
  });
}

/** Every id referenced by a software/vendor payload, so the page can resolve names in one query per table. */
export function referencedIds(...objs: (Record<string, unknown> | null)[]) {
  const ids = { categories: new Set<string>(), industries: new Set<string>(), software: new Set<string>(), brands: new Set<string>(), terms: new Set<string>() };
  for (const o of objs) {
    if (!o) continue;
    for (const id of [o.primaryCategoryId, ...((o.categoryIds as unknown[]) ?? [])]) if (typeof id === "string") ids.categories.add(id);
    for (const id of (o.industryIds as unknown[]) ?? []) if (typeof id === "string") ids.industries.add(id);
    for (const id of (o.termIds as unknown[]) ?? []) if (typeof id === "string") ids.terms.add(id);
    for (const id of [...((o.relatedIds as unknown[]) ?? []), ...((o.alternativeIds as unknown[]) ?? [])]) if (typeof id === "string") ids.software.add(id);
    if (typeof o.brandId === "string") ids.brands.add(o.brandId);
    if (typeof o.softwareId === "string") ids.software.add(o.softwareId);
  }
  return { categories: [...ids.categories], industries: [...ids.industries], software: [...ids.software], brands: [...ids.brands], terms: [...ids.terms] };
}
