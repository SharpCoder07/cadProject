import type { BlockField } from "@/components/admin/blocks/block-fields";
import type { WidgetType } from "@/lib/blocks/free-layout";
import { ICON_NAMES } from "@/components/ui/icon";
import { FONTS } from "@/lib/font-choices";

/** Settings of each widget (Free layout editor). */
const ALIGN: BlockField = { name: "align", label: "Alignment", type: "select", options: [{ value: "left", label: "Left" }, { value: "center", label: "Centre" }, { value: "right", label: "Right" }] };

export const WIDGET_FIELDS: Record<WidgetType, BlockField[]> = {
  heading: [
    { name: "text", label: "Heading", type: "text" },
    { name: "level", label: "Size", type: "select", options: [{ value: "h2", label: "Large (H2)" }, { value: "h3", label: "Medium (H3)" }, { value: "h4", label: "Small (H4)" }], hint: "Use one large heading per section for good SEO." },
    ALIGN,
    { name: "link", label: "Link (optional)", type: "url", placeholder: "/categories/crm" },
  ],
  text: [{ name: "html", label: "Text", type: "rich" }, ALIGN],
  image: [
    { name: "src", label: "Image", type: "image" },
    { name: "alt", label: "Describe the image", type: "text", hint: "Read out by screen readers and used by Google." },
    { name: "width", label: "Width (% of the column)", type: "number", min: 10, max: 100 },
    { name: "rounded", label: "Rounded corners", type: "switch" },
    ALIGN,
    { name: "link", label: "Link (optional)", type: "url" },
  ],
  button: [
    { name: "label", label: "Button text", type: "text" },
    { name: "action", label: "When clicked", type: "select", options: [{ value: "enquire", label: "Open the enquiry form" }, { value: "link", label: "Go to a link" }] },
    { name: "href", label: "Link (for “Go to a link”)", type: "url", placeholder: "/compare or https://…" },
    { name: "newTab", label: "Open the link in a new tab", type: "switch" },
    { name: "style", label: "Style", type: "select", options: [{ value: "accent", label: "Button colour (filled)" }, { value: "primary", label: "Brand colour (filled)" }, { value: "outline", label: "Outline" }] },
    { name: "fullWidth", label: "Full width", type: "switch" },
    ALIGN,
  ],
  list: [
    { name: "items", label: "Points", type: "list", addLabel: "Add point", fields: [{ name: "text", label: "Text", type: "text" }] },
    { name: "icon", label: "Marker", type: "select", options: [{ value: "check", label: "Tick" }, { value: "dot", label: "Dot" }, { value: "arrow", label: "Arrow" }, { value: "number", label: "Numbers" }] },
  ],
  iconBox: [
    { name: "icon", label: "Icon", type: "select", options: ICON_NAMES.map((n) => ({ value: n, label: n })) },
    { name: "title", label: "Title", type: "text" },
    { name: "text", label: "Text", type: "textarea" },
    ALIGN,
  ],
  spacer: [{ name: "size", label: "Height (pixels)", type: "number", min: 4, max: 240 }],
  divider: [
    { name: "width", label: "Width (%)", type: "number", min: 10, max: 100 },
    { name: "thickness", label: "Thickness (pixels)", type: "number", min: 1, max: 8 },
  ],
  video: [
    { name: "url", label: "YouTube or Vimeo link", type: "url", placeholder: "https://www.youtube.com/watch?v=…" },
    { name: "title", label: "Title (for screen readers)", type: "text" },
  ],
  // A pasted section: its own settings (the section's usual form) are shown instead.
  section: [],
};

export const ROW_FIELDS: BlockField[] = [
  { name: "gap", label: "Space between columns", type: "select", options: [{ value: "none", label: "None" }, { value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }] },
  { name: "paddingY", label: "Space above and below", type: "select", options: [{ value: "none", label: "None" }, { value: "sm", label: "Small" }, { value: "md", label: "Medium" }, { value: "lg", label: "Large" }] },
  { name: "valign", label: "Line up columns", type: "select", options: [{ value: "top", label: "At the top" }, { value: "center", label: "In the middle" }, { value: "bottom", label: "At the bottom" }] },
  { name: "background", label: "Background colour", type: "color", hint: "Leave empty for none." },
  { name: "contained", label: "Keep within the page width", type: "switch", hint: "Off: the row runs edge to edge." },
];

