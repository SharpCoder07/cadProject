/**
 * Page layouts set in Admin › Pages › Page layouts: which sections show on the product, category,
 * blog article, brand and vendor pages, and in what order. Saved as settings key `layouts`
 * ({ page: [{ id, visible }] } in display order). A section can only move inside its own area (zone).
 */
import { z } from "zod";

export interface LayoutSection {
  id: string;
  label: string;
  hint?: string;
  /** Can't be switched off (the page needs it). */
  required?: boolean;
}
export interface LayoutZone {
  id: string;
  label: string;
  /** Sections keep their order here; only show/hide. */
  fixedOrder?: boolean;
  sections: LayoutSection[];
}
export interface LayoutPage { label: string; url: string; description: string; zones: LayoutZone[] }

export const LAYOUT_PAGES = {
  product: {
    label: "Product page",
    url: "/software",
    description: "Every product page. The top card (logo, name, price, buttons), the trust strip and the section tabs stay at the top; the tabs follow the order below.",
    zones: [
      {
        id: "main",
        label: "Sections",
        sections: [
          { id: "overview", label: "What is … (description)" },
          { id: "pricing", label: "Pricing plans" },
          { id: "gallery", label: "Screenshots, videos and documents" },
          { id: "features", label: "Key features" },
          { id: "specifications", label: "Product specifications", hint: "Includes your Attributes & filters values" },
          { id: "reviews", label: "Reviews, pros and cons" },
          { id: "fit", label: "Who should choose it (best for / not ideal for)" },
          { id: "vendor", label: "Company details" },
          { id: "resellers", label: "Authorised resellers" },
          { id: "compare", label: "Compare with other software" },
          { id: "faqs", label: "FAQs" },
          { id: "questions", label: "Questions and answers (community)" },
          { id: "alternatives", label: "Alternatives" },
          { id: "articles", label: "Related articles" },
          { id: "enquire", label: "“Get expert guidance” enquiry form" },
          { id: "why", label: "“A clearer way to evaluate software” box" },
        ],
      },
    ],
  },
  category: {
    label: "Category page",
    url: "/categories",
    description: "Every category page. The header with the category name stays at the top. Switches on each category (Page layout tab) can still hide its popular choices, guide and FAQs.",
    zones: [
      {
        id: "main",
        label: "Sections",
        sections: [
          { id: "popular", label: "Popular choices" },
          { id: "directory", label: "Product list with filters", required: true },
          { id: "banner", label: "“Find software that fits” banner" },
          { id: "guidance", label: "Buying guide (the category's text)" },
          { id: "cta", label: "“Not sure which … to pick?” strip" },
          { id: "comparison", label: "Price comparison table" },
          { id: "articles", label: "Articles" },
          { id: "faqs", label: "FAQs" },
          { id: "related", label: "Related categories" },
        ],
      },
      {
        id: "sidebar",
        label: "Sidebar next to the product list",
        sections: [
          { id: "helpBox", label: "“Need help finding the right fit?” box" },
          { id: "sideCategories", label: "Other categories" },
        ],
      },
    ],
  },
  post: {
    label: "Blog article",
    url: "/blog",
    description: "Every blog article. The title, author and date stay at the top, and the article text always shows.",
    zones: [
      { id: "top", label: "Top of the article", fixedOrder: true, sections: [{ id: "cover", label: "Cover image" }] },
      {
        id: "end",
        label: "End of the article card",
        sections: [
          { id: "tags", label: "Tags" },
          { id: "author", label: "“Written by” author box" },
        ],
      },
      { id: "below", label: "Under the article card", fixedOrder: true, sections: [{ id: "mentioned", label: "Software mentioned" }] },
      {
        id: "sidebar",
        label: "Sidebar",
        sections: [
          { id: "toc", label: "On this page (contents)" },
          { id: "help", label: "“Need help choosing?” card" },
          { id: "more", label: "More from the same topic" },
        ],
      },
      { id: "bottom", label: "Below the article", fixedOrder: true, sections: [{ id: "keepReading", label: "“You might also like”" }] },
    ],
  },
  brand: {
    label: "Brand page",
    url: "/brands",
    description: "Every brand page (/brands/…). The brand name and its products always show.",
    zones: [
      {
        id: "header",
        label: "Header",
        fixedOrder: true,
        sections: [
          { id: "logo", label: "Logo" },
          { id: "count", label: "Number of products" },
          { id: "company", label: "“By” company link" },
          { id: "website", label: "Website link" },
          { id: "description", label: "Description" },
          { id: "enquire", label: "Enquiry button" },
        ],
      },
      { id: "main", label: "Below the header", fixedOrder: true, sections: [{ id: "productsTitle", label: "“… software” heading above the products" }] },
    ],
  },
  vendor: {
    label: "Vendor page",
    url: "/vendors",
    description: "Every vendor page (/vendors/…). The company name and its products always show.",
    zones: [
      {
        id: "header",
        label: "Header",
        fixedOrder: true,
        sections: [
          { id: "logo", label: "Logo" },
          { id: "verified", label: "Verified badge" },
          { id: "location", label: "City and country" },
          { id: "founded", label: "Year founded" },
          { id: "employees", label: "Number of employees" },
          { id: "website", label: "Website link" },
        ],
      },
      {
        id: "main",
        label: "Below the header",
        fixedOrder: true,
        sections: [
          { id: "description", label: "Description" },
          { id: "productsTitle", label: "“… products” heading above the products" },
        ],
      },
    ],
  },
} satisfies Record<string, LayoutPage>;

