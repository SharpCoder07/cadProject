/**
 * The product classifications ("taxonomies") and how each one appears in the admin and on the site.
 * Pure data: safe to import from client components, the seed script and tests.
 */

export type TaxonomyKind =
  | "PROFESSION"
  | "USE_CASE"
  | "FEATURE"
  | "PLATFORM"
  | "DEPLOYMENT_MODEL"
  | "LICENSING_MODEL"
  | "BUDGET_RANGE"
  | "CUSTOMER_TYPE"
  | "OPERATING_SYSTEM";

export interface TaxonomyDef {
  kind: TaxonomyKind;
  /** Admin URL segment, e.g. /admin/taxonomies/use-cases */
  key: string;
  /** Public URL base, e.g. /use-case/2d-drafting */
  path: string;
  plural: string;
  singular: string;
  /** Terms can have a parent term. */
  hierarchical: boolean;
  /** Default page heading; {name} is replaced. */
  headline: string;
  /** Default meta description; {name} and {count} are replaced. */
  metaDescription: string;
  /** Short explanation for the admin screen. */
  help: string;
  /** Label for this group on a product page. */
  productLabel: string;
}

export const TAXONOMIES: TaxonomyDef[] = [
  { kind: "USE_CASE", key: "use-cases", path: "use-case", plural: "Use cases", singular: "Use case", hierarchical: true, headline: "Top {name} Software", metaDescription: "Compare {count} {name} software products: features, prices and vendor details.", help: "What buyers want to get done, e.g. 2D Drafting or GST Billing.", productLabel: "Use cases" },
  { kind: "PROFESSION", key: "professions", path: "profession", plural: "Professions", singular: "Profession", hierarchical: true, headline: "Best Software for {name}", metaDescription: "The {count} best software products for {name} — compare features and prices.", help: "Job roles a product suits, e.g. Architect or Accountant.", productLabel: "Best for" },
  { kind: "FEATURE", key: "features", path: "feature", plural: "Features", singular: "Feature", hierarchical: false, headline: "Software with {name}", metaDescription: "{count} software products with {name}. Compare features, plans and prices.", help: "Capabilities buyers search for, e.g. Cloud Collaboration.", productLabel: "Key features" },
  { kind: "PLATFORM", key: "platforms", path: "platform", plural: "Platforms", singular: "Platform", hierarchical: false, headline: "{name} Software", metaDescription: "{count} software products available on {name}.", help: "Where the product runs or has apps, e.g. Android, Web.", productLabel: "Platforms" },
  { kind: "DEPLOYMENT_MODEL", key: "deployment-models", path: "deployment", plural: "Deployment models", singular: "Deployment model", hierarchical: false, headline: "{name} Software", metaDescription: "{count} {name} software products compared.", help: "How it's delivered, e.g. Cloud / SaaS, Desktop, Hybrid.", productLabel: "Deployment" },
  { kind: "LICENSING_MODEL", key: "licensing-models", path: "licensing", plural: "Licensing models", singular: "Licensing model", hierarchical: false, headline: "Software with {name} Licensing", metaDescription: "{count} software products offering {name} licences.", help: "How licences are sold, e.g. Named User, Floating, Perpetual.", productLabel: "Licensing" },
  { kind: "BUDGET_RANGE", key: "budget-ranges", path: "budget", plural: "Budget ranges", singular: "Budget range", hierarchical: false, headline: "Software {name}", metaDescription: "{count} software products {name}. Compare prices and plans.", help: "Price bands, e.g. Under ₹10,000 per year.", productLabel: "Budget" },
  { kind: "CUSTOMER_TYPE", key: "customer-types", path: "customer-type", plural: "Customer types", singular: "Customer type", hierarchical: false, headline: "Software for {name}", metaDescription: "{count} software products built for {name}.", help: "Who buys it, e.g. Enterprise, Professional Teams, Freelancers.", productLabel: "Built for" },
  { kind: "OPERATING_SYSTEM", key: "operating-systems", path: "operating-system", plural: "Operating systems", singular: "Operating system", hierarchical: false, headline: "Software for {name}", metaDescription: "{count} software products that run on {name}.", help: "Supported operating systems, e.g. Windows, macOS, Linux.", productLabel: "Operating systems" },
];