// ── Stage 3: Style and Advanced tabs (same for widgets and rows) ───────────────────────────────
const PX = (name: string, label: string, min: number, max: number, hint?: string): BlockField => ({ name, label, type: "number", min, max, hint });
const opts = (pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

export const STYLE_GROUPS: { title: string; fields: BlockField[] }[] = [
  {
    title: "Typography",
    fields: [
      { name: "fontFamily", label: "Font", type: "select", options: [{ value: "", label: "Website default" }, ...FONTS.map((f) => ({ value: f.key, label: f.label }))] },
      PX("fontSize", "Size (px)", 8, 160),
      { name: "fontWeight", label: "Weight", type: "select", options: opts([["", "Default"], ["300", "Light"], ["400", "Regular"], ["500", "Medium"], ["600", "Semi-bold"], ["700", "Bold"], ["800", "Extra bold"], ["900", "Black"]]) },
      { name: "lineHeight", label: "Line height", type: "number", min: 0.8, max: 3, hint: "e.g. 1.5 (times the text size)" },
      PX("letterSpacing", "Letter spacing (px)", -5, 20),
      { name: "textTransform", label: "Capitals", type: "select", options: opts([["", "Default"], ["none", "As typed"], ["uppercase", "ALL CAPITALS"], ["capitalize", "Each Word Capital"], ["lowercase", "all small"]]) },
      { name: "textAlign", label: "Alignment", type: "select", options: opts([["", "Default"], ["left", "Left"], ["center", "Centre"], ["right", "Right"]]) },
    ],
  },
  {
    title: "Colours",
    fields: [
      { name: "textColor", label: "Text colour", type: "color" },
      { name: "buttonColor", label: "Button / brand colour", type: "color", hint: "Buttons, links and icons inside it." },
      { name: "buttonTextColor", label: "Button text colour", type: "color" },
    ],
  },
  {
    title: "Background",
    fields: [
      { name: "bgColor", label: "Background colour", type: "color" },
      { name: "bgImage", label: "Background image", type: "image" },
      { name: "bgSize", label: "Image fit", type: "select", options: opts([["", "Fill (cover)"], ["contain", "Whole image (contain)"], ["auto", "Original size"]]) },
    ],
  },
  {
    title: "Spacing",
    fields: [PX("paddingY", "Inner space top & bottom (px)", 0, 400), PX("paddingX", "Inner space left & right (px)", 0, 400), PX("marginTop", "Space above (px)", -200, 400), PX("marginBottom", "Space below (px)", -200, 400)],
  },
  {
    title: "Border & shadow",
    fields: [
      PX("borderWidth", "Border width (px)", 0, 20),
      { name: "borderColor", label: "Border colour", type: "color" },
      PX("borderRadius", "Rounded corners (px)", 0, 400),
      { name: "shadow", label: "Shadow", type: "select", options: opts([["", "Default"], ["none", "None"], ["sm", "Small"], ["md", "Medium"], ["lg", "Large"]]) },
    ],
  },
  { title: "Size", fields: [PX("maxWidth", "Maximum width (px)", 40, 2400, "Centred when narrower than its column."), PX("minHeight", "Minimum height (px)", 0, 2000)] },
];

export const ADVANCED_FIELDS: BlockField[] = [
  { name: "hideDesktop", label: "Hide on desktop", type: "switch" },
  { name: "hideTablet", label: "Hide on tablet", type: "switch" },
  { name: "hideMobile", label: "Hide on mobile", type: "switch" },
  { name: "anchor", label: "Anchor ID", type: "text", placeholder: "pricing", hint: "Lets a link jump here: /page#pricing. Letters, numbers, - and _." },
  { name: "cssClass", label: "CSS classes", type: "text", hint: "For developers: extra class names, separated by spaces." },
];
