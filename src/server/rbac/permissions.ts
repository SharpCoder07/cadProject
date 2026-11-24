/**
 * Permission catalogue and default role matrix. Pure data: safe to import from
 * tests, the seed script and (for cosmetic UI hiding only) client components.
 * Enforcement always happens server-side via assertCan().
 */

export const PERMISSIONS = {
  // Dashboard & analytics
  "dashboard.view": "View dashboard",
  "analytics.view": "View reports and analytics",

  // Catalogue
  "software.view": "View software listings in admin",
  "software.create": "Create software listings",
  "software.edit": "Edit software listings",
  "software.publish": "Publish, unpublish, schedule and archive listings",
  "software.delete": "Delete software listings, and remove features, plans, FAQs and media from a listing",
  "categories.view": "View categories",
  "categories.create": "Create categories",
  "categories.manage": "Edit categories and their hierarchy",
  "categories.delete": "Delete categories",
  "taxonomy.view": "View industries, tags and attributes",
  "taxonomy.create": "Create industries, tags and attributes",
  "taxonomy.manage": "Edit industries, tags and attributes",
  "taxonomy.delete": "Delete industries, tags, attributes and attribute options",
  "vendors.view": "View vendors, brands and resellers",
  "vendors.create": "Create vendors and brands",
  "vendors.manage": "Edit vendors, brands and resellers' authorised products",
  "vendors.delete": "Delete vendors and brands, and remove authorised products",
  "vendors.verify": "Verify vendors and grant publishing rights",
  "reviews.view": "View reviews and questions",
  "reviews.moderate": "Approve, reject and answer reviews and questions",
  "reviews.delete": "Delete reviews and questions",
  "comparisons.view": "View curated comparisons",
  "comparisons.create": "Create curated comparisons",
  "comparisons.manage": "Edit curated comparisons and the comparison showcase",
  "comparisons.delete": "Delete comparisons and remove items from them",
  "offers.view": "View offers",
  "offers.manage": "Create, schedule, edit and end offers on products",
  "offers.delete": "Delete offers",

  // Content
  "cms.pages.view": "View pages and homepage sections",
  "cms.pages.create": "Create pages, and add sections and page templates",
  "cms.pages": "Edit pages and homepage sections",
  "cms.pages.delete": "Delete pages, and remove sections, widgets, buttons and list items from a page",
  "cms.navigation.view": "View menus, banners and announcements",
  "cms.navigation.create": "Create banners and announcements",
  "cms.navigation": "Edit menus, banners and announcements",
  "cms.navigation.delete": "Delete banners and announcements, and remove menu items",
  "cms.blocks.view": "View reusable blocks, testimonials and FAQs",
  "cms.blocks.create": "Create reusable blocks, testimonials and FAQ groups",
  "cms.blocks": "Edit reusable blocks, testimonials and FAQs",
  "cms.blocks.delete": "Delete reusable blocks, testimonials, FAQs and website-editor templates",
  "cms.publish": "Publish CMS pages and blog posts",
  "blog.view": "View blog posts, authors and categories",
  "blog.create": "Create blog posts, authors and categories",
  "blog.manage": "Edit blog posts, authors, categories and tags",
  "blog.delete": "Delete blog posts, authors and categories",
  "media.view": "View the media library",
  "media.create": "Upload media and create folders",
  "media.manage": "Upload and edit media",
  "media.delete": "Delete media",
  "seo.view": "View SEO defaults and redirects",
  "seo.manage": "Edit SEO defaults and redirects",
  "seo.delete": "Delete redirects",
  "geo.view": "View geo locations and local landing pages",
  "geo.create": "Create geo locations and local landing pages",
  "geo.manage": "Edit geo locations, local landing pages and geo settings",
  "geo.delete": "Delete geo locations and local landing pages",
  "site.editMode": "Edit on the website (edit mode): change content directly on the live pages — only what this role can already change in the admin panel",

  // Leads
  "leads.view": "View leads",
  "leads.manage": "Update, assign and annotate leads",
  "leads.export": "Export leads to CSV",

  // Administration
  "settings.manage": "Change website settings and theme",
  "settings.delete": "Remove items from website settings (footer links, menus in settings, wording lists…)",
  "integrations.manage": "Configure integrations and notifications",
  "users.view": "View users and their sessions",
  "users.manage": "Edit users: account status, sessions, sign-in blocks and two-step resets",
  "roles.manage": "Manage roles and permissions, and assign roles to users (Super Admin only)",
  "audit.view": "View audit log",
  "errors.view": "View error logs",
  "errors.manage": "Mark errors resolved or pending, and add notes",
  "approvals.manage": "Approve or reject vendor change requests, and see the whole vendor portal",
  "billing.view": "View vendor plans and subscriptions",
  "billing.manage": "Create and edit vendor plans, subscriptions and payment settings",
  "billing.delete": "Delete vendor plans",
  "admin.viewOnly": "View-only: see every admin page but change nothing (for demos)",
  "compliance.view": "Compliance & privacy: see the module (personal data shown masked)",
  "compliance.manage": "Compliance & privacy: change settings and work on requests, documents and complaints",
  "compliance.sensitive": "Compliance & privacy: see unmasked personal data in privacy records (every view is logged)",
  "compliance.incidents": "Compliance & privacy: see and handle security incidents and data breaches",

  // Vendor portal (always scoped to the user's own vendor). Vendor users never change
  // anything directly: every change below becomes an approval request for a Super Admin.
  "vendor.portal": "Access the vendor portal",
  "vendor.listings": "View own company's products",
  "vendor.listings.submit": "Propose new products and product changes (needs approval)",
  "vendor.listings.delete": "Request unpublishing or deleting products (needs approval)",
  "vendor.profile": "Propose company profile changes (needs approval)",
  "vendor.reviews": "See reviews of own products and propose public replies (needs approval)",
  "vendor.leads": "View own company's leads",
  "vendor.offers": "Propose offers on own products (needs approval)",
  "vendor.billing": "See plans and buy subscriptions for own company (no approval needed)",
  "vendor.team": "See the other users of own company",
  "vendor.team.manage": "Propose adding, changing access of, resetting passwords for and removing company users (needs approval)",
  "vendor.authorised": "Propose products to resell as an authorised reseller (needs approval)",

  // System (always Super Admin only; not offered to other roles)
  "system.manage": "Recycle bin, backup and restore",
  "deletions.approve": "Approve or reject vendor and reseller deletion requests (Super Admin only)",

  // Buyer accounts (people who sign up on the website)
  "buyer.account": "Buyer account: save favourite products, get offer emails and write reviews",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const permissionGroup = (p: Permission) => p.split(".")[0] as string;

// ─── Module × action matrix ──────────────────────────────────────────────────

export const ACTIONS = ["view", "create", "edit", "delete"] as const;
export type ModuleAction = (typeof ACTIONS)[number];
export const ACTION_LABELS: Record<ModuleAction, string> = { view: "View", create: "Create", edit: "Edit", delete: "Delete" };

export interface ModuleDef {
  key: string;
  label: string;
  section: "Overview" | "Catalogue" | "Content" | "Leads & sales" | "Administration";
  view?: Permission;
  create?: Permission;
  edit?: Permission;
  delete?: Permission;
  /** Other actions of this module (publish, verify, export…). */
  extras?: Permission[];
  /** Only the Super Admin has this module; it can't be granted to other roles. */
  superOnly?: boolean;
}

/**
 * Every admin module with its View / Create / Edit / Delete permissions. "Delete" also covers removing
 * single elements inside a record (a section, widget, button, list item, plan, FAQ…). Only the Super Admin
 * has Delete by default; staff without it can't delete ("You don't have permission to delete this item.").
 * Vendor and reseller users never delete directly: their deletions are approval requests for the Super Admin.
 */
export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Dashboard", section: "Overview", view: "dashboard.view" },
  { key: "analytics", label: "Reports & analytics", section: "Overview", view: "analytics.view" },
  { key: "audit", label: "Audit log", section: "Overview", view: "audit.view" },
  { key: "errors", label: "Error logs", section: "Overview", view: "errors.view", edit: "errors.manage" },
  { key: "software", label: "Software listings", section: "Catalogue", view: "software.view", create: "software.create", edit: "software.edit", delete: "software.delete", extras: ["software.publish"] },
  { key: "categories", label: "Categories", section: "Catalogue", view: "categories.view", create: "categories.create", edit: "categories.manage", delete: "categories.delete" },
  { key: "taxonomy", label: "Industries, tags & attributes", section: "Catalogue", view: "taxonomy.view", create: "taxonomy.create", edit: "taxonomy.manage", delete: "taxonomy.delete" },
  { key: "vendors", label: "Vendors, brands & resellers", section: "Catalogue", view: "vendors.view", create: "vendors.create", edit: "vendors.manage", delete: "vendors.delete", extras: ["vendors.verify"] },
  { key: "reviews", label: "Reviews & questions", section: "Catalogue", view: "reviews.view", edit: "reviews.moderate", delete: "reviews.delete" },
  { key: "comparisons", label: "Comparisons", section: "Catalogue", view: "comparisons.view", create: "comparisons.create", edit: "comparisons.manage", delete: "comparisons.delete" },
  { key: "offers", label: "Offers", section: "Catalogue", view: "offers.view", edit: "offers.manage", delete: "offers.delete" },
  { key: "pages", label: "Pages & homepage sections", section: "Content", view: "cms.pages.view", create: "cms.pages.create", edit: "cms.pages", delete: "cms.pages.delete", extras: ["cms.publish", "site.editMode"] },
  { key: "navigation", label: "Menus, banners & announcements", section: "Content", view: "cms.navigation.view", create: "cms.navigation.create", edit: "cms.navigation", delete: "cms.navigation.delete" },
  { key: "blocks", label: "Reusable blocks, testimonials & FAQs", section: "Content", view: "cms.blocks.view", create: "cms.blocks.create", edit: "cms.blocks", delete: "cms.blocks.delete" },
  { key: "blog", label: "Blog", section: "Content", view: "blog.view", create: "blog.create", edit: "blog.manage", delete: "blog.delete" },
  { key: "media", label: "Media library", section: "Content", view: "media.view", create: "media.create", edit: "media.manage", delete: "media.delete" },
  { key: "seo", label: "SEO & redirects", section: "Content", view: "seo.view", edit: "seo.manage", delete: "seo.delete" },
  { key: "geo", label: "Geo locations & local pages", section: "Content", view: "geo.view", create: "geo.create", edit: "geo.manage", delete: "geo.delete" },
  { key: "leads", label: "Leads", section: "Leads & sales", view: "leads.view", edit: "leads.manage", extras: ["leads.export"] },
  { key: "billing", label: "Plans & subscriptions", section: "Leads & sales", view: "billing.view", edit: "billing.manage", delete: "billing.delete" },
  { key: "settings", label: "Website settings & theme", section: "Administration", edit: "settings.manage", delete: "settings.delete" },
  { key: "integrations", label: "Integrations & notifications", section: "Administration", edit: "integrations.manage" },
  { key: "users", label: "Users", section: "Administration", view: "users.view", edit: "users.manage" },
  { key: "approvals", label: "Vendor change requests", section: "Administration", edit: "approvals.manage" },
  { key: "roles", label: "Roles & permissions", section: "Administration", edit: "roles.manage", superOnly: true },
  { key: "deletions", label: "Approve vendor deletion requests", section: "Administration", edit: "deletions.approve", superOnly: true },
  { key: "system", label: "Recycle bin & backups", section: "Administration", edit: "system.manage", superOnly: true },
  // Not super-only (it can be granted later in Roles), but no built-in role except the Super Admin has it.
  { key: "compliance", label: "Compliance & privacy", section: "Administration", view: "compliance.view", edit: "compliance.manage", extras: ["compliance.sensitive", "compliance.incidents"] },
];

