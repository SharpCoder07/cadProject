import type { BlockField } from "@/components/admin/blocks/block-fields";
import type { SettingKey } from "@/server/settings/schemas";
import { FONTS } from "@/lib/font-choices";
import { TAXONOMIES } from "@/lib/taxonomies";
import { CURRENCIES } from "@/lib/format";

const fontOptions = FONTS.map((f) => ({ value: f.key, label: `${f.label} · ${f.group}` }));
const sw = (name: string, label: string, hint?: string): BlockField => ({ name, label, type: "switch", hint });

export const SETTINGS_TABS: { key: SettingKey; label: string; description: string; fields: BlockField[] }[] = [
  {
    key: "editMode", label: "Edit Mode",
    description: "Editing on the live website pages. Super Admin and Admin always can; other staff roles only with the “Edit on the website” permission in Admin › Roles, and then only for what their role can change. Only Super Admin and Admin see this setting.",
    fields: [
      sw("enabled", "UI Editor", "On: “Edit this page” in the website's admin bar — outlines, Edit buttons, click-to-type, Free layout, drafts and Publish. Off: nobody edits on the website, and all changes are made in the admin panel."),
      sw("sidebar", "Website sidebar editor", "On: while editing on the website, the admin menu shows as a sidebar on the left, and its screens open in the editor panel. Off: no sidebar (the admin bar and the editing tools stay)."),
    ],
  },
  {
    key: "site", label: "Company & contact", description: "Name, logo and contact details used across the site and in emails.",
    fields: [
      { name: "name", label: "Site name", type: "text", hint: "Used on the website, in page titles and in emails." },
      { name: "tagline", label: "Tagline", type: "text" },
      { name: "adminName", label: "Admin panel name", type: "text", placeholder: "Same as the site name", hint: "Shown only in the admin header. Leave empty to use the site name." },
      { name: "adminLabel", label: "Admin header label", type: "text", hint: "The line under the name in the admin header." },
      { name: "legalName", label: "Legal company name", type: "text", hint: "Shown in the footer copyright." },
      { name: "logoUrl", label: "Logo", type: "image", hint: "Leave empty to show the site name as text." },
      { name: "logoDarkUrl", label: "Logo for dark backgrounds", type: "image", hint: "Used in the dark footer. Leave empty to use the Cadgram logo for dark backgrounds." },
      { name: "faviconUrl", label: "Favicon", type: "image", hint: "Square PNG, 64 × 64 px or larger." },
      { name: "contactEmail", label: "Contact email", type: "text" },
      { name: "salesEmail", label: "Sales email", type: "text", placeholder: "sales@yourcompany.in", hint: "Optional. Leave empty to use the contact email." },
      { name: "contactPhone", label: "Phone", type: "phone", hint: "Shown in the header (“Talk to a software expert”), the footer and the Contact page." },
      { name: "whatsappNumber", label: "WhatsApp number", type: "phone", hint: "Optional. Opens a WhatsApp chat from the footer and Contact page." },
      { name: "address", label: "Address", type: "textarea" },
      { name: "businessHours", label: "Business hours", type: "text" },
      { name: "social", label: "Social links", type: "group", hint: "Optional. Icons appear in the footer only for the links you fill in.", fields: [
        { name: "linkedin", label: "LinkedIn", type: "url", placeholder: "https://www.linkedin.com/company/yourcompany" }, { name: "x", label: "X (Twitter)", type: "url", placeholder: "https://x.com/yourcompany" }, { name: "facebook", label: "Facebook", type: "url", placeholder: "https://www.facebook.com/yourcompany" },
        { name: "instagram", label: "Instagram", type: "url", placeholder: "https://www.instagram.com/yourcompany" }, { name: "youtube", label: "YouTube", type: "url", placeholder: "https://www.youtube.com/@yourcompany" },
      ] },
    ],
  },
  {
    key: "theme", label: "Design & theme", description: "Colours, fonts and corner style. The preview updates as you change them; Save to apply them to the whole site.",
    fields: [
      { name: "primary", label: "Primary colour", type: "color", hint: "Links, buttons, highlights." },
      { name: "accent", label: "Accent colour", type: "color", hint: "Enquiry buttons and badges. Use sparingly." },
      { name: "ink", label: "Text colour", type: "color" },
      { name: "background", label: "Page background", type: "color" },
      { name: "surface", label: "Card background", type: "color" },
      { name: "success", label: "Success colour", type: "color" },
      { name: "displayFont", label: "Heading font", type: "select", options: fontOptions },
      { name: "bodyFont", label: "Body font", type: "select", options: fontOptions },
      { name: "radius", label: "Corners", type: "select", options: [{ value: "sharp", label: "Sharp" }, { value: "soft", label: "Soft" }, { value: "round", label: "Round" }] },
      { name: "headerStyle", label: "Header height", type: "select", options: [{ value: "standard", label: "Standard" }, { value: "compact", label: "Compact" }] },
      { name: "announcementColor", label: "Announcement bar colour", type: "select", hint: "For standard announcements (promo and warning announcements keep their own colours).", options: [{ value: "auto", label: "Automatic (accent when the primary colour is nearly black)" }, { value: "primary", label: "Primary colour" }, { value: "accent", label: "Accent colour" }] },
      { name: "design", label: "Website design", type: "select", hint: "Classic, or Fresh Lime Design (white pages, lime buttons, green gradient accents, soft sections, light footer). Use a Fresh Lime Design button above (Lime or Teal) to set its colours and fonts too.", options: [{ value: "classic", label: "Classic" }, { value: "design1", label: "Fresh Lime Design" }] },
      { name: "animations", label: "Animations", type: "select", hint: "Scroll reveals, count-up numbers, glowing hero and buttons, logo marquee. Visitors who turn motion off on their device never see them.", options: [{ value: "full", label: "Full" }, { value: "subtle", label: "Subtle (reveals and numbers only)" }, { value: "off", label: "Off" }] },
      sw("showAnnouncementBar", "Show announcement bar", "Shows the first active announcement above the header."),
      { name: "footerNote", label: "Footer note", type: "textarea" },
    ],
  },
  {
    key: "listing", label: "Listing pages", description: "Category, search, industry and vendor listing pages.",
    fields: [
      { name: "perPage", label: "Products per page", type: "number", min: 6, max: 48 },
      { name: "defaultSort", label: "Default sort", type: "select", options: [{ value: "popular", label: "Most popular" }, { value: "rating", label: "Highest rated" }, { value: "price_asc", label: "Price: low to high" }, { value: "name", label: "Name" }, { value: "newest", label: "Newest" }] },
      sw("sponsoredFirst", "Show sponsored products first", "Applies to relevance, popularity and rating sorts."),
      sw("showVendorName", "Show vendor name"), sw("showStartingPrice", "Show starting price"), sw("showRating", "Show rating"), sw("showCompareCheckbox", "Show “Compare” checkbox"),
      { name: "filters", label: "Filters", type: "group", hint: "Turn whole filter groups on or off. Attribute filters are chosen per category.", fields: [
        sw("freeTrial", "Free trial / free version"), sw("pricingModel", "Pricing model"), sw("price", "Price range"), sw("deployment", "Deployment"), sw("rating", "Rating"), sw("industry", "Industry"), sw("attributes", "Attribute filters"),
      ] },
    ],
  },
  {
    key: "detail", label: "Product pages", description: "Options for every product page. Which sections show, and their order: Pages › Page layouts.",
    fields: [
      sw("stickyEnquiryBar", "Sticky enquiry bar on mobile"),
      sw("showVendorContact", "Show vendor phone number", "Off keeps enquiries flowing through your team."),
    ],
  },
  {
    key: "labels", label: "Labels & messages", description: "Button text and messages visitors see.",
    fields: [
      { name: "searchPlaceholder", label: "Search placeholder", type: "text" },
      { name: "searchExamples", label: "Search bar typing examples", type: "textarea", hint: "One example search per line. The empty search bars (header, homepage, search page) type these out one after another, then show the placeholder above when clicked. Leave empty to turn the typing off." },
      { name: "enquireCta", label: "Enquiry button", type: "text" },
      { name: "demoCta", label: "Demo button", type: "text" },
      { name: "compareCta", label: "Compare button", type: "text" },
      { name: "freeTrialBadge", label: "Free trial badge", type: "text" },
      { name: "freeVersionBadge", label: "Free version badge", type: "text" },
      { name: "sponsoredLabel", label: "Sponsored label", type: "text" },
      { name: "verifiedLabel", label: "Verified vendor label", type: "text" },
      { name: "leadFormTitle", label: "Enquiry form title", type: "text" },
      { name: "leadFormSubtitle", label: "Enquiry form subtitle", type: "textarea" },
      { name: "leadSuccess", label: "Enquiry success message", type: "textarea" },
    ],
  },
  {
    key: "leads", label: "Leads", description: "How enquiries are assigned and what the form asks. Email alerts for leads are in Settings → Email settings.",
    fields: [
      { name: "autoAssign", label: "Auto-assign new leads", type: "select", options: [{ value: "none", label: "Don’t assign" }, { value: "round_robin", label: "Round-robin between users of a role" }] },
      { name: "autoAssignRoleKey", label: "Role for round-robin", type: "text", hint: "Role key, e.g. SALES_MANAGER." },
      sw("requireCompany", "Require company name (only until the enquiry form is saved in Pages › Forms, which then decides)"),
      { name: "consentText", label: "Consent checkbox text", type: "textarea" },
      { name: "companySizes", label: "Company size options", type: "stringList", hint: "One per line. Used by the review form, and by the enquiry form’s Team size field unless it has its own options in Pages › Forms." },
    ],
  },
  {
    key: "rules", label: "Business rules", description: "The numbers the site works by. Sign-in limits, password rules and two-step verification are fixed for security and aren't here.",
    fields: [
      { name: "defaultCurrency", label: "Currency for new products", type: "select", options: CURRENCIES.map((c) => ({ value: c, label: c })), hint: "Pre-selected when you add a product; each product can still use another currency." },
      { name: "leadReferencePrefix", label: "Lead reference prefix", type: "text", hint: "The letters before every enquiry's reference number, e.g. CG gives CG-7K2M9Q. Only new enquiries use a new prefix." },
      { name: "binDays", label: "Days in the recycle bin", type: "number", min: 1, max: 365, hint: "How long deleted items can be restored. Applies to items deleted from now on." },
      { name: "enquiryPopularityPoints", label: "Popularity points per enquiry", type: "number", min: 0, max: 100, hint: "Each enquiry lifts the product in “Most popular” lists by this much. A page view adds 1." },
      { name: "leadsPerHour", label: "Enquiries allowed per visitor, per hour", type: "number", min: 1, max: 200 },
      { name: "reviewsPerHour", label: "Reviews allowed per visitor, per hour", type: "number", min: 1, max: 200 },
      { name: "questionsPerHour", label: "Questions allowed per visitor, per hour", type: "number", min: 1, max: 200 },
      { name: "spamMinSeconds", label: "Spam filter: fastest real enquiry (seconds)", type: "number", min: 0, max: 60, hint: "A form sent sooner than this after it opened is treated as a robot and quietly dropped. 0 turns this check off." },
      { name: "spamMaxLinks", label: "Spam filter: web links allowed in an enquiry", type: "number", min: 0, max: 50, hint: "Enquiries with more links than this are quietly dropped." },
      { name: "search", label: "Search ranking (“Most relevant”)", type: "group", fields: [
        { name: "typoStrictness", label: "Spelling strictness (1–9)", type: "number", min: 1, max: 9, hint: "Lower finds more products for misspelt names; higher shows only close matches. Default 3." },
        { name: "nameWeight", label: "Weight of a match in the product name", type: "number", min: 0, max: 20, hint: "Default 2." },
        { name: "classificationBoost", label: "Boost for a matching classification", type: "number", min: 0, max: 20, hint: "Products tagged with a use case, feature… that matches the search. Default 0.6." },
        { name: "popularityWeight", label: "Weight of popularity", type: "number", min: 0, max: 5, hint: "0 ignores popularity. Default 0.05." },
      ] },
    ],
  },
  {
    key: "taxonomies", label: "Classification lists", description: "Rename the classification lists, change their page wording, or switch a list off. In headings, {name} is the term (e.g. 2D Drafting) and {count} the number of products. Add or edit the terms themselves in Classifications.",
    fields: TAXONOMIES.map((t) => ({
      name: t.kind, label: `${t.plural} (/${t.path})`, type: "group" as const, fields: [
        sw("enabled", "Show on the website", "Off removes this list's pages, its links on product pages and its search suggestions. The terms are kept."),
        { name: "plural", label: "List name", type: "text" as const },
        { name: "singular", label: "Name for one", type: "text" as const },
        { name: "productLabel", label: "Label on product pages", type: "text" as const },
        { name: "headline", label: "Page heading", type: "text" as const, hint: "Use {name}. A term's own heading (if set) wins." },
        { name: "metaDescription", label: "Search engine description", type: "textarea" as const, hint: "Use {name} and {count}." },
        { name: "help", label: "Intro on the list page", type: "textarea" as const },
      ],
    })),
  },
  {
    key: "moderation", label: "Moderation", description: "Block abusive words in everything people post.",
    fields: [
      sw("blockWords", "Block abusive words", "Reviews, questions, answers, enquiries, sign-up names and vendor text are checked. 180 English, Hindi and Hinglish words are blocked by default."),
      { name: "extraWords", label: "Extra words to block", type: "textarea", hint: "One per line or comma separated. Add * at the end to block every ending, e.g. scam* blocks scammer and scamming." },
      { name: "allowedWords", label: "Always allow", type: "textarea", hint: "Words that must never be blocked, e.g. a real name that matches a blocked word." },
    ],
  },
  {
    key: "reviews", label: "Reviews", description: "Visitor reviews on product pages.",
    fields: [
      sw("enabled", "Accept reviews"),
      sw("autoApprove", "Publish without moderation", "Not recommended: reviews go live immediately."),
      { name: "minBodyLength", label: "Minimum review length (characters)", type: "number", min: 20, max: 2000 },
    ],
  },
];

