/**
 * “Editing guide” (Admin → Website → Editing guide): every public page of the website and where in the
 * admin each part of it is edited. Keep it in step with the admin menu (components/admin/nav.ts) when
 * screens are added or renamed. `href: "@home"` is replaced with the homepage editor's address.
 */

export type GuideWhere = { path: string[]; href: string } | "code" | "auto";
export interface GuideRow { part: string; where: GuideWhere; tab?: string; note?: string }
export interface GuidePage { name: string; url: string; start: { path: string[]; href: string }; rows: GuideRow[] }
export interface GuideGroup { id: string; title: string; intro: string; pages: GuidePage[] }

export const at = (href: string, ...path: string[]) => ({ path, href });
export const row = (part: string, where: GuideWhere, tab?: string, note?: string): GuideRow => ({ part, where, tab, note });

// Admin screens, labelled as in the sidebar.
export const S = {
  settings: (tab?: string) => at(`/admin/settings${tab ? `?tab=${tab}` : ""}`, "Settings", "Website settings"),
  design: at("/admin/settings?tab=theme", "Settings", "Website design"),
  menus: at("/admin/cms/menus", "Pages", "Navigation menus"),
  pages: at("/admin/cms/pages", "Pages", "Pages & homepage"),
  home: at("@home", "Pages", "Pages & homepage", "Home"),
  blocks: at("/admin/cms/blocks", "Pages", "Reusable blocks"),
  faqs: at("/admin/cms/faqs", "Pages", "FAQs"),
  media: at("/admin/media", "Media"),
  layouts: (page?: string) => at(`/admin/cms/layouts${page ? `?page=${page}` : ""}`, "Pages", "Page layouts"),
  forms: (form?: string) => at(`/admin/cms/forms${form ? `?form=${form}` : ""}`, "Pages", "Forms"),
  texts: (group?: string) => at(`/admin/cms/texts${group ? `?group=${group}` : ""}`, "Pages", "Website texts"),
  products: at("/admin/software", "Products", "All products"),
  categories: at("/admin/categories", "Organise", "Categories"),
  vendors: at("/admin/vendors", "Companies", "Vendors"),
  resellers: at("/admin/resellers", "Companies", "Resellers"),
  brands: at("/admin/brands", "Companies", "Brands"),
  attributes: at("/admin/attributes", "Organise", "Attributes & filters"),
  industries: at("/admin/industries", "Organise", "Industries"),
  comparisons: at("/admin/comparisons", "Products", "Comparisons"),
  offers: at("/admin/offers", "Products", "Offers"),
  reviews: at("/admin/reviews", "Reviews & Q&A", "Reviews"),
  questions: at("/admin/questions", "Reviews & Q&A", "Questions"),
  classifications: at("/admin/taxonomies/use-cases", "Classifications", "<list name>"),
  geoPages: at("/admin/geo/pages", "City pages", "Geo pages"),
  geoLocations: at("/admin/geo/locations", "City pages", "Geo locations"),
  geoSettings: at("/admin/geo/settings", "City pages", "Geo settings"),
  blog: at("/admin/blog", "Blog", "All posts"),
  blogCategories: at("/admin/blog/categories", "Blog", "Categories"),
  blogAuthors: at("/admin/blog/authors", "Blog", "Authors"),
  leads: (q = "") => at(`/admin/leads${q}`, "Leads", "All leads"),
  approvals: at("/admin/approvals", "Partners", "Approvals"),
  banners: at("/admin/cms/banners", "Promotions", "Banners"),
  announcements: at("/admin/cms/announcements", "Promotions", "Announcement bar"),
  testimonials: at("/admin/cms/testimonials", "Promotions", "Testimonials"),
  seo: at("/admin/seo", "SEO & redirects"),
  email: at("/admin/settings/email", "Settings", "Email settings"),
  integrations: at("/admin/integrations", "Settings", "Integrations"),
  showcase: at("/admin/comparisons/showcase", "Products", "Compare page lists"),
  // Compliance & Privacy (Super Admin by default)
  legalDocs: at("/admin/compliance/legal", "Compliance & Privacy", "Policies", "Legal documents"),
  consent: at("/admin/compliance/consent", "Compliance & Privacy", "Policies", "Consent"),
  cookies: at("/admin/compliance/cookies", "Compliance & Privacy", "Policies", "Cookies"),
  requests: at("/admin/compliance/requests", "Compliance & Privacy", "Requests", "Data requests"),
  grievances: at("/admin/compliance/grievances", "Compliance & Privacy", "Requests", "Grievances"),
  contentComplaints: at("/admin/compliance/content", "Compliance & Privacy", "Requests", "Content complaints"),
  complianceSettings: at("/admin/compliance/settings", "Compliance & Privacy", "Compliance settings"),
  complianceOverview: at("/admin/compliance", "Compliance & Privacy", "Overview"),
};