/** Compliance & privacy permissions: only the Super Admin has them by default (never in Admin, Demo Viewer or other built-in roles). */
export const COMPLIANCE_PERMISSIONS = ["compliance.view", "compliance.manage", "compliance.sensitive", "compliance.incidents"] as const satisfies readonly Permission[];
const isCompliance = (p: Permission) => (COMPLIANCE_PERMISSIONS as readonly Permission[]).includes(p);

/** Permissions only the Super Admin ever has (never saved on another role). */
export const SUPER_ONLY: Permission[] = MODULES.filter((m) => m.superOnly).flatMap((m) => [m.view, m.create, m.edit, m.delete, ...(m.extras ?? [])].filter((p): p is Permission => Boolean(p)));
/** Every Delete permission. Not given to any built-in role except the Super Admin. */
export const DELETE_PERMISSIONS: Permission[] = MODULES.map((m) => m.delete).filter((p): p is Permission => Boolean(p));
export const moduleOf = (p: Permission) => MODULES.find((m) => [m.view, m.create, m.edit, m.delete, ...(m.extras ?? [])].includes(p));

/**
 * Adds what a set of permissions implies: any action on a module lets you view it. Create, Edit and
 * Delete are never implied by each other: each has to be granted on its own.
 */
export function expandPermissions(perms: Iterable<Permission>): Set<Permission> {
  const set = new Set(perms);
  for (const m of MODULES) {
    const has = (p?: Permission) => Boolean(p && set.has(p));
    if (m.view && (has(m.create) || has(m.edit) || has(m.delete) || (m.extras ?? []).some(has))) set.add(m.view);
  }
  return set;
}