export type LayoutPageKey = keyof typeof LAYOUT_PAGES;
export const LAYOUT_KEYS = Object.keys(LAYOUT_PAGES) as LayoutPageKey[];

const entry = z.object({ id: z.string().max(40), visible: z.boolean() });
export const layoutsSettingSchema = z
  .object(Object.fromEntries(LAYOUT_KEYS.map((k) => [k, z.array(entry).max(60).optional()])) as Record<LayoutPageKey, z.ZodOptional<z.ZodArray<typeof entry>>>)
  .default({});
export type LayoutsSetting = z.infer<typeof layoutsSettingSchema>;
export type LayoutEntry = z.infer<typeof entry>;

/**
 * The page's sections in display order with their visibility: the saved order, unknown ids dropped,
 * new sections added where they belong, required ones always on, and each zone's own order kept
 * for zones that can't be reordered. `defaults` sets visibility for sections that were never saved.
 */
export function resolveLayout(page: LayoutPageKey, saved: LayoutEntry[] | undefined, defaults: Record<string, boolean> = {}): LayoutEntry[] {
  const zones: LayoutZone[] = LAYOUT_PAGES[page].zones;
  const known = new Map(zones.flatMap((z) => z.sections.map((s) => [s.id, { zone: z, section: s }] as const)));
  const savedVis = new Map((saved ?? []).filter((e) => known.has(e.id)).map((e) => [e.id, e.visible]));
  const out: LayoutEntry[] = [];
  for (const z of zones) {
    const ids = z.sections.map((s) => s.id);
    // Saved order first; a section that was never saved goes right after the one before it by default.
    let ordered = ids;
    if (!z.fixedOrder) {
      ordered = (saved ?? []).map((e) => e.id).filter((id) => ids.includes(id));
      ordered = [...new Set(ordered)];
      ids.forEach((id, i) => {
        if (ordered.includes(id)) return;
        const prev = i > 0 ? ordered.indexOf(ids[i - 1]!) : -1;
        ordered.splice(prev + 1, 0, id);
      });
    }
    for (const id of ordered) {
      const s = known.get(id)!.section;
      out.push({ id, visible: s.required ? true : (savedVis.get(id) ?? defaults[id] ?? true) });
    }
  }
  return out;
}

/** What a page needs: is a section on, and a zone's sections in order. */
export function pageLayout(page: LayoutPageKey, saved: LayoutEntry[] | undefined, defaults?: Record<string, boolean>) {
  const list = resolveLayout(page, saved, defaults);
  const on = new Set(list.filter((e) => e.visible).map((e) => e.id));
  const zoneOf = new Map(LAYOUT_PAGES[page].zones.flatMap((z: LayoutZone) => z.sections.map((s) => [s.id, z.id] as const)));
  return {
    show: (id: string) => on.has(id),
    /** Visible section ids of one zone, in display order. */
    order: (zone: string) => list.filter((e) => e.visible && zoneOf.get(e.id) === zone).map((e) => e.id),
    /** Position for sorting things like section tabs (hidden = end). */
    rank: (id: string) => {
      const i = list.findIndex((e) => e.id === id);
      return i < 0 ? 999 : i;
    },
  };
}

/** One section of a page layout, as website edit mode shows it (plain data, sent to the browser). */
export interface EditLayoutItem {
  id: string;
  label: string;
  visible: boolean;
  zone: string;
  zoneLabel: string;
  /** Can't be hidden (the page needs it). */
  required: boolean;
  /** Can move up/down inside its zone. */
  movable: boolean;
}
export interface EditLayout { page: LayoutPageKey; title: string; items: EditLayoutItem[] }

/** The layout of a page type for website edit mode: every section (hidden ones too), in order. */
export function layoutForEdit(page: LayoutPageKey, saved: LayoutEntry[] | undefined, defaults?: Record<string, boolean>): EditLayout {
  const zones: LayoutZone[] = LAYOUT_PAGES[page].zones;
  const info = new Map(zones.flatMap((z) => z.sections.map((s) => [s.id, { z, s }] as const)));
  return {
    page,
    title: LAYOUT_PAGES[page].label,
    items: resolveLayout(page, saved, defaults).map((e) => {
      const { z, s } = info.get(e.id)!;
      return { id: e.id, label: s.label, visible: e.visible, zone: z.id, zoneLabel: z.label, required: Boolean(s.required), movable: !z.fixedOrder && z.sections.length > 1 };
    }),
  };
}