export const TAXONOMY_BY_KIND = Object.fromEntries(TAXONOMIES.map((t) => [t.kind, t])) as Record<TaxonomyKind, TaxonomyDef>;
export const TAXONOMY_BY_KEY = Object.fromEntries(TAXONOMIES.map((t) => [t.key, t])) as Record<string, TaxonomyDef>;
export const TAXONOMY_KINDS = TAXONOMIES.map((t) => t.kind) as [TaxonomyKind, ...TaxonomyKind[]];

export const fillName = (pattern: string, vars: { name: string; count?: number }) =>
  pattern.replace(/\{name\}/g, vars.name).replace(/\{count\}/g, String(vars.count ?? ""));

/** What Admin › Website settings › Classification lists can change on a list (saved in settings key `taxonomies`). */
export type TaxonomyOverride = Partial<Pick<TaxonomyDef, "plural" | "singular" | "headline" | "metaDescription" | "help" | "productLabel">> & { enabled?: boolean };
export type TaxonomyOverrides = Partial<Record<TaxonomyKind, TaxonomyOverride>>;
export interface ResolvedTaxonomy extends TaxonomyDef { enabled: boolean }

/** A list as the website shows it: the built-in definition with the saved wording on top (empty wording = built-in). */
export function taxonomyDef(kind: TaxonomyKind, saved?: TaxonomyOverrides | null): ResolvedTaxonomy {
  const base = TAXONOMY_BY_KIND[kind];
  const o = saved?.[kind] ?? {};
  const text = (k: "plural" | "singular" | "headline" | "metaDescription" | "help" | "productLabel") => o[k]?.trim() || base[k];
  return { ...base, plural: text("plural"), singular: text("singular"), headline: text("headline"), metaDescription: text("metaDescription"), help: text("help"), productLabel: text("productLabel"), enabled: o.enabled !== false };
}
export const taxonomyDefs = (saved?: TaxonomyOverrides | null) => TAXONOMIES.map((t) => taxonomyDef(t.kind, saved));

export const termHeadline = (kind: TaxonomyKind, term: { name: string; headline?: string | null }, def: Pick<TaxonomyDef, "headline"> = TAXONOMY_BY_KIND[kind]) => term.headline?.trim() || fillName(def.headline, term);
export const termPath = (kind: TaxonomyKind, slug: string) => `/${TAXONOMY_BY_KIND[kind].path}/${slug}`;

/** Starter terms installed by the seed (and "Install starter terms" in the admin). */
export const STARTER_TERMS: Record<TaxonomyKind, string[]> = {
  USE_CASE: ["2D Drafting", "3D Modelling", "Architectural BIM", "Architectural Design", "Architectural Visualization", "Automotive Design", "CAD Standards", "CNC Programming", "Computational Design", "Concept Design", "Construction Documentation", "Design Optimization", "Accounting", "GST Billing", "Inventory Management", "Payroll", "Customer Support", "Sales Pipeline", "Project Management", "Recruitment"],
  PROFESSION: ["Architect", "BIM Manager", "CAD Administrator", "CAD Designer", "Civil Engineer", "CNC Programmer", "Design Engineer", "Detailer", "Draftsperson", "Mechanical Engineer", "Interior Designer", "Student", "Accountant", "Chartered Accountant", "HR Manager", "Sales Manager", "Project Manager", "Store Owner"],
  FEATURE: ["Cloud Collaboration", "DWG Support", "Parametric Modelling", "Rendering", "E-invoicing", "GST Returns", "Multi-currency", "Mobile App", "Role-based Access", "API Access", "Offline Mode", "Reports & Dashboards"],
  PLATFORM: ["Android", "iOS", "iPadOS", "Linux", "macOS", "Web", "Web Browser", "Windows"],
  DEPLOYMENT_MODEL: ["Cloud", "Cloud / SaaS", "Cloud Collaboration", "Cloud Platform", "Cloud Services", "Desktop", "Hybrid", "On-premise"],
  LICENSING_MODEL: ["Concurrent / Floating", "Confirm with vendor", "Educational", "Floating", "Free", "Freemium", "Named User", "Perpetual", "Subscription"],
  BUDGET_RANGE: ["Free", "Under ₹10,000", "₹10,000 – ₹50,000", "₹50,000 – ₹2,00,000", "Above ₹2,00,000"],
  CUSTOMER_TYPE: ["Enterprise", "Professional Teams", "Small Business", "Freelancers", "Students & Education"],
  OPERATING_SYSTEM: ["iPadOS", "Linux", "macOS", "Web", "Windows"],
};

export function slugifyTerm(name: string): string {
  return name
    .toLowerCase()
    .replace(/₹/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "term";
}
