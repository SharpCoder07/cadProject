/**
 * What each part of a website page opens in edit mode (see EditRegion). `live` = the tabs of the
 * in-place panel, each limited to what that part of the page actually shows (its own fields, its
 * wording, its buttons); `actions` = admin screens for what can't be edited in place.
 * Pure data, safe in any component.
 */
import type { LiveTarget } from "./live-edit-target";

export interface RegionAction { label: string; href: string }
/** layoutId: the section id in Page layouts (product, category, post pages): its tab gets move / hide. */
export type R = { label: string; actions: RegionAction[]; live?: LiveTarget[]; layoutId?: string };

/** Website texts of one group, only the given keys (prefix*). */
const W = (group: string, only: string[], title = "Wording"): LiveTarget => ({ kind: "texts", id: group, section: "texts", title, only });
const LABELS = (only: string[], title = "Buttons & labels"): LiveTarget => ({ kind: "labels", id: "labels", section: "all", title, only });
const SITE = (only: string[], title: string): LiveTarget => ({ kind: "site", id: "site", section: "all", title, only });
const THEME = (only: string[], title: string): LiveTarget => ({ kind: "theme", id: "theme", section: "all", title, only });
const layout = (page: string) => ({ label: "Show / hide / order", href: `/admin/cms/layouts?page=${page}` });

/** Product page sections (ids from lib/layouts.ts › product). */
export function productRegion(id: string, p: { id: string; name: string; vendorId: string | null }): R {
  const sw = (section: string, title: string, only?: string[]): LiveTarget => ({ kind: "software", id: p.id, section, title, ...(only ? { only } : {}) });
  const admin = (tab: string) => ({ label: "Open in admin", href: `/admin/software/${p.id}?tab=${tab}` });
  const map: Record<string, R> = {
    hero: { label: "Product header", live: [
      sw("hero", "Product"),
      W("product", ["product.by", "product.soldBy", "product.reviewCount*", "product.writeReview", "product.trending", "product.currentOffers", "product.offerEnds", "product.viewOffer", "product.claimOffer", "product.startingFrom", "product.inclGst", "product.exclGst", "product.visitWebsite", "product.perk*", "product.free", "product.priceOnRequest", "product.mediaLabel"]),
      LABELS(["enquireCta", "demoCta", "compareCta", "freeTrialBadge", "freeVersionBadge", "sponsoredLabel", "verifiedLabel"]),
    ], actions: [admin("basics")] },
    overview: { label: "Description", live: [sw("overview", "Description"), W("product", ["product.overview*", "product.tabOverview"])], actions: [admin("description"), layout("product")] },
    pricing: { label: "Pricing plans", live: [
      sw("pricing", "Pricing & plans"),
      W("product", ["product.pricing*", "product.tabPricing", "product.plan*", "product.prices*", "product.quote*", "product.freeTrial", "product.freeVersion", "product.available", "product.notAvailable", "product.askVendor", "product.startingPrice", "product.noTrial", "product.free", "product.priceOnRequest"]),
      LABELS(["enquireCta", "demoCta"]),
    ], actions: [admin("pricing"), layout("product")] },
    gallery: { label: "Screenshots & media", live: [sw("gallery", "Screenshots & media"), W("product", ["product.gallery*", "product.tabGallery", "product.mediaLabel"])], actions: [admin("media"), layout("product")] },
    features: { label: "Key features", live: [sw("features", "Features"), W("product", ["product.features*", "product.tabFeatures"])], actions: [admin("features"), layout("product")] },
    specifications: { label: "Specifications", live: [W("product", ["product.specs*", "product.spec*", "product.tabSpecifications"])], actions: [{ label: "Edit specifications", href: `/admin/software/${p.id}?tab=specs` }, { label: "Attributes", href: "/admin/attributes" }, layout("product")] },
    reviews: { label: "Reviews", live: [W("product", ["product.reviews*", "product.tabReviews", "product.recommendLabel", "product.overallScore", "product.basedOn*", "product.reviewBox*", "product.prosConsTitle", "product.buyersSay", "product.verifiedReviewer", "product.pros", "product.cons", "product.vendorReply", "product.theVendor", "product.moreReviews", "product.write*", "product.noReviews", "product.aspect*"])], actions: [{ label: "Moderate reviews", href: `/admin/reviews?q=${encodeURIComponent(p.name)}` }, { label: "Review settings", href: "/admin/settings?tab=reviews" }, layout("product")] },
    fit: { label: "Who should choose it", live: [sw("fit", "Best for / pros & cons"), W("product", ["product.fit*"])], actions: [admin("promotion"), layout("product")] },
    vendor: { label: "Company details", live: [sw("vendor", "Vendor & brand"), W("product", ["product.vendor*", "product.fact*", "product.employees"])], actions: [...(p.vendorId ? [{ label: "Edit vendor details", href: `/admin/vendors/${p.vendorId}` }] : []), layout("product")] },
    resellers: { label: "Authorised resellers", live: [W("product", ["product.resellers*", "product.tabResellers", "product.serves"])], actions: [{ label: "Edit resellers", href: "/admin/resellers" }, layout("product")] },
    compare: { label: "Compare with other software", live: [sw("compare", "Alternatives & related"), W("product", ["product.compare*", "product.tabCompare"])], actions: [{ label: "Comparisons", href: "/admin/comparisons" }, layout("product")] },
    faqs: { label: "FAQs", live: [sw("faqs", "FAQs"), W("product", ["product.faqs*", "product.tabFaqs"])], actions: [admin("faqs"), layout("product")] },
    questions: { label: "Questions & answers", live: [W("product", ["product.questions*", "product.tabQuestions", "product.askedBy", "product.answerFrom", "product.noQuestions"])], actions: [{ label: "Answer questions", href: "/admin/questions" }, layout("product")] },
    alternatives: { label: "Alternatives", live: [sw("alternatives", "Alternatives"), W("product", ["product.alternatives*", "product.tabAlternatives"])], actions: [admin("promotion"), layout("product")] },
    articles: { label: "Related articles", live: [W("product", ["product.articles*", "product.readArticle"])], actions: [{ label: "Blog posts", href: "/admin/blog" }, layout("product")] },
    enquire: { label: "Enquiry form", live: [W("product", ["product.expert*"]), LABELS(["leadFormTitle", "leadFormSubtitle", "leadSuccess", "enquireCta"], "Form title & messages")], actions: [{ label: "Form fields", href: "/admin/cms/forms?form=enquiry" }, layout("product")] },
    why: { label: "“A clearer way to evaluate software”", live: [W("product", ["product.why*"])], actions: [layout("product")] },
  };
  return { ...(map[id] ?? { label: id, actions: [admin("basics"), layout("product")] }), layoutId: id };
}