/** Everything a staff Super Admin has: every permission except the vendor, buyer and view-only ones. */
export const superAdminPermissions = (): Permission[] => ALL_PERMISSIONS.filter((p) => !p.startsWith("vendor.") && !p.startsWith("buyer.") && p !== "admin.viewOnly");

export type SystemRoleKey =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "CONTENT_EDITOR"
  | "PRODUCT_MANAGER"
  | "SALES_MANAGER"
  | "ANALYST"
  | "DEMO_VIEWER"
  | "VENDOR"
  | "VENDOR_EDITOR"
  | "VENDOR_VIEWER"
  | "VENDOR_RESELLER"
  | "BUYER";

/** Roles whose key starts with VENDOR belong to a vendor company and only see the vendor portal. */
export const isVendorRoleKey = (key: string) => key === "VENDOR" || key.startsWith("VENDOR_");
/** People who signed up on the website. They only use the /account area. */
export const BUYER_ROLE_KEY = "BUYER";
export const isBuyerRoleKey = (key: string) => key === BUYER_ROLE_KEY;
/** Where someone lands after signing in. */
export const homeFor = (roleKey: string, vendorId: string | null) => (vendorId ? "/vendor" : isBuyerRoleKey(roleKey) ? "/account" : "/admin");

/**
 * A role with this permission can open every staff page (not the Super Admin system tools) but every
 * change is refused on the server. Used for demo accounts.
 */
