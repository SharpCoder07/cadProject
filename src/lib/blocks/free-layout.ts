import { z } from "zod";
import { advanced, responsiveStyle, type Advanced, type ResponsiveStyle } from "./free-layout-style";

/**
 * "Free layout" section (block type LAYOUT): an Elementor-style area built on the website in edit
 * mode — rows, each with 1–6 columns, each holding widgets (heading, text, image, button…) dragged
 * in from the Widgets panel. Pure data: schema, widget catalogue, defaults and helpers.
 */

const str = (max: number) => z.string().max(max).default("");
const href = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || v.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(v), "Use /path, https://, mailto: or tel:")
  .default("");
const align = z.enum(["left", "center", "right"]).default("left");
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/);

export const WIDGET_TYPES = ["heading", "text", "image", "button", "list", "iconBox", "spacer", "divider", "video", "section"] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export const widgetProps = {
  heading: z.object({ text: str(300).default("Your heading"), level: z.enum(["h2", "h3", "h4"]).default("h2"), align, link: href }),
  text: z.object({ html: str(20000).default("<p>Write something here.</p>"), align }),
  image: z.object({ src: href, alt: str(200), link: href, width: z.number().int().min(10).max(100).default(100), rounded: z.boolean().default(true), align: align.default("center") }),
  button: z.object({
    label: str(60).default("Get free quote"),
    action: z.enum(["link", "enquire"]).default("enquire"),
    href,
    style: z.enum(["accent", "primary", "outline"]).default("accent"),
    newTab: z.boolean().default(false),
    fullWidth: z.boolean().default(false),
    align,
  }),
  list: z.object({ items: z.array(z.object({ text: str(200) })).max(30).default([{ text: "First point" }, { text: "Second point" }, { text: "Third point" }]), icon: z.enum(["check", "dot", "arrow", "number"]).default("check") }),
  iconBox: z.object({ icon: str(40).default("verified"), title: str(120).default("Feature title"), text: str(400).default("A short sentence about this feature."), align: align.default("center") }),
  spacer: z.object({ size: z.number().int().min(4).max(240).default(32) }),
  divider: z.object({ width: z.number().int().min(10).max(100).default(100), thickness: z.number().int().min(1).max(8).default(1) }),
  video: z.object({ url: href, title: str(120).default("Video") }),
  /** A ready-made section copied from a page (Featured software, FAQ…), shown inside a column. Checked against its own block schema on save. */
  section: z.object({ blockType: z.string().regex(/^[A-Z_]{2,40}$/).default("CTA"), label: str(120), data: z.record(z.unknown()).default({}) }),
} satisfies Record<WidgetType, z.ZodTypeAny>;

export type WidgetProps<T extends WidgetType> = z.infer<(typeof widgetProps)[T]>;
export interface Widget { id: string; type: WidgetType; props: Record<string, unknown>; style?: ResponsiveStyle; adv?: Advanced }
export interface LayoutColumn { id: string; width: number; widgets: Widget[] }
export interface LayoutRow { id: string; columns: LayoutColumn[]; gap: "none" | "sm" | "md" | "lg"; valign: "top" | "center" | "bottom"; paddingY: "none" | "sm" | "md" | "lg"; background: string; contained: boolean; style?: ResponsiveStyle; adv?: Advanced }
export interface LayoutData { rows: LayoutRow[] }

const widget = z
  .object({ id, type: z.enum(WIDGET_TYPES), props: z.record(z.unknown()).default({}), style: responsiveStyle, adv: advanced })
  .transform((w) => {
    const parsed = widgetProps[w.type].safeParse(w.props);
    return { ...w, props: (parsed.success ? parsed.data : widgetProps[w.type].parse({})) as Record<string, unknown> };
  });
const column = z.object({ id, width: z.number().int().min(1).max(12).default(12), widgets: z.array(widget).max(40).default([]) });
const row = z.object({
  id,
  columns: z.array(column).min(1).max(6),
  gap: z.enum(["none", "sm", "md", "lg"]).default("md"),
  valign: z.enum(["top", "center", "bottom"]).default("top"),
  paddingY: z.enum(["none", "sm", "md", "lg"]).default("md"),
  background: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).default(""),
  contained: z.boolean().default(true),
  style: responsiveStyle,
  adv: advanced,
});

export const layoutSchema = z.object({
  rows: z
    .array(row)
    .max(30)
    .default([{ id: "r1", gap: "md", valign: "top", paddingY: "md", background: "", contained: true, columns: [{ id: "c1", width: 12, widgets: [{ id: "w1", type: "heading", props: { text: "Your heading", level: "h2", align: "left", link: "" } }, { id: "w2", type: "text", props: { html: "<p>Drag widgets from the Widgets panel into this area.</p>", align: "left" } }] }] }]),
});

