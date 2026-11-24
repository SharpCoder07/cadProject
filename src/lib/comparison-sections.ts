import { z } from "zod";

/**
 * Content sections below a comparison's table (Admin › Comparisons). Pure data and schemas, safe in
 * client components. Stored as JSON on ComparisonPage.sections, in display order.
 */
const id = z.string().min(1).max(40);
const text = (max: number) => z.string().trim().max(max).default("");
const optionalUrl = z.string().trim().max(500).refine((v) => v === "" || /^(https?:\/\/|\/)/.test(v), "Use a full link (https://…) or a path starting with /").default("");

const base = { id, hidden: z.boolean().default(false) };

export const SIZE_UNITS = ["px", "%", "rem", "em", "vw", "ch", "pt", "cm", "mm", "in"] as const;
export type SizeUnit = (typeof SIZE_UNITS)[number];

/** The website's base text size (browser default; html has no font-size of its own). */
export const ROOT_FONT_PX = 16;

/**
 * Each unit: allowed range, how many pixels one unit is (null when it depends on the screen or the
 * column) and a short explanation for the editor's guide.
 */
export const UNIT_INFO: Record<SizeUnit, { min: number; max: number; px: number | null; label: string; note: string }> = {
  px: { min: 40, max: 2000, px: 1, label: "px — pixels", note: "Fixed size on every screen." },
  "%": { min: 5, max: 100, px: null, label: "% — of the content width", note: "50% = half the content area; grows and shrinks with it." },
  rem: { min: 2.5, max: 125, px: ROOT_FONT_PX, label: "rem — root text size", note: `1rem = ${ROOT_FONT_PX}px (the site's base text size).` },
  em: { min: 2.5, max: 125, px: ROOT_FONT_PX, label: "em — text size here", note: `1em = the text size around the image, ${ROOT_FONT_PX}px in these sections.` },
  vw: { min: 5, max: 100, px: null, label: "vw — of the screen width", note: "1vw = 1% of the visitor's screen width (100vw = whole screen)." },
  ch: { min: 5, max: 250, px: 8, label: "ch — character width", note: "1ch = width of the “0” character, about 8px here." },
  pt: { min: 30, max: 1500, px: 96 / 72, label: "pt — points", note: "1pt ≈ 1.33px (print unit: 72pt = 1 inch)." },
  cm: { min: 1, max: 53, px: 96 / 2.54, label: "cm — centimetres", note: "1cm ≈ 37.8px on screen." },
  mm: { min: 10, max: 530, px: 96 / 25.4, label: "mm — millimetres", note: "1mm ≈ 3.78px on screen." },
  in: { min: 0.5, max: 21, px: 96, label: "in — inches", note: "1in = 96px on screen." },
};
export const SIZE_LIMITS: Record<SizeUnit, { min: number; max: number }> = Object.fromEntries(SIZE_UNITS.map((u) => [u, { min: UNIT_INFO[u].min, max: UNIT_INFO[u].max }])) as Record<SizeUnit, { min: number; max: number }>;

/** Converts a width to another unit (approximately, through pixels); null when that can't be done. */
export function convertSize(value: number, from: SizeUnit, to: SizeUnit): number | null {
  const a = UNIT_INFO[from].px;
  const b = UNIT_INFO[to].px;
  if (!a || !b) return null;
  const v = (value * a) / b;
  return Math.round(v * (b >= 10 ? 100 : 1)) / (b >= 10 ? 100 : 1);
}

export const IMAGE_WIDTHS = ["small", "medium", "large", "full", "custom"] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];
/** Maximum width in pixels for each preset (full = the whole content column). */
export const IMAGE_WIDTH_PX: Record<Exclude<ImageWidth, "custom" | "full">, number> = { small: 320, medium: 560, large: 800 };
export const IMAGE_WIDTH_LABEL: Record<ImageWidth, string> = {
  small: "Small (320 px)",
  medium: "Medium (560 px)",
  large: "Large (800 px)",
  full: "Full width",
  custom: "Custom width…",
};