export const VIEW_ONLY: Permission = "admin.viewOnly";
/** What a view-only account may see: every staff permission except the Super Admin system tools. */
export const viewOnlyPermissions = (): Permission[] =>
  ALL_PERMISSIONS.filter((p) => !p.startsWith("vendor.") && !p.startsWith("buyer.") && !SUPER_ONLY.includes(p) && !isCompliance(p));
export const VIEW_ONLY_MESSAGE = "This is a view-only account, so changes can't be saved.";

const STAFF_NON_ADMIN: Permission[] = ALL_PERMISSIONS.filter(
  (p) => !p.startsWith("vendor.") && !p.startsWith("buyer.") && !SUPER_ONLY.includes(p) && !DELETE_PERMISSIONS.includes(p) && !isCompliance(p) && !["users.manage", "integrations.manage", "approvals.manage", "billing.view", "billing.manage", VIEW_ONLY].includes(p),
);


export const SYSTEM_ROLES: Record<SystemRoleKey, { name: string; description: string; permissions: Permission[] }> = {
  SUPER_ADMIN: {
    name: "Super Admin",
    description: "Full access, including roles and permissions, every deletion and approving deletion requests. Cannot be locked out by other admins.",
    permissions: superAdminPermissions(),
  },
  ADMIN: {
    name: "Admin",
    description: "Runs the platform day to day: views, creates and edits everything. Can't delete unless the Super Admin grants Delete, and can't change roles or permissions.",
    permissions: [...STAFF_NON_ADMIN, "users.manage", "integrations.manage"],
  },
  CONTENT_EDITOR: {
    name: "Content Editor",
    description: "Pages, homepage, navigation, blog, media and SEO.",
    permissions: [
      "dashboard.view",
      "software.view",
      "cms.pages",
      "cms.pages.create",
      "cms.navigation",
      "cms.navigation.create",
      "cms.blocks",
      "cms.blocks.create",
      "cms.publish",
      "blog.manage",
      "blog.create",
      "media.manage",
      "media.create",
      "seo.manage",
      "geo.manage",
      "geo.create",
    ],
  },
  PRODUCT_MANAGER: {
    name: "Product Manager",
    description: "Catalogue: software, categories, vendors, attributes, reviews and comparisons.",
    permissions: [
      "dashboard.view",
      "analytics.view",
      "software.view",
      "software.create",
      "software.edit",
      "software.publish",
      "categories.manage",
      "categories.create",
      "taxonomy.manage",
      "taxonomy.create",
      "vendors.manage",
      "vendors.create",
      "vendors.verify",
      "reviews.moderate",
      "comparisons.manage",
      "comparisons.create",
      "offers.manage",
      "media.manage",
      "media.create",
      "leads.view",
    ],
  },
  SALES_MANAGER: {
    name: "Sales Manager",
    description: "Works the lead pipeline: assigns, follows up, exports.",
    permissions: ["dashboard.view", "analytics.view", "software.view", "leads.view", "leads.manage", "leads.export"],
  },
  DEMO_VIEWER: {
    name: "Demo Viewer",
    description: "Sees every admin page, like an Admin, but can't change anything. For showing the admin panel to someone.",
    permissions: ["admin.viewOnly"],
  },
  ANALYST: {
    name: "Read-only Analyst",
    description: "Read-only access to dashboard, reports, listings and leads.",
    permissions: ["dashboard.view", "analytics.view", "software.view", "leads.view", "audit.view", "errors.view"],
  },
  VENDOR: {
    name: "Vendor Admin",
    description: "Vendor company lead. Proposes product, profile, review-reply and team changes (each needs Super Admin approval) and sees leads.",
    permissions: ["vendor.portal", "vendor.listings", "vendor.listings.submit", "vendor.listings.delete", "vendor.profile", "vendor.reviews", "vendor.leads", "vendor.offers", "vendor.billing", "vendor.team", "vendor.team.manage", "media.manage", "media.create"],
  },
  VENDOR_EDITOR: {
    name: "Vendor Editor",
    description: "Proposes new products and product changes for their company (needs Super Admin approval). Can't request deletions or edit the company profile.",
    permissions: ["vendor.portal", "vendor.listings", "vendor.listings.submit", "vendor.reviews", "vendor.offers", "media.manage", "media.create"],
  },
  VENDOR_VIEWER: {
    name: "Vendor Viewer",
    description: "Read-only access to their company's products and leads.",
    permissions: ["vendor.portal", "vendor.listings", "vendor.leads"],
  },
  VENDOR_RESELLER: {
    name: "Reseller Admin",
    description: "Reseller company lead. Proposes authorised products, profile and team changes (each needs Super Admin approval), sees assigned leads and buys plans.",
    permissions: ["vendor.portal", "vendor.profile", "vendor.authorised", "vendor.leads", "vendor.billing", "vendor.team", "vendor.team.manage", "media.manage", "media.create"],
  },
  BUYER: {
    name: "Buyer",
    description: "Signed up on the website. Saves favourite products, gets offer emails and writes reviews. No admin access.",
    permissions: ["buyer.account"],
  },
};