export const EDITING_GUIDE: GuideGroup[] = [
  {
    id: "everywhere", title: "On every page", intro: "Header, footer and site-wide settings that appear across the whole website.",
    pages: [
      { name: "Header", url: "every page (top)", start: S.settings("site"), rows: [
        row("Logo, site name, favicon", S.settings("site"), "Company & contact"),
        row("Phone number (“Talk to a software expert”)", S.settings("site"), "Company & contact"),
        row("Menu links in the top bar (Brands, Compare, Industries, Resources…)", S.menus, undefined, "Choose the Header menu"),
        row("Categories mega menu", S.categories, undefined, "Turn on “Show in navigation” for each category"),
        row("Search box placeholder", S.settings("labels"), "Labels & messages"),
        row("Search suggestions that type themselves out in the search bars", S.settings("labels"), "Labels & messages", "“Search bar typing examples”: one per line; empty = off"),
        row("“Get free quote” button text", S.settings("labels"), "Labels & messages"),
        row("“Browse” menu (use cases, professions, platforms…)", S.menus, undefined, "Header menu › Browse group"),
        row("Announcement bar above the header", S.announcements, undefined, "Show or hide it in Website design"),
        row("Header height (standard / compact)", S.design),
      ] },
      { name: "Footer", url: "every page (bottom)", start: S.menus, rows: [
        row("Link columns: Software, Resources, Company", S.menus, undefined, "Menus footer.software, footer.resources, footer.company"),
        row("Email, sales email, WhatsApp, address, social links", S.settings("site"), "Company & contact"),
        row("Copyright company name", S.settings("site"), "Company & contact", "Legal company name"),
        row("Footer note", S.design, undefined, "Footer note field"),
        row("“Need expert guidance?” band and the four promises", S.texts("footer"), undefined, "The phone number in it comes from Company & contact"),
        row("“Cookie settings” link (bottom line)", S.texts("cookies"), undefined, "Always shown; reopens the cookie choices"),
        row("Links to Privacy policy, Terms, Privacy center", S.menus, undefined, "Add them to a footer menu, e.g. footer.company"),
      ] },
      { name: "Cookie banner", url: "every page (bottom left, first visit)", start: S.cookies, rows: [
        row("Heading, text and button labels", S.texts("cookies")),
        row("Show the banner, ask again after N days, notice version", S.cookies, undefined, "Banner section"),
        row("Categories and the cookies listed in Customise", S.cookies, undefined, "Categories table"),
        row("Visitors' choices (log)", S.cookies, undefined, "Cookie choices table"),
        row("Analytics and marketing scripts", S.integrations, undefined, "IDs there; they only load after a visitor allows them here"),
      ] },
      { name: "Look and feel", url: "whole website", start: S.design, rows: [
        row("Colours, fonts, corner style", S.design),
        row("Design: Classic or Fresh Lime Design (Lime or Teal)", S.design, undefined, "Click a preset button at the top, or choose in the Website design field"),
        row("Animations: full, subtle or off", S.design, undefined, "Animations field"),
        row("Button labels, badges, form titles", S.settings("labels"), "Labels & messages"),
        row("Images and files used anywhere", S.media),
      ] },
      { name: "Enquiry form (pop-up and inline)", url: "every “Get free quote” / “Book a demo” button", start: S.settings("labels"), rows: [
        row("Fields: labels, order, required, hidden, your own questions", S.forms("enquiry")),
        row("Form title, subtitle, success message, button text", S.settings("labels"), "Labels & messages"),
        row("Consent text", S.settings("leads"), "Leads"),
        row("Enquiries per hour, spam filter, reference prefix", S.settings("rules"), "Business rules"),
        row("Error messages", S.texts("forms")),
        row("Who gets emailed about new enquiries", S.email, undefined, "Notifications section"),
        row("Submitted enquiries", S.leads()),
      ] },
      { name: "Search engines, sharing and tracking", url: "whole website", start: S.seo, rows: [
        row("Homepage title, title template, default description", S.seo, undefined, "SEO defaults"),
        row("Default social sharing image, X handle", S.seo, undefined, "SEO defaults"),
        row("Google / Bing verification codes, allow indexing", S.seo, undefined, "SEO defaults"),
        row("Redirects from old URLs", S.seo, undefined, "Redirects"),
        row("Google Analytics, Tag Manager, Meta Pixel, Clarity", S.integrations, undefined, "Analytics & tracking; they load only after the visitor accepts them in the cookie banner"),
      ] },
    ],
  },
  {
    id: "home", title: "Homepage", intro: "The homepage is built from blocks. Open it, then click a block to edit it, drag to reorder, or switch it off.",
    pages: [
      { name: "Homepage", url: "/", start: S.home, rows: [
        row("Top banner: headline, popular searches", S.home, undefined, "Top banner with search block"),
        row("Top banner heading and supporting text", S.home, undefined, "Top banner with search block: Heading and Supporting text"),
        row("Path labels around the heading (Discover, Compare, Shortlist, Buy)", S.texts("home"), undefined, "Large screens only; the moving dot is automatic"),
        row("Top banner figures (products, categories, brands, reviews)", "auto", undefined, "Counted from your catalogue"),
        row("“Top software brands” logos", S.home, undefined, "Pick brands in the Top banner with search block; logos and order in Companies › Brands"),
        row("Browse by category", S.home, undefined, "Category grid block; names and icons in Organise › Categories"),
        row("Software lists and category tabs", S.home, undefined, "Software list / Software by category tabs blocks"),
        row("Which products count as featured, popular, trending", S.products, "Promotion & related", "Open the product"),
        row("Live deals", S.offers),
        row("How it works steps", S.home, undefined, "How it works block"),
        row("Comparisons", S.comparisons),
        row("Testimonials", S.testimonials),
        row("FAQs", S.faqs, undefined, "The FAQ block chooses which group to show"),
        row("Latest insights (blog cards)", S.blog),
        row("Banner carousel", S.banners, undefined, "The block picks a placement, e.g. home.hero"),
        row("Call-to-action strips, stats, text", S.home, undefined, "Call to action / Stats / Text blocks"),
        row("Page title and description in Google", S.seo, undefined, "Homepage title in SEO defaults"),
      ] },
    ],
  },
  {
    id: "products", title: "Products and listings", intro: "Product pages, category pages and every list of software.",
    pages: [
      { name: "Product page", url: "/software/<product>", start: S.products, rows: [
        row("Name, logo, tagline, vendor, brand, website", S.products, "Basics", "Open the product"),
        row("About / description", S.products, "Description"),
        row("Plans, starting price, free trial", S.products, "Pricing"),
        row("Key features", S.products, "Features"),
        row("Screenshots, videos, brochures", S.products, "Screenshots & media"),
        row("Specifications", S.products, "Specifications"),
        row("Product FAQs", S.products, "FAQs"),
        row("Categories and industries it appears in", S.products, "Categories"),
        row("Use cases, professions, platforms… (shown in Specifications)", S.products, "Classifications"),
        row("Editorial pros/cons, best for, alternatives, featured flags", S.products, "Promotion & related"),
        row("Title and description in Google", S.products, "SEO"),
        row("Buyer reviews (approve / reject)", S.reviews),
        row("Product questions and answers", S.questions),
        row("Offers on the product", S.offers),
        row("Authorised resellers section", S.resellers, undefined, "Open a reseller › Authorised products"),
        row("Company details section", S.vendors),
        row("Which sections show on every product page, and their order", S.layouts("product")),
      ] },
      { name: "Category page", url: "/categories/<category>", start: S.categories, rows: [
        row("Name, description, icon, image, parent category", S.categories, "General", "Open the category"),
        row("Show in the Categories menu", S.categories, "General"),
        row("Top banner, featured product, buyer's guide text", S.categories, "Page layout"),
        row("Which sections show on every category page, and their order", S.layouts("category")),
        row("Filters in the product directory", S.categories, "Filters", "Create attribute filters in Organise › Attributes & filters"),
        row("Title and description in Google", S.categories, "SEO"),
        row("Products listed", S.products, "Categories", "Set on each product"),
        row("Advertisement between products", S.banners, undefined, "Placement category.<category-slug>"),
        row("Products per page, default sort, filter groups", S.settings("listing"), "Listing pages"),
        row("Price comparison table and FAQs", "auto", undefined, "Built from the products' plans and data"),
      ] },
      { name: "All categories", url: "/categories", start: S.categories, rows: [row("Category list, order and icons", S.categories)] },
      { name: "Classification pages", url: "/use-case/…, /profession/…, /feature/…, /platform/…, /deployment/…, /licensing/…, /budget/…, /customer-type/…, /operating-system/…", start: S.classifications, rows: [
        row("Terms in each list (add, rename, delete)", S.classifications, undefined, "e.g. Classifications › Use cases"),
        row("List names, page headings, or switching a whole list off", S.settings("taxonomies"), "Classification lists"),
        row("Page heading, promoted product, page content, FAQs, SEO", S.classifications, undefined, "Click Edit on a term"),
        row("“Explore related” chip rows and budget price ladder headings", S.texts("term"), undefined, "The chips and bars are built automatically"),
        row("Products shown", S.products, "Classifications", "Set on each product"),
      ] },
      { name: "Industries", url: "/industries and /industries/<industry>", start: S.industries, rows: [
        row("Industry names, descriptions, icons, SEO", S.industries),
        row("Products in each industry", S.products, "Categories", "Industries field on each product"),
      ] },
      { name: "Brands", url: "/brands and /brands/<brand>", start: S.brands, rows: [
        row("Brand name, logo, website, about, display order, visible on website, SEO", S.brands),
        row("Brand page: small label above the name and the figure captions", S.texts("brand"), undefined, "Products, reviews and rating figures are counted automatically"),
        row("Products under a brand", S.products, "Basics", "Brand field"),
      ] },
      { name: "Vendors", url: "/vendors and /vendors/<vendor>", start: S.vendors, rows: [
        row("Company name, logo, about, location, website, SEO", S.vendors, undefined, "Open the vendor"),
        row("Verified badge", S.vendors, undefined, "Verification panel on the vendor's page"),
        row("All vendors: partner network picture and its labels", S.texts("vendors"), undefined, "Logos come from the vendors and resellers themselves"),
        row("Products listed", S.products, "Basics", "Vendor field"),
        row("Changes the vendor sends from their portal", S.approvals),
      ] },
      { name: "Reseller profile", url: "/resellers/<reseller>", start: S.resellers, rows: [
        row("Name, logo, about, cities served, SEO", S.resellers, undefined, "Open the reseller"),
        row("Products they're authorised to sell", S.resellers, undefined, "Authorised products panel"),
        row("Product requests from the reseller portal", S.approvals),
      ] },
      { name: "Search results", url: "/search", start: S.settings("listing"), rows: [
        row("Results, sorting, filters", "auto", undefined, "From the catalogue; options in Website settings › Listing pages"),
        row("Search placeholder", S.settings("labels"), "Labels & messages"),
      ] },
    ],
  },
  {
    id: "compare", title: "Compare", intro: "The comparison tool and the curated head-to-head pages.",
    pages: [
      { name: "Compare tool", url: "/compare", start: S.comparisons, rows: [
        row("Comparison table", "auto", undefined, "Built from the chosen products' data"),
        row("“Popular comparisons” (hand-made)", S.comparisons),
        row("Which comparisons show in each list on the Compare page", S.showcase),
        row("Trending and by-category comparisons", "auto", undefined, "Paired from the most enquired-about products"),
        row("“How to compare software confidently” steps (titles and tags) and FAQs", S.texts("compare"), undefined, "Tags: separate them with |"),
      ] },
      { name: "Comparison page", url: "/compare/<a-vs-b>", start: S.comparisons, rows: [
        row("Products compared, heading, verdict text, SEO", S.comparisons, undefined, "Open the comparison"),
      ] },
    ],
  },
  {
    id: "content", title: "Content pages and blog", intro: "About, Contact, legal pages, landing pages and the blog.",
    pages: [
      { name: "Content pages", url: "/about, /contact and any page you create", start: S.pages, rows: [
        row("Page text and sections", S.pages, undefined, "Open the page; it uses the same blocks as the homepage"),
        row("Contact page: phone, WhatsApp, emails, address, hours", S.settings("site"), "Company & contact", "Shown on pages that use the Contact template"),
        row("Create a new page", S.pages, undefined, "Create page; the address is its slug"),
        row("Sections shared by several pages", S.blocks),
        row("Link the page in the header or footer", S.menus),
        row("FAQ groups shown on pages", S.faqs),
      ] },
      { name: "Blog", url: "/blog, /blog/<post>, /blog/author/<author>", start: S.blog, rows: [
        row("Posts: title, text, cover, category, tags, SEO", S.blog, undefined, "Open or write a post"),
        row("Publish, schedule or unpublish", S.blog, undefined, "Buttons at the bottom of the post"),
        row("Authors and their pages", S.blogAuthors),
        row("Blog categories", S.blogCategories),
      ] },
    ],
  },
  {
    id: "local", title: "Local (geo) pages", intro: "City and area pages such as /delhi/<brand> or /delhi/software/<product>.",
    pages: [
      { name: "Geo pages", url: "/<city>/<brand> and /<city>/software/<product>", start: S.geoPages, rows: [
        row("Create, publish, edit a city page", S.geoPages),
        row("Cities, states and areas", S.geoLocations),
        row("Turn geo pages on, default text templates", S.geoSettings),
      ] },
    ],
  },
  {
    id: "partners", title: "Partner and account pages", intro: "Pages for vendors and resellers who want to join, and the sign-in pages.",
    pages: [
      { name: "List your software", url: "/list-your-software", start: S.leads("?source=LIST_SOFTWARE&status=ALL"), rows: [
        row("Page text and benefits", S.texts("listSoftware")),
        row("“How it works” roadmap steps", S.texts("listSoftware"), undefined, "Step labels, titles and texts"),
        row("Form fields, button and thank-you message", S.forms("listSoftware")),
        row("Applications received", S.leads("?source=LIST_SOFTWARE&status=ALL"), undefined, "Source “List your software”"),
        row("Confirmation email to the applicant", S.email, undefined, "Templates › Listing request received"),
      ] },
      { name: "Become a reseller", url: "/become-a-reseller", start: S.leads("?source=BECOME_RESELLER&status=ALL"), rows: [
        row("Page text and benefits", S.texts("becomeReseller")),
        row("“How it works” roadmap steps", S.texts("becomeReseller"), undefined, "Step labels, titles and texts"),
        row("Form fields, button and thank-you message", S.forms("becomeReseller")),
        row("Applications received", S.leads("?source=BECOME_RESELLER&status=ALL"), undefined, "Source “Become a reseller”"),
        row("Confirmation email to the applicant", S.email, undefined, "Templates › Reseller application received"),
      ] },
      { name: "Sign in, sign up, reset password", url: "/login, /signup, /reset-password", start: S.settings("site"), rows: [
        row("Logo", S.settings("site"), "Company & contact"),
        row("Left panel text and points", S.texts("auth"), undefined, "Figures are counted automatically; the background drawings and animations are automatic"),
        row("Optional consent ticks on sign-up", S.consent, undefined, "Purposes marked “signup”; never pre-ticked"),
        row("“I agree to the terms and privacy policy” tick", S.legalDocs, undefined, "Records the versions in force"),
        row("Password rules and the “All rules” pop-up", "code", undefined, "Fixed for security"),
        row("Emails (confirm, reset, invite, welcome)", S.email, undefined, "Templates"),
      ] },
    ],
  },
  {
    id: "privacy", title: "Legal and privacy", intro: "Legal documents, the Privacy center and everything visitors see about their data. Edited in Compliance & Privacy (Super Admin by default).",
    pages: [
      { name: "Legal documents", url: "/privacy-policy, /terms, /cookie-policy, /disclaimer, /grievance-policy, /review-policy, /vendor-agreement, /reseller-agreement", start: S.legalDocs, rows: [
        row("Document text (new version, preview, publish now or from a date)", S.legalDocs, undefined, "Open the document › New version"),
        row("Earlier versions and what changed", S.legalDocs, undefined, "Versions list and “Changes from …”"),
        row("Who accepted which version", S.legalDocs, undefined, "Acceptances on the document"),
        row("Ask people to accept an update", S.legalDocs, undefined, "“Ask people to accept this version” on the draft"),
        row("Wording around the text (version line, notices)", S.texts("legal")),
        row("Before a version is published", S.pages, undefined, "The old Website page at the same address still shows"),
      ] },
      { name: "Privacy center", url: "/privacy-center", start: S.requests, rows: [
        row("Grievance officer details on the page", S.complianceSettings),
        row("Headings, rights list, form labels and messages", S.texts("privacyCenter")),
        row("Data requests received", S.requests),
        row("Complaints received", S.grievances),
        row("Content reports received", S.contentComplaints),
        row("Emails to the person (confirm, received, update)", S.email, undefined, "Templates › privacy request emails"),
        row("Target dates for replies", S.complianceSettings, undefined, "Timelines; empty = no date"),
      ] },
      { name: "Consent choices", url: "sign-up and Account › Settings", start: S.consent, rows: [
        row("What people can agree to (marketing emails, newsletter…)", S.consent, undefined, "Purposes"),
        row("Who agreed to what, and when", S.consent, undefined, "Consent records"),
        row("Panel wording in the account", S.texts("privacy")),
      ] },
      { name: "Everything at a glance", url: "admin only", start: S.complianceOverview, rows: [
        row("What needs attention", S.complianceOverview),
      ] },
    ],
  },
  {
    id: "accounts", title: "Accounts and portals", intro: "What signed-in buyers, vendors and resellers see.",
    pages: [
      { name: "Buyer account", url: "/account", start: S.settings("site"), rows: [
        row("Dashboard greeting and figures", "auto", undefined, "Their name and their favourites, offers and reviews"),
        row("Privacy & consent panel (Account settings)", S.consent, undefined, "Purposes marked “account”"),
        row("Privacy center (download my data, my requests)", S.requests),
        row("Notice asking to accept updated terms", S.legalDocs, undefined, "Appears when a version asks for acceptance"),
        row("Emails they get", S.email),
      ] },
      { name: "Vendor and reseller portals", url: "/vendor, /reseller", start: S.approvals, rows: [
        row("Changes they send (products, profile, offers, replies)", S.approvals),
        row("Notice asking to accept the partner agreement", S.legalDocs, undefined, "Vendor listing agreement / Reseller partner agreement"),
        row("Plans they can buy", at("/admin/billing/plans", "Partners", "Plans & billing", "Vendor plans")),
        row("What the portal shows and allows", at("/admin/vendor-portal", "Partners", "Vendor portal")),
      ] },
    ],
  },
];

/** One row of the guide, flattened for the "Where do I change…?" search (Ctrl K). */
export interface GuideHit { part: string; page: string; where: string; href: string; note?: string }

/** Every guide row that points at an admin screen, for search. `homeHref` replaces "@home". */
export function guideIndex(homeHref: string): GuideHit[] {
  const seen = new Set<string>();
  return EDITING_GUIDE.flatMap((g) =>
    g.pages.flatMap((p) =>
      p.rows.flatMap((r) => {
        if (typeof r.where !== "object") return [];
        const href = r.where.href === "@home" ? homeHref : r.where.href;
        const key = `${r.part}|${href}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ part: r.part, page: p.name, where: `${r.where.path.join(" › ")}${r.tab ? ` › ${r.tab} tab` : ""}`, href, ...(r.note ? { note: r.note } : {}) }];
      }),
    ),
  );
}
