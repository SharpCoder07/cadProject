import { z } from "zod";
import { FONT_KEYS } from "@/lib/font-choices";
import { formsSettingSchema } from "@/lib/forms";
import { layoutsSettingSchema } from "@/lib/layouts";
import { TAXONOMIES, type TaxonomyKind } from "@/lib/taxonomies";
import { CURRENCIES } from "@/lib/format";

/**
 * Typed website settings. Each key is stored as one row in `Setting` and
 * validated on read and write. Defaults apply when a key is missing, so a
 * fresh database renders a complete site. NEVER put secrets in these schemas.
 */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour like #0F766E");
const optionalStr = (max = 300) => z.string().trim().max(max).default("");
const link = z.string().trim().max(300).refine((v) => v === "" || v.startsWith("/") || /^https?:\/\//.test(v), "Use /path or https:// URL").default("");

export const FONT_CHOICES = FONT_KEYS;

const showcaseList = (limit: number) =>
  z
    .object({
      mode: z.enum(["auto", "manual"]).default("auto"),
      /** Hidden: the section isn't shown at all. */
      hidden: z.boolean().default(false),
      limit: z.coerce.number().int().min(1).max(12).default(limit),
      items: z
        .array(z.object({ comparisonId: z.string().cuid(), label: z.string().trim().max(80).default("") }))
        .max(24)
        .default([]),
    })
    .default({});

export const settingSchemas = {
  site: z.object({
    name: z.string().trim().min(1).max(60).default("Cadgram"),
    /** Line under the company name in the admin sidebar. */
    adminLabel: z.string().trim().max(40).default("Admin workspace"),
    /** Name shown in the admin panel header only (branding pop-up). Empty = the site name. */
    adminName: z.string().trim().max(60).default(""),
    tagline: optionalStr(140).default("Find, compare and buy the right business software"),
    legalName: optionalStr(120).default("Cadgram Technologies Pvt. Ltd."),
    logoUrl: link,
    logoDarkUrl: link,
    faviconUrl: link,
    contactEmail: z.string().trim().email().or(z.literal("")).default("hello@cadgram.example"),
    salesEmail: z.string().trim().email().or(z.literal("")).default("sales@cadgram.example"),
    contactPhone: optionalStr(30).default("+91 80000 00000"),
    whatsappNumber: optionalStr(30).default("+91 80000 00001"),
    address: optionalStr(300).default("Bengaluru, Karnataka, India"),
    businessHours: optionalStr(120).default("Mon–Sat, 9:30 am – 7:00 pm IST"),
    social: z
      .object({ linkedin: link, x: link, facebook: link, instagram: link, youtube: link })
      .default({}),
  }),

  theme: z.object({
    primary: hex.default("#0F766E"),
    accent: hex.default("#F59E0B"),
    ink: hex.default("#111827"),
    background: hex.default("#F7F8FA"),
    surface: hex.default("#FFFFFF"),
    success: hex.default("#059669"),
    displayFont: z.enum(FONT_CHOICES).default("jakarta"),
    bodyFont: z.enum(FONT_CHOICES).default("jakarta"),
    radius: z.enum(["sharp", "soft", "round"]).default("soft"),
    headerStyle: z.enum(["standard", "compact"]).default("standard"),
    showAnnouncementBar: z.boolean().default(true),
    /**
     * Colour of standard announcements: Primary, Accent (e.g. Certinal's lime strip), or automatic: Accent when
     * the Primary colour is nearly black (it would look like a black bar), otherwise Primary.
     */
    announcementColor: z.enum(["auto", "primary", "accent"]).default("auto"),
    /** Website animations (app/motion.css): full, subtle (reveals and count-ups only) or off. */
    animations: z.enum(["full", "subtle", "off"]).default("full"),
    /** Whole-site design: classic, or "design1" (modelled on certinal.com, app/design1.css). */
    design: z.enum(["classic", "design1"]).default("classic"),
    footerNote: optionalStr(300).default("Prices are indicative and may exclude GST. Confirm final pricing with the vendor."),
  }),

  seo: z.object({
    titleTemplate: z.string().trim().max(80).default("%s | Cadgram").refine((v) => v.includes("%s"), "Include %s where the page title goes"),
    defaultTitle: z.string().trim().max(70).default("Cadgram — Compare business software in India"),
    defaultDescription: z
      .string()
      .trim()
      .max(170)
      .default("Compare prices, features and reviews of accounting, HR, CRM and other business software. Get free quotes and demos from verified vendors."),
    ogImageUrl: link,
    twitterHandle: optionalStr(30),
    allowIndexing: z.boolean().default(true),
    googleSiteVerification: optionalStr(100),
    bingSiteVerification: optionalStr(100),
  }),

  listing: z.object({
    perPage: z.number().int().min(6).max(48).default(18),
    defaultSort: z.enum(["relevance", "popular", "rating", "price_asc", "price_desc", "name", "newest"]).default("popular"),
    sponsoredFirst: z.boolean().default(true),
    filters: z
      .object({
        pricingModel: z.boolean().default(true),
        deployment: z.boolean().default(true),
        freeTrial: z.boolean().default(true),
        price: z.boolean().default(true),
        industry: z.boolean().default(true),
        rating: z.boolean().default(true),
        attributes: z.boolean().default(true),
      })
      .default({}),
    showVendorName: z.boolean().default(true),
    showStartingPrice: z.boolean().default(true),
    showRating: z.boolean().default(true),
    showCompareCheckbox: z.boolean().default(true),
  }),

  detail: z.object({
    sections: z
      .object({
        overview: z.boolean().default(true),
        features: z.boolean().default(true),
        screenshots: z.boolean().default(true),
        pricing: z.boolean().default(true),
        specifications: z.boolean().default(true),
        faqs: z.boolean().default(true),
        reviews: z.boolean().default(true),
        alternatives: z.boolean().default(true),
        vendor: z.boolean().default(true),
        relatedArticles: z.boolean().default(true),
      })
      .default({}),
    stickyEnquiryBar: z.boolean().default(true),
    showVendorContact: z.boolean().default(false),
  }),

  labels: z.object({
    enquireCta: z.string().trim().min(1).max(40).default("Get free quote"),
    demoCta: z.string().trim().min(1).max(40).default("Book a free demo"),
    compareCta: z.string().trim().min(1).max(40).default("Compare"),
    freeTrialBadge: z.string().trim().min(1).max(30).default("Free trial"),
    freeVersionBadge: z.string().trim().min(1).max(30).default("Free version"),
    sponsoredLabel: z.string().trim().min(1).max(30).default("Sponsored"),
    verifiedLabel: z.string().trim().min(1).max(30).default("Verified vendor"),
    leadFormTitle: z.string().trim().min(1).max(80).default("Get the best price and a free demo"),
    leadFormSubtitle: optionalStr(200).default("Our software advisors reply within one business day. No spam."),
    leadSuccess: z.string().trim().min(1).max(200).default("Thanks! An advisor will call you within one business day."),
    searchPlaceholder: z.string().trim().min(1).max(80).default("accounting, payroll, CRM…"),
    /** Example searches typed into the empty search bars (one per line). Empty = no typing, just the placeholder. */
    searchExamples: z.string().trim().max(800).default("payroll for 20 staff\nGST billing software\nCRM for small teams\nattendance app"),
    heroLead: z.string().trim().min(1).max(60).default("Search software, categories or brands"),
  }),

  leads: z.object({
    notifyEmails: z.array(z.string().email()).max(20).default([]),
    /** Email the vendor of the enquired product (its company email). */
    notifyVendor: z.boolean().default(true),
    /** Email every reseller of the enquired product. Masked until they have a plan. */
    notifyResellers: z.boolean().default(true),
    /** Email the sales addresses above for every new lead. */
    emailSalesOnNewLead: z.boolean().default(true),
    /** Email a staff member when a lead is assigned to them. */
    emailAssignee: z.boolean().default(true),
    /** Send the “Confirmation to the lead” email to the person who enquired. */
    emailConfirmation: z.boolean().default(false),
    autoAssign: z.enum(["none", "round_robin"]).default("none"),
    autoAssignRoleKey: z.string().default("SALES_MANAGER"),
    requireCompany: z.boolean().default(false),
    consentText: optionalStr(300).default("I agree to be contacted by Cadgram and relevant vendors about my requirement."),
    companySizes: z.array(z.string().max(40)).max(12).default(["1–10", "11–50", "51–200", "201–1000", "1000+"]),
  }),

  analytics: z.object({
    // Public measurement IDs only — these are embedded in pages by design.
    ga4MeasurementId: z.string().trim().regex(/^(G-[A-Z0-9]+)?$/, "Looks like G-XXXXXXX").default(""),
    gtmContainerId: z.string().trim().regex(/^(GTM-[A-Z0-9]+)?$/, "Looks like GTM-XXXXXX").default(""),
    metaPixelId: z.string().trim().regex(/^\d*$/, "Digits only").default(""),
    clarityProjectId: z.string().trim().regex(/^[a-z0-9]*$/, "Lowercase letters and digits").default(""),
  }),

  reviews: z.object({
    enabled: z.boolean().default(true),
    autoApprove: z.boolean().default(false),
    minBodyLength: z.number().int().min(20).max(2000).default(80),
  }),

  /** Abusive-word filter for everything people post (reviews, questions, enquiries, vendor text…). */
  moderation: z.object({
    blockWords: z.boolean().default(true),
    /** Extra words to block, one per line or comma separated; a trailing * blocks every ending. */
    extraWords: z.string().max(20_000).default(""),
    /** Words that must never be blocked (to fix false matches, e.g. a person's name). */
    allowedWords: z.string().max(5_000).default(""),
  }),

  /** Local landing pages: /{city}/{brand} and /{city}/{productRouteBase}/{product}. */
  geo: z.object({
    enabled: z.boolean().default(true),
    productRouteBase: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens").max(40).default("software"),
    /** Default text for sections a page leaves empty. Tokens: {{name}} {{city}} {{state}} {{country}} {{site_name}}. */
    template: z
      .object({
        hero: z.string().max(400).default("Buy {{name}} in {{city}} — genuine licences, local support and the best price."),
        introduction: z.string().max(4000).default("Looking for {{name}} in {{city}}? {{site_name}} helps businesses across {{city}}, {{state}} compare plans, get a free demo and buy genuine licences with GST invoices. Our advisors work with authorised partners near you for installation, training and renewals."),
        guide: z.string().max(6000).default("Before you buy {{name}} in {{city}}, list how many users need access, which features matter most and whether you prefer a subscription or a one-time licence. Ask for a demo with your own data, confirm what support is included locally, and check renewal pricing so there are no surprises next year."),
        faqs: z
          .array(z.object({ question: z.string().max(300), answer: z.string().max(2000) }))
          .max(20)
          .default([
            { question: "Where can I buy {{name}} in {{city}}?", answer: "Send an enquiry on this page. An advisor will share current pricing and connect you with an authorised partner serving {{city}}." },
            { question: "Do I get a GST invoice?", answer: "Yes. Purchases made through {{site_name}} partners come with a valid GST invoice for input tax credit." },
            { question: "Is installation and training available in {{city}}?", answer: "Most partners in {{city}} offer onsite or remote installation and training. Ask for it when you enquire." },
          ]),
      })
      .default({}),
  }),
  /** Numbers the site works by (Website settings › Business rules). Security limits (sign-in, passwords, two-step) are not here on purpose. */
  rules: z.object({
    /** Currency pre-selected on a new product. */
    defaultCurrency: z.enum(CURRENCIES).default("INR"),
    /** Letters before the lead reference number, e.g. CG-7K2M9Q. */
    leadReferencePrefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "1–6 letters or numbers").default("CG"),
    /** Days deleted items stay in the recycle bin. */
    binDays: z.number().int().min(1).max(365).default(30),
    /** Popularity points a product gains per enquiry (popularity orders “Most popular” lists). */
    enquiryPopularityPoints: z.number().int().min(0).max(100).default(5),
    /** Most enquiries / reviews / questions one visitor (network address) can send per hour. */
    leadsPerHour: z.number().int().min(1).max(200).default(6),
    reviewsPerHour: z.number().int().min(1).max(200).default(4),
    questionsPerHour: z.number().int().min(1).max(200).default(6),
    /** Spam filter: forms sent faster than this many seconds after opening are dropped silently. */
    spamMinSeconds: z.number().min(0).max(60).default(2.5),
    /** Spam filter: enquiries with more web links than this are dropped silently. */
    spamMaxLinks: z.number().int().min(0).max(50).default(2),
    search: z
      .object({
        /** 1–9: how loosely a misspelt name still matches (higher = stricter). */
        typoStrictness: z.number().int().min(1).max(9).default(3),
        /** Weight of a match in the product name. */
        nameWeight: z.number().min(0).max(20).default(2),
        /** Boost for products tagged with a matching classification. */
        classificationBoost: z.number().min(0).max(20).default(0.6),
        /** How much popularity lifts a result (0 = not at all). */
        popularityWeight: z.number().min(0).max(5).default(0.05),
      })
      .default({}),
  }),
  /** Wording and on/off for each classification list (Website settings › Classification lists). Empty wording = built-in. */
  taxonomies: z
    .object(
      Object.fromEntries(
        TAXONOMIES.map((t) => [
          t.kind,
          z
            .object({
              enabled: z.boolean().default(true),
              plural: z.string().trim().max(60).default(t.plural),
              singular: z.string().trim().max(60).default(t.singular),
              productLabel: z.string().trim().max(60).default(t.productLabel),
              headline: z.string().trim().max(120).default(t.headline),
              metaDescription: z.string().trim().max(300).default(t.metaDescription),
              help: z.string().trim().max(300).default(t.help),
            })
            .default({}),
        ]),
      ) as Record<TaxonomyKind, z.ZodDefault<z.ZodObject<{ enabled: z.ZodDefault<z.ZodBoolean>; plural: z.ZodDefault<z.ZodString>; singular: z.ZodDefault<z.ZodString>; productLabel: z.ZodDefault<z.ZodString>; headline: z.ZodDefault<z.ZodString>; metaDescription: z.ZodDefault<z.ZodString>; help: z.ZodDefault<z.ZodString> }>>>,
    )
    .default({}),
  /** Sections, their order and visibility on product, category, blog article, brand and vendor pages (Admin › Pages › Page layouts). */
  layouts: layoutsSettingSchema,
  /** Enquiry and partner forms set up in Admin › Pages › Forms (fields, wording, order). */
  forms: formsSettingSchema,
  /**
   * The two ready-made lists on the compare page (Admin › Comparisons › Compare page): automatic
   * (from popularity) or hand-picked published comparisons, in order, with an optional label.
   */
  compareShowcase: z
    .object({
      trending: showcaseList(4),
      byCategory: showcaseList(6),
    })
    .default({}),
  /**
   * Website edit mode (editing on the live pages). Only Super Admin and Admin can use it, and only
   * they can change this switch (see server/rbac/edit-mode.ts). Everyone else edits in the admin panel.
   */
  /** Design of single boxes / sections set in edit mode (lib/region-style.ts), by style key. */
  regionStyles: z
    .record(
      z.string().max(200),
      z.object({
        background: z.union([hex, z.literal("")]).optional(),
        surface: z.union([hex, z.literal("")]).optional(),
        text: z.union([hex, z.literal("")]).optional(),
        primary: z.union([hex, z.literal("")]).optional(),
        accent: z.union([hex, z.literal("")]).optional(),
        border: z.union([hex, z.literal("")]).optional(),
        displayFont: z.union([z.enum(FONT_CHOICES), z.literal("")]).optional(),
        bodyFont: z.union([z.enum(FONT_CHOICES), z.literal("")]).optional(),
      }),
    )
    .refine((o) => Object.keys(o).length <= 1000, "Too many styled sections")
    .default({}),
  editMode: z.object({
    /** UI Editor: editing on the live website pages. */
    enabled: z.boolean().default(true),
    /** Website sidebar editor: the admin menu as a sidebar on the website while editing. */
    sidebar: z.boolean().default(true),
  }),
  /**
   * Compliance & Privacy › Compliance settings. Timelines are deliberately empty by default: set them only after
   * confirming the applicable period with a lawyer (nothing here assumes a legal deadline).
   */
  compliance: z.object({
    legalEntityName: optionalStr(160),
    cin: optionalStr(40),
    gstin: optionalStr(20),
    registeredAddress: optionalStr(600),
    privacyEmail: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).default(""),
    privacyPhone: optionalStr(40),
    grievanceOfficerName: optionalStr(120),
    grievanceOfficerDesignation: optionalStr(120),
    grievanceOfficerEmail: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).default(""),
    grievanceOfficerPhone: optionalStr(40),
    grievanceOfficerAddress: optionalStr(600),
    grievanceHours: optionalStr(160),
    dpoName: optionalStr(120),
    dpoEmail: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).default(""),
    grievanceAckDays: z.number().int().min(1).max(365).optional(),
    grievanceResolveDays: z.number().int().min(1).max(365).optional(),
    dataRequestDays: z.number().int().min(1).max(365).optional(),
    incidentReportHours: z.number().int().min(1).max(8760).optional(),
    contentComplaintDays: z.number().int().min(1).max(365).optional(),
    applicabilityNotes: optionalStr(4000),
    legalReviewDone: z.boolean().default(false),
    legalReviewNote: optionalStr(1000),
    /** Shown with every consent given, so each record says which notice the person saw. Raise it when the privacy policy changes. */
    privacyNoticeVersion: z.string().trim().min(1).max(20).default("1.0"),
    /** Raise it when cookie categories or their purposes change: visitors are asked to choose again. */
    cookieNoticeVersion: z.string().trim().min(1).max(20).default("1.0"),
    cookieBannerEnabled: z.boolean().default(true),
    /** How long the browser remembers a visitor's cookie choice before asking again. */
    consentCookieDays: z.number().int().min(1).max(730).default(180),
  }),
  /** Admin › Logs › Error logs. */
  errorLogs: z.object({
    /** A pending error that hasn't happened again for this many hours is marked resolved automatically (0 = off). */
    autoResolveHours: z.number().int().min(0).max(720).default(24),
  }),
  /** Website wording changed in Admin › Pages › Website texts: key → text. Only changed entries are kept (defaults: lib/site-texts). */
  texts: z
    .record(z.string().max(120).regex(/^[a-zA-Z]+\.[a-zA-Z0-9_]+$/), z.string().max(4000))
    .refine((o) => Object.keys(o).length <= 3000, "Too many texts")
    .default({}),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };
export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  const result = settingSchemas[key].safeParse(value ?? {});
  // A corrupted stored value must never take the site down: fall back to defaults.
  return (result.success ? result.data : settingSchemas[key].parse({})) as Settings[K];
}

export const defaultSettings = (): Settings =>
  Object.fromEntries(SETTING_KEYS.map((k) => [k, settingSchemas[k].parse({})])) as Settings;