/** Permissions a vendor may grant to its own users (always scoped to that vendor). */
/** Staff permissions a vendor-portal user may also hold (their own company's images and files). Never Delete. */
export const VENDOR_MEDIA_PERMISSIONS: Permission[] = ["media.view", "media.create", "media.manage"];
export const VENDOR_GRANTABLE: Permission[] = ALL_PERMISSIONS.filter((p) => p.startsWith("vendor.") || VENDOR_MEDIA_PERMISSIONS.includes(p));

/** Short names for vendor permissions, used in team screens and approval requests. */
export const VENDOR_PERMISSION_SHORT: Partial<Record<Permission, string>> = {
  "vendor.portal": "Portal access",
  "vendor.listings": "View products",
  "vendor.listings.submit": "Add & edit products",
  "vendor.listings.delete": "Unpublish & delete products",
  "vendor.profile": "Edit company profile",
  "vendor.reviews": "Reply to reviews",
  "vendor.leads": "See leads",
  "vendor.billing": "Buy plans",
  "vendor.offers": "Propose offers",
  "vendor.team": "See team",
  "vendor.team.manage": "Manage team",
  "vendor.authorised": "Choose products to resell",
  "media.create": "Upload images & files",
  "media.manage": "Edit images & files",
};

/** Permissions that only make sense for a software vendor (own products) or only for a reseller. */
export const VENDOR_ONLY_PERMISSIONS: Permission[] = ["vendor.listings", "vendor.listings.submit", "vendor.listings.delete", "vendor.reviews", "vendor.offers"];
export const RESELLER_ONLY_PERMISSIONS: Permission[] = ["vendor.authorised"];
/** What a company of this kind may grant its own users. */
export const grantableFor = (kind: "VENDOR" | "RESELLER"): Permission[] =>
  VENDOR_GRANTABLE.filter((p) => !(kind === "RESELLER" ? VENDOR_ONLY_PERMISSIONS : RESELLER_ONLY_PERMISSIONS).includes(p));
export const vendorPermissionLabel = (p: string) => VENDOR_PERMISSION_SHORT[p as Permission] ?? PERMISSIONS[p as Permission] ?? p;