export const comparisonSection = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("HEADING"), heading: text(200), level: z.enum(["h2", "h3"]).default("h2"), subtext: text(400) }),
  z.object({ ...base, type: z.literal("TEXT"), heading: text(200), html: z.string().max(50_000).default("") }),
  z.object({
    ...base,
    type: z.literal("IMAGE"),
    heading: text(200),
    imageId: z.string().max(40).nullable().default(null),
    imageUrl: z.string().max(1000).nullable().default(null),
    alt: text(200),
    caption: text(300),
    /** Width: a number and its unit (px or % of the content column). Never wider than the column. */
    size: z.coerce.number().min(0.1).max(2000).nullable().default(null),
    unit: z.enum(SIZE_UNITS).default("px"),
    /** Older width presets, used only when no size is set. */
    width: z.enum(IMAGE_WIDTHS).default("large"),
    customWidth: z.coerce.number().int().min(80).max(1600).nullable().default(null),
    align: z.enum(["left", "center", "right"]).default("center"),
  }),
  z.object({ ...base, type: z.literal("VIDEO"), heading: text(200), url: z.string().trim().max(500).default(""), caption: text(300) }),
  z.object({
    ...base,
    type: z.literal("IMAGE_TEXT"),
    heading: text(200),
    html: z.string().max(50_000).default(""),
    imageId: z.string().max(40).nullable().default(null),
    imageUrl: z.string().max(1000).nullable().default(null),
    alt: text(200),
    imageSide: z.enum(["left", "right"]).default("right"),
    /** Picture width beside the text: a number and its unit (px, or % of the row). */
    size: z.coerce.number().min(0.1).max(2000).nullable().default(null),
    unit: z.enum(SIZE_UNITS).default("%"),
    /** Older setting, used only when no size is set. */
    imageSize: z.enum(["third", "half", "twoThirds"]).default("half"),
  }),
  z.object({ ...base, type: z.literal("FAQ"), heading: text(200), items: z.array(z.object({ q: text(300), a: z.string().max(5_000).default("") })).max(30).default([]) }),
  z.object({ ...base, type: z.literal("CTA"), heading: text(200), text: text(600), buttonLabel: text(60), buttonUrl: optionalUrl }),
]);

export type ComparisonSection = z.infer<typeof comparisonSection>;
export type ComparisonSectionType = ComparisonSection["type"];
export const comparisonSections = z.array(comparisonSection).max(30).default([]);

export const SECTION_META: Record<ComparisonSectionType, { label: string; description: string }> = {
  HEADING: { label: "Heading", description: "A section title with an optional line of text." },
  TEXT: { label: "Text", description: "Formatted text: paragraphs, lists, tables, links." },
  IMAGE: { label: "Image", description: "A picture with alt text and an optional caption." },
  VIDEO: { label: "Video", description: "A YouTube or Vimeo video." },
  IMAGE_TEXT: { label: "Image + text", description: "A picture beside formatted text." },
  FAQ: { label: "FAQs", description: "Questions and answers (also shown to Google as FAQ data)." },
  CTA: { label: "Call to action", description: "Heading, text and a button." },
};
export const SECTION_TYPES = Object.keys(SECTION_META) as ComparisonSectionType[];

const newId = () => Math.random().toString(36).slice(2, 10);

export function emptySection(type: ComparisonSectionType): ComparisonSection {
  return comparisonSection.parse({ id: newId(), type, ...(type === "IMAGE" ? { size: 800, unit: "px" } : type === "IMAGE_TEXT" ? { size: 50, unit: "%" } : {}) });
}

/** CSS max-width of an image section. */
export function imageMaxWidth(s: { size: number | null; unit: SizeUnit; width: ImageWidth; customWidth: number | null }): string | null {
  if (s.size) {
    const { min, max } = SIZE_LIMITS[s.unit];
    return `${Math.min(max, Math.max(min, s.size))}${s.unit}`;
  }
  if (s.width === "full") return null;
  return `${s.width === "custom" ? s.customWidth ?? IMAGE_WIDTH_PX.large : IMAGE_WIDTH_PX[s.width]}px`;
}

/** Reads stored JSON, dropping anything that no longer fits the schema. */
export function readSections(raw: unknown): ComparisonSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    const r = comparisonSection.safeParse(s);
    return r.success ? [r.data] : [];
  });
}

/** Picture width beside the text in an "Image + text" section (wide screens). */
export function sideImageWidth(s: { size: number | null; unit: SizeUnit; imageSize: "third" | "half" | "twoThirds" }): string {
  if (s.size) {
    const max = s.unit === "%" ? 80 : SIZE_LIMITS[s.unit].max;
    return `${Math.min(max, Math.max(SIZE_LIMITS[s.unit].min, s.size))}${s.unit}`;
  }
  return s.imageSize === "third" ? "33.333%" : s.imageSize === "twoThirds" ? "66.666%" : "50%";
}
