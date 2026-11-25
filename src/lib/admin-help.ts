/**
 * One-line "what is this page for?" help for admin screens, shown from the ? button in the top bar.
 * `site` is where its changes show on the website (opened in a new tab). Longest matching path wins.
 */
export interface AdminHelp { what: string; site?: string; siteLabel?: string }

const HELP: Record<string, AdminHelp> = {
  "/admin": { what: "Your starting point: what's waiting for you, recent leads and quick links." },
  "/admin/guide": { what: "Pick any page of the website and see where each part of it is edited. Every grey path is a link." },
  "/admin/software": { what: "Every software product listed on the website: details, pricing, features, screenshots and SEO.", site: "/categories", siteLabel: "Product pages" },
  "/admin/offers": { what: "Discounts and deals shown on product pages, the homepage deals block and to buyers who saved the product.", site: "/" },
  "/admin/comparisons/showcase": { what: "Which comparisons appear in each list on the Compare page.", site: "/compare" },
  "/admin/comparisons": { what: "Hand-made “A vs B” comparison pages with your own verdict.", site: "/compare" },
  "/admin/vendors": { what: "Software companies: their profile page, logo and verified badge.", site: "/vendors" },
  "/admin/resellers": { what: "Resellers: their profile page, cities served and the products they're authorised to sell.", site: "/vendors" },
  "/admin/brands": { what: "Brands (e.g. AutoCAD by Autodesk): brand pages and the “Top software brands” logos.", site: "/brands" },
  "/admin/categories": { what: "Categories: the Categories menu, category pages, their filters and buyer's guide.", site: "/categories" },
  "/admin/industries": { what: "Industries (e.g. Construction) and their pages.", site: "/industries" },
  "/admin/attributes": { what: "The filters buyers use on category pages (e.g. “Supports DWG”). Advanced: set up once." },
  "/admin/taxonomies": { what: "Lists such as use cases, professions and platforms. Each term gets its own page on the website.", site: "/use-case" },
  "/admin/reviews": { what: "Buyer reviews: approve or reject them before they appear on product pages." },
  "/admin/questions": { what: "Buyer questions on product pages: answer, approve or reject them." },
  "/admin/cms/pages": { what: "The homepage and pages like About and Contact, built from blocks you can add, reorder and hide.", site: "/" },
  "/admin/cms/menus": { what: "The links in the header menu and the footer columns.", site: "/" },
  "/admin/cms/blocks": { what: "Sections you build once and reuse on several pages; edit here, every page updates." },
  "/admin/cms/faqs": { what: "Question-and-answer groups shown by FAQ blocks on pages." },
  "/admin/cms/forms": { what: "The fields on the enquiry, contact and partner forms: labels, order, required or hidden." },
  "/admin/cms/layouts": { what: "Which sections appear on every product, category or brand page, and in what order.", site: "/categories" },
  "/admin/cms/texts": { what: "Every fixed wording on the website (headings, buttons, messages), grouped by page." },
  "/admin/media": { what: "All images and files. Upload once, use anywhere." },
  "/admin/blog": { what: "Blog articles: write, schedule and publish.", site: "/blog" },
  "/admin/geo": { what: "City pages such as “AutoCAD in Pune”, and the cities and areas they cover." },
  "/admin/cms/banners": { what: "Promotional banners in banner blocks and between products in lists.", site: "/" },
  "/admin/cms/announcements": { what: "The thin strip above the website header for short announcements.", site: "/" },
  "/admin/cms/testimonials": { what: "Customer quotes shown by testimonial blocks.", site: "/" },
  "/admin/seo": { what: "How the website appears in Google and when shared, plus redirects from old addresses." },
  "/admin/leads/reports": { what: "Charts of enquiries over time, by source, product and status." },
  "/admin/leads": { what: "Every enquiry, quote and demo request from the website, and its follow-up." },
  "/admin/approvals": { what: "Changes vendors and resellers asked for (new products, edits, offers). Nothing goes live until approved here." },
  "/admin/deletions": { what: "Deletions asked for by people without Delete permission. Approve or reject them." },
  "/admin/vendor-portal": { what: "What vendors and resellers can see and do in their portal." },
  "/admin/billing": { what: "Paid plans for vendors and resellers, and who's subscribed." },
  "/admin/settings/payments": { what: "Razorpay keys for plan payments." },
  "/admin/compliance": { what: "Privacy and compliance at a glance: what needs attention now." },
  "/admin/users/blocked": { what: "Networks and accounts blocked after too many wrong passwords. Unblock them here." },
  "/admin/users": { what: "Staff accounts: invite, change role, sign out of devices." },
  "/admin/roles": { what: "What each role can see and change." },
  "/admin/audit-log": { what: "Who changed what and when, across the whole admin." },
  "/admin/logs/errors": { what: "Errors on the website and admin. They resolve themselves when they stop happening." },
  "/admin/settings/email": { what: "The mail server, who gets alerts, and every email the website sends." },
  "/admin/settings": { what: "Company details, logo, labels, listing pages and other website-wide settings.", site: "/" },
  "/admin/integrations": { what: "Connections to other services: media storage, analytics IDs, webhooks." },
  "/admin/notifications": { what: "Which bell and email notifications you get." },
  "/admin/system/recycle-bin": { what: "Deleted items, restorable for a while before they're removed for good." },
  "/admin/system/backups": { what: "Download or restore a full copy of the website." },
  "/admin/system/deployment": { what: "How to put the website live, with live checks of this server." },
};
const KEYS = Object.keys(HELP).sort((a, b) => b.length - a.length);

export function helpFor(pathname: string, search?: string): AdminHelp | null {
  if (pathname === "/admin/settings" && search?.includes("tab=chat")) return { what: "The help chat button on the website: on or off, welcome message and quick buttons. Its answers come from your FAQs.", site: "/" };
  if (pathname === "/admin/settings" && search?.includes("tab=theme")) return { what: "The look of the website: design (Classic or Fresh Lime), colours, fonts and animations.", site: "/" };
  const key = KEYS.find((k) => (k === "/admin" ? pathname === "/admin" : pathname === k || pathname.startsWith(`${k}/`)));
  return key ? HELP[key]! : null;
}