/** Category page sections (ids from lib/layouts.ts › category). */
export function categoryRegion(id: string, c: { id: string }): R {
  const cat = (section: string, title: string): LiveTarget => ({ kind: "category", id: c.id, section, title });
  const admin = (tab: string) => ({ label: "Open in admin", href: `/admin/categories/${c.id}?tab=${tab}` });
  const map: Record<string, R> = {
    hero: { label: "Category header", live: [cat("hero", "Category"), W("category", ["category.breadcrumbRoot", "category.eyebrow", "category.heading", "category.descriptionFallback", "category.chip*", "category.featured", "category.viewProduct", "category.tab*"])], actions: [admin("general")] },
    popular: { label: "Popular choices", live: [cat("popular", "Featured products"), W("category", ["category.popular*", "category.viewProduct"]), W("card", ["card.*"], "Product card wording")], actions: [admin("layout"), layout("category")] },
    directory: { label: "Product list & filters", live: [cat("directory", "List settings"), W("category", ["category.directory*", "category.searchIn", "category.filter*", "category.allPricing", "category.sort*", "category.trialFilter", "category.clear", "category.apply", "category.noMatch*", "category.clearAll", "category.noVendor", "category.viewDetails", "category.ad", "category.adCta", "category.quote*"]), W("card", ["card.*"], "Product card wording")], actions: [{ label: "Filters", href: `/admin/categories/${c.id}?tab=filters` }, layout("category")] },
    banner: { label: "“Find software that fits” banner", live: [cat("banner", "Banner"), W("category", ["category.fit*", "category.banner*", "category.stat*"])], actions: [{ label: "Banners", href: "/admin/cms/banners" }, layout("category")] },
    guidance: { label: "Buying guide", live: [cat("guidance", "Guide text"), W("category", ["category.guide*"])], actions: [admin("layout"), layout("category")] },
    cta: { label: "“Not sure which to pick?” strip", live: [W("category", ["category.cta*"])], actions: [layout("category")] },
    comparison: { label: "Price comparison table", live: [W("category", ["category.price*", "category.col*", "category.tableLink", "category.billing*", "category.notRated"])], actions: [{ label: "Products & plans", href: "/admin/software" }, layout("category")] },
    articles: { label: "Articles", live: [W("category", ["category.articles*"])], actions: [{ label: "Blog posts", href: "/admin/blog" }, layout("category")] },
    faqs: { label: "FAQs", live: [cat("faqs", "Show FAQs"), W("category", ["category.faq*", "category.quote*"])], actions: [layout("category")] },
    related: { label: "Related categories", live: [W("category", ["category.related*"])], actions: [{ label: "Categories", href: "/admin/categories" }, layout("category")] },
    helpBox: { label: "“Need help finding the right fit?”", live: [W("category", ["category.help*"])], actions: [layout("category")] },
    sideCategories: { label: "Other categories", live: [W("category", ["category.sideCategories"])], actions: [{ label: "Categories", href: "/admin/categories" }, layout("category")] },
  };
  return { ...(map[id] ?? { label: id, actions: [admin("general"), layout("category")] }), layoutId: id };
}