export const SEO_FIELDS: BlockField[] = [
  // Ordered in pairs so the two-column form lines up.
  { name: "defaultTitle", label: "Homepage title", type: "text", hint: "Shown in Google for your homepage. Aim for 50–60 characters." },
  { name: "titleTemplate", label: "Title template", type: "text", hint: "%s is replaced by the page title, e.g. “%s | Cadgram”." },
  { name: "defaultDescription", label: "Default meta description", type: "textarea", hint: "Used when a page has no description of its own. Aim for 140–160 characters." },
  { name: "googleSiteVerification", label: "Google Search Console code", type: "text", hint: "Only the code inside content=\"…\" of the HTML tag." },
  { name: "bingSiteVerification", label: "Bing Webmaster code", type: "text", hint: "Only the code inside content=\"…\" of the meta tag." },
  { name: "twitterHandle", label: "X / Twitter handle", type: "text", placeholder: "@cadgram", hint: "Credited when pages are shared on X." },
  { name: "allowIndexing", label: "Allow search engines to index the site", type: "switch", hint: "Turn off on staging sites." },
  { name: "ogImageUrl", label: "Default social sharing image", type: "image", hint: "1200 × 630 px. Leave empty to use the automatic branded card." },
];

export const ANALYTICS_FIELDS: BlockField[] = [
  { name: "ga4MeasurementId", label: "Google Analytics 4 ID", type: "text", placeholder: "G-XXXXXXX" },
  { name: "gtmContainerId", label: "Google Tag Manager ID", type: "text", placeholder: "GTM-XXXXXX" },
  { name: "metaPixelId", label: "Meta Pixel ID", type: "text", placeholder: "123456789012345" },
  { name: "clarityProjectId", label: "Microsoft Clarity ID", type: "text", placeholder: "abcd1234ef" },
];