/** Widgets panel: what can be dragged in. */
export const WIDGETS: { type: WidgetType; label: string; icon: string; hint: string }[] = [
  { type: "heading", label: "Heading", icon: "heading", hint: "A title" },
  { type: "text", label: "Text", icon: "text", hint: "Paragraphs, bold, links, lists" },
  { type: "image", label: "Image", icon: "image", hint: "Picture from the media library" },
  { type: "button", label: "Button", icon: "button", hint: "Link or enquiry form" },
  { type: "list", label: "List", icon: "list", hint: "Points with ticks" },
  { type: "iconBox", label: "Icon box", icon: "iconBox", hint: "Icon, title and text" },
  { type: "spacer", label: "Spacer", icon: "spacer", hint: "Empty space" },
  { type: "divider", label: "Divider", icon: "divider", hint: "A line" },
  { type: "video", label: "Video", icon: "video", hint: "YouTube or Vimeo" },
];

/** Column layouts for a row (widths out of 12). */
export const ROW_PRESETS: { label: string; widths: number[] }[] = [
  { label: "1 column", widths: [12] },
  { label: "2 equal", widths: [6, 6] },
  { label: "3 equal", widths: [4, 4, 4] },
  { label: "4 equal", widths: [3, 3, 3, 3] },
  { label: "2/3 + 1/3", widths: [8, 4] },
  { label: "1/3 + 2/3", widths: [4, 8] },
  { label: "1/4 + 3/4", widths: [3, 9] },
  { label: "3/4 + 1/4", widths: [9, 3] },
];

export const newId = (prefix: string) => `${prefix}${Math.random().toString(36).slice(2, 10)}`;
export const newWidget = (type: WidgetType): Widget => ({ id: newId("w"), type, props: widgetProps[type].parse({}) as Record<string, unknown> });
export const newRow = (widths: number[] = [12]): LayoutRow => ({ id: newId("r"), gap: "md", valign: "top", paddingY: "md", background: "", contained: true, columns: widths.map((w) => ({ id: newId("c"), width: w, widgets: [] })) });

/** Copies a widget / row with fresh ids (duplicate). */
export const cloneWidget = (w: Widget): Widget => ({ ...structuredClone(w), id: newId("w") });
export const cloneRow = (r: LayoutRow): LayoutRow => ({ ...structuredClone(r), id: newId("r"), columns: r.columns.map((c) => ({ ...c, id: newId("c"), widgets: c.widgets.map(cloneWidget) })) });

/** A section copied in edit mode ("Copy" on its tab), to paste into a Free layout. */
export interface ClipSection { blockType: string; label: string; data: Record<string, unknown> }

/**
 * What pasting a copied section adds: simple sections become normal widgets you can edit one by one
 * (text, call-to-action); a Free layout brings its rows; anything else (product lists, FAQs, deals…)
 * comes in whole as a "section" widget with its usual settings.
 */
export function clipToContent(clip: ClipSection): { widgets: Widget[] } | { rows: LayoutRow[] } {
  const d = clip.data;
  if (clip.blockType === "LAYOUT") {
    const rows = ((d.rows as LayoutRow[]) ?? []).map(cloneRow);
    return { rows };
  }
  if (clip.blockType === "RICH_TEXT") return { widgets: [{ id: newId("w"), type: "text", props: { html: String(d.html ?? ""), align: "left" } }] };
  if (clip.blockType === "CTA") {
    const out: Widget[] = [];
    if (d.heading) out.push({ id: newId("w"), type: "heading", props: { text: String(d.heading), level: "h2", align: "center", link: "" } });
    if (d.body) out.push({ id: newId("w"), type: "text", props: { html: `<p>${escapeHtml(String(d.body))}</p>`, align: "center" } });
    if (d.primaryLabel) out.push({ id: newId("w"), type: "button", props: { label: String(d.primaryLabel), action: d.openLeadForm ? "enquire" : "link", href: String(d.primaryHref ?? ""), style: "accent", newTab: false, fullWidth: false, align: "center" } });
    if (d.secondaryLabel) out.push({ id: newId("w"), type: "button", props: { label: String(d.secondaryLabel), action: "link", href: String(d.secondaryHref ?? ""), style: "outline", newTab: false, fullWidth: false, align: "center" } });
    return { widgets: out };
  }
  return { widgets: [{ id: newId("w"), type: "section", props: { blockType: clip.blockType, label: clip.label, data: structuredClone(d) } }] };
}

const escapeHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
