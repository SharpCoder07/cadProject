import type { Permission } from "@/server/rbac/permissions";
import { TAXONOMIES } from "@/lib/taxonomies";

/** A page link. Inside a parent item it renders as an indented sub-link. */
export interface AdminNavLink {
  label: string;
  href: string;
  permission: Permission;
  /** Icon used in search results (sub-links show no icon in the sidebar). */
  icon?: string;
  /** Count shown as a pill (e.g. reviews waiting for approval); filled in per request by the layout. */
  badge?: number;
}
/** A sidebar entry: either a direct link (href + permission) or a parent with sub-links. */
export interface AdminNavItem {
  label: string;
  icon: string;
  href?: string;
  permission?: Permission;
  children?: AdminNavLink[];
  /** Count shown as a pill (e.g. pending approvals); filled in per request by the layout. */
  badge?: number;
}
export interface AdminNavGroup {
  /** Section heading; empty for the top group (Dashboard). */
  label: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: "/admin", icon: "dashboard", permission: "dashboard.view" },
      { label: "Editing guide", href: "/admin/guide", icon: "guide", permission: "dashboard.view" },
    ],
  },
  {
    label: "Catalogue",
    items: [
      {
        label: "Products",
        icon: "software",
        children: [
          { label: "All products", href: "/admin/software", permission: "software.view", icon: "software" },
          { label: "Offers", href: "/admin/offers", permission: "offers.view", icon: "offers" },
          { label: "Comparisons", href: "/admin/comparisons", permission: "comparisons.view", icon: "compare" },
          { label: "Compare page lists", href: "/admin/comparisons/showcase", permission: "comparisons.view", icon: "compare" },
        ],
      },
      {
        label: "Companies",
        icon: "vendors",
        children: [
          { label: "Vendors", href: "/admin/vendors", permission: "vendors.view", icon: "vendors" },
          { label: "Resellers", href: "/admin/resellers", permission: "vendors.view", icon: "resellers" },
          { label: "Brands", href: "/admin/brands", permission: "vendors.view", icon: "brands" },
        ],
      },
      {
        label: "Organise",
        icon: "categories",
        children: [
          { label: "Categories", href: "/admin/categories", permission: "categories.view", icon: "categories" },
          { label: "Industries", href: "/admin/industries", permission: "taxonomy.view", icon: "industries" },
          { label: "Attributes & filters", href: "/admin/attributes", permission: "taxonomy.view", icon: "attributes" },
        ],
      },
      {
        label: "Classifications",
        icon: "classifications",
        children: TAXONOMIES.map((t) => ({ label: t.plural, href: `/admin/taxonomies/${t.key}`, permission: "taxonomy.view" as const, icon: "classifications" })),
      },
      {
        label: "Reviews & Q&A",
        icon: "reviews",
        children: [
          { label: "Reviews", href: "/admin/reviews", permission: "reviews.view", icon: "reviews" },
          { label: "Questions", href: "/admin/questions", permission: "reviews.view", icon: "questions" },
        ],
      },
    ],
  },
  {
    label: "Website & content",
    items: [
      {
        label: "Pages",
        icon: "pages",
        children: [
          { label: "Pages & homepage", href: "/admin/cms/pages", permission: "cms.pages.view", icon: "pages" },
          { label: "Navigation menus", href: "/admin/cms/menus", permission: "cms.navigation.view", icon: "menus" },
          { label: "Reusable blocks", href: "/admin/cms/blocks", permission: "cms.blocks.view", icon: "blocks" },
          { label: "FAQs", href: "/admin/cms/faqs", permission: "cms.blocks.view", icon: "faqs" },
          { label: "Forms", href: "/admin/cms/forms", permission: "settings.manage", icon: "clipboard" },
          { label: "Page layouts", href: "/admin/cms/layouts", permission: "settings.manage", icon: "website" },
          { label: "Website texts", href: "/admin/cms/texts", permission: "settings.manage", icon: "texts" },
        ],
      },
      { label: "Media", href: "/admin/media", icon: "media", permission: "media.view" },
      {
        label: "Blog",
        icon: "blog",
        children: [
          { label: "All posts", href: "/admin/blog", permission: "blog.view", icon: "blog" },
          { label: "Categories", href: "/admin/blog/categories", permission: "blog.view", icon: "categories" },
          { label: "Authors", href: "/admin/blog/authors", permission: "blog.view", icon: "users" },
        ],
      },
      {
        label: "City pages",
        icon: "globe",
        children: [
          { label: "Geo locations", href: "/admin/geo/locations", permission: "geo.view", icon: "globe" },
          { label: "Geo pages", href: "/admin/geo/pages", permission: "geo.view", icon: "globe" },
          { label: "Geo settings", href: "/admin/geo/settings", permission: "geo.view", icon: "globe" },
        ],
      },
    ],
  },
  {
    label: "Marketing",
    items: [
      {
        label: "Promotions",
        icon: "announcements",
        children: [
          { label: "Banners", href: "/admin/cms/banners", permission: "cms.navigation.view", icon: "banners" },
          { label: "Announcement bar", href: "/admin/cms/announcements", permission: "cms.navigation.view", icon: "announcements" },
          { label: "Testimonials", href: "/admin/cms/testimonials", permission: "cms.blocks.view", icon: "testimonials" },
        ],
      },
      { label: "SEO & redirects", href: "/admin/seo", icon: "seo", permission: "seo.view" },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        label: "Leads",
        icon: "leads",
        children: [
          { label: "All leads", href: "/admin/leads", permission: "leads.view", icon: "leads" },
          { label: "Lead reports", href: "/admin/leads/reports", permission: "analytics.view", icon: "reports" },
        ],
      },
    ],
  },
  {
    label: "Partners",
    items: [
      { label: "Approvals", href: "/admin/approvals", icon: "approvals", permission: "approvals.manage" },
      // Deletions asked for by people without Delete permission (Super Admin only).
      { label: "Deletion requests", href: "/admin/deletions", icon: "bin", permission: "deletions.approve" },
      { label: "Vendor portal", href: "/admin/vendor-portal", icon: "portal", permission: "approvals.manage" },
      {
        label: "Plans & billing",
        icon: "billing",
        children: [
          { label: "Subscriptions", href: "/admin/billing/subscriptions", permission: "billing.view", icon: "billing" },
          { label: "Vendor plans", href: "/admin/billing/plans", permission: "billing.view", icon: "billing" },
          { label: "Payment settings", href: "/admin/settings/payments", permission: "billing.view", icon: "payments" },
        ],
      },
    ],
  },
  {
    label: "Compliance & Privacy",
    items: [
      { label: "Overview", href: "/admin/compliance", icon: "privacy", permission: "compliance.view" },
      {
        label: "Requests",
        icon: "inbox",
        children: [
          { label: "Data requests", href: "/admin/compliance/requests", permission: "compliance.view", icon: "inbox" },
          { label: "Grievances", href: "/admin/compliance/grievances", permission: "compliance.view", icon: "grievance" },
          { label: "Content complaints", href: "/admin/compliance/content", permission: "compliance.view", icon: "flag" },
        ],
      },
      {
        label: "Policies",
        icon: "legal",
        children: [
          { label: "Legal documents", href: "/admin/compliance/legal", permission: "compliance.view", icon: "legal" },
          { label: "Consent", href: "/admin/compliance/consent", permission: "compliance.view", icon: "consent" },
          { label: "Cookies", href: "/admin/compliance/cookies", permission: "compliance.view", icon: "cookie" },
          { label: "Data retention", href: "/admin/compliance/retention", permission: "compliance.view", icon: "archive" },
          { label: "Vendor compliance", href: "/admin/compliance/vendors", permission: "compliance.view", icon: "resellers" },
        ],
      },
      {
        label: "Security",
        icon: "incident",
        children: [
          { label: "Security incidents", href: "/admin/compliance/incidents", permission: "compliance.incidents", icon: "incident" },
          { label: "Security & audit logs", href: "/admin/compliance/security", permission: "compliance.view", icon: "shield" },
        ],
      },
      { label: "Compliance settings", href: "/admin/compliance/settings", icon: "settings", permission: "compliance.view" },
    ],
  },
  {
    label: "Team & security",
    items: [
      { label: "Users", href: "/admin/users", icon: "users", permission: "users.view" },
      { label: "Roles & permissions", href: "/admin/roles", icon: "roles", permission: "users.view" },
      { label: "Blocked sign-ins", href: "/admin/users/blocked", icon: "shield", permission: "users.view" },
      {
        label: "Logs",
        icon: "logs",
        children: [
          { label: "Audit logs", href: "/admin/audit-log", icon: "audit", permission: "audit.view" },
          { label: "Error logs", href: "/admin/logs/errors", icon: "bug", permission: "errors.view" },
        ],
      },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Website settings", href: "/admin/settings", icon: "settings", permission: "settings.manage" },
      { label: "Website design", href: "/admin/settings?tab=theme", icon: "design", permission: "settings.manage" },
      { label: "Email settings", href: "/admin/settings/email", icon: "email", permission: "integrations.manage" },
      { label: "Integrations", href: "/admin/integrations", icon: "integrations", permission: "integrations.manage" },
      {
        // Everyone's own notifications (staff without settings rights see just this here).
        label: "My notifications",
        icon: "bell",
        children: [
          { label: "Notifications", href: "/admin/notifications", permission: "dashboard.view", icon: "bell" },
          { label: "Email notifications", href: "/admin/notifications/email", permission: "dashboard.view", icon: "email" },
        ],
      },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Recycle bin", href: "/admin/system/recycle-bin", icon: "bin", permission: "system.manage" },
      { label: "Backup & restore", href: "/admin/system/backups", icon: "backup", permission: "system.manage" },
      { label: "Deployment guide", href: "/admin/system/deployment", icon: "deploy", permission: "system.manage" },
    ],
  },
];