/** Blog article page parts (ids from lib/layouts.ts › post). */
export function postRegion(id: string, p: { id: string }): R {
  const admin = { label: "Open in admin", href: `/admin/blog/${p.id}` };
  const map: Record<string, R> = {
    tags: { label: "Tags", live: [{ kind: "post", id: p.id, section: "tags", title: "Tags" }], actions: [admin, layout("post")] },
    author: { label: "Author box", live: [W("post", ["post.writtenBy"])], actions: [{ label: "Edit authors", href: "/admin/blog/authors" }, layout("post")] },
    toc: { label: "On this page", live: [W("post", ["post.onThisPage"])], actions: [admin, layout("post")] },
    help: { label: "“Need help choosing?” card", live: [W("post", ["post.help*"])], actions: [layout("post")] },
    more: { label: "More from the same topic", live: [W("post", ["post.moreIn", "post.allArticles"])], actions: [{ label: "Blog categories", href: "/admin/blog/categories" }, layout("post")] },
  };
  return { ...(map[id] ?? { label: id, actions: [admin, layout("post")] }), layoutId: id };
}

/** The "Top software brands" logo strip at the bottom of the homepage hero (its own part). */
export function heroBrandsRegion(sectionId: string): R {
  return {
    label: "Top software brands",
    live: [
      { kind: "block", id: sectionId, section: "HERO", title: "Logo strip", only: ["showLogos", "logoBrandIds"] },
      W("home", ["home.brands*"]),
      { kind: "brands", id: "brands", section: "all", title: "Brands & logos" },
    ],
    actions: [],
  };
}

export const SITE_REGIONS = {
  announcement: {
    label: "Announcement bar",
    live: [W("header", ["header.announcementLink"]), THEME(["showAnnouncementBar"], "Show the bar")],
    actions: [{ label: "Announcements", href: "/admin/cms/announcements" }],
  },
  header: {
    label: "Header: logo, search & phone",
    live: [
      SITE(["name", "logoUrl", "contactPhone"], "Name, logo & phone"),
      W("header", ["header.skip", "header.searchPlaceholder", "header.expertLabel", "header.listSoftware*"]),
      LABELS(["searchPlaceholder"], "Search box"),
      THEME(["headerStyle"], "Header height"),
    ],
    actions: [],
  },
  menuBar: {
    label: "Menu bar",
    live: [W("header", ["header.categories", "header.menu", "header.mobileCategories", "header.categoryEmpty"]), LABELS(["enquireCta"], "Quote button")],
    actions: [{ label: "Menus", href: "/admin/cms/menus" }, { label: "Categories", href: "/admin/categories" }],
  },
  expert: {
    label: "“Need expert guidance?” & promises",
    live: [W("footer", ["footer.expert*", "footer.promise*"]), SITE(["contactPhone"], "Phone number"), LABELS(["enquireCta"], "Button")],
    actions: [],
  },
  footer: {
    label: "Footer",
    live: [
      SITE(["logoDarkUrl", "tagline", "name", "legalName", "contactEmail", "salesEmail", "whatsappNumber", "address", "social"], "Logo, contact & social links"),
      W("footer", ["footer.followUs", "footer.salesPrefix", "footer.whatsappPrefix", "footer.topCategories", "footer.softwareTitle", "footer.resourcesTitle", "footer.companyTitle", "footer.copyright"]),
      THEME(["footerNote"], "Footer note"),
    ],
    actions: [{ label: "Footer menus", href: "/admin/cms/menus" }],
  },
} satisfies Record<string, R>;

export const COMPARE_REGIONS = {
  hero: { label: "Compare page header", live: [W("compare", ["compare.breadcrumb", "compare.browse", "compare.eyebrow", "compare.heading", "compare.headingAccent", "compare.vs", "compare.lead", "compare.build"])], actions: [] },
  builder: { label: "Choose products", live: [W("comparePicker", ["comparePicker.*"])], actions: [] },
  table: { label: "Comparison table", live: [W("compareTable", ["compareTable.*"]), W("compare", ["compare.emptyTitle", "compare.emptyText", "compare.verdict"], "Empty state")], actions: [{ label: "Products", href: "/admin/software" }, { label: "Attributes shown", href: "/admin/attributes" }] },
  trending: { label: "Trending product comparisons", live: [W("compare", ["compare.trending*", "compare.compareButton"])], actions: [{ label: "Choose comparisons", href: "/admin/comparisons/showcase" }] },
  byCategory: { label: "Popular comparisons by category", live: [W("compare", ["compare.byCategory*", "compare.viewCategory", "compare.compareThese"])], actions: [{ label: "Choose comparisons", href: "/admin/comparisons/showcase" }] },
  popular: { label: "Popular comparisons", live: [W("compare", ["compare.popularTitle"])], actions: [{ label: "Edit comparisons", href: "/admin/comparisons" }] },
  guide: { label: "How to compare", live: [W("compare", ["compare.guide*"])], actions: [] },
  faq: { label: "Comparison FAQs", live: [W("compare", ["compare.faq*"])], actions: [] },
} satisfies Record<string, R>;