/** Keeps only what the user may open. A parent left with one sub-link becomes a direct link. */
export function filterNav(groups: AdminNavGroup[], can: (p: Permission) => boolean): AdminNavGroup[] {
  return groups
    .map((g) => ({
      ...g,
      items: g.items.flatMap((item): AdminNavItem[] => {
        if (!item.children) return item.permission && can(item.permission) ? [item] : [];
        const children = item.children.filter((c) => can(c.permission));
        if (!children.length) return [];
        if (children.length === 1) return [{ label: item.label, icon: children[0]!.icon ?? item.icon, href: children[0]!.href, permission: children[0]!.permission }];
        return [{ ...item, children }];
      }),
    }))
    .filter((g) => g.items.length);
}

/** Every reachable page, for the command palette and active-link matching. */
export function flattenNav(groups: AdminNavGroup[]) {
  return groups.flatMap((g) =>
    g.items.flatMap((item) =>
      item.children
        ? item.children.map((c) => ({ label: c.label, href: c.href, icon: c.icon ?? item.icon, group: item.label, parent: item.label as string | undefined }))
        : item.href
          ? [{ label: item.label, href: item.href, icon: item.icon, group: g.label || "Overview", parent: undefined as string | undefined }]
          : [],
    ),
  );
}

export interface AdminCreateItem {
  label: string;
  href: string;
  icon: string;
  permission: Permission;
}

/** Shortcuts for the top bar's Create menu and the dashboard's quick actions. */
export const CREATE_ITEMS: AdminCreateItem[] = [
  { label: "Create page", href: "/admin/cms/pages", icon: "pages", permission: "cms.pages.create" },
  { label: "Create product", href: "/admin/software/new", icon: "software", permission: "software.create" },
  { label: "Add category", href: "/admin/categories/new", icon: "categories", permission: "categories.create" },
  { label: "Add vendor", href: "/admin/vendors/new", icon: "vendors", permission: "vendors.create" },
  { label: "Add reseller", href: "/admin/resellers/new", icon: "resellers", permission: "vendors.create" },
  { label: "Write blog post", href: "/admin/blog/new", icon: "blog", permission: "blog.create" },
  { label: "Add banner", href: "/admin/cms/banners", icon: "banners", permission: "cms.navigation.create" },
  { label: "Upload media", href: "/admin/media", icon: "media", permission: "media.create" },
];
