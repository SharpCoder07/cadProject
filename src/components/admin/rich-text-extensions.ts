/**
 * Small editor extensions for the admin rich-text editor (no extra packages needed):
 * underline, highlight (with colour), text colour, font size, subscript, superscript, text alignment and images.
 * Everything they produce is on the allow-list in server/sanitize.ts.
 */
import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    underline: { toggleUnderline: () => ReturnType };
    highlight: { toggleHighlight: () => ReturnType; setHighlight: (color?: string | null) => ReturnType; unsetHighlight: () => ReturnType };
    textColor: { setTextColor: (color: string) => ReturnType; unsetTextColor: () => ReturnType };
    subscript: { toggleSubscript: () => ReturnType };
    superscript: { toggleSuperscript: () => ReturnType };
    textAlign: { setTextAlign: (align: Align) => ReturnType; unsetTextAlign: () => ReturnType };
    image: { setImage: (attrs: { src: string; alt?: string | null }) => ReturnType };
    fontSize: { setFontSize: (size: string) => ReturnType; unsetFontSize: () => ReturnType };
  }
}

export const Underline = Mark.create({
  name: "underline",
  parseHTML: () => [{ tag: "u" }, { style: "text-decoration", getAttrs: (v) => (typeof v === "string" && v.includes("underline") ? {} : false) }],
  renderHTML: ({ HTMLAttributes }) => ["u", mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return { toggleUnderline: () => ({ commands }) => commands.toggleMark(this.name) };
  },
  addKeyboardShortcuts() {
    return { "Mod-u": () => this.editor.commands.toggleUnderline() };
  },
});

/** Highlighted text, optionally in a chosen colour: <mark> or <mark style="background-color:#fde68a">. */
export const Highlight = Mark.create({
  name: "highlight",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.backgroundColor || null,
        renderHTML: (attrs) => (attrs.color ? { style: `background-color:${attrs.color}` } : {}),
      },
    };
  },
  parseHTML: () => [{ tag: "mark" }],
  renderHTML: ({ HTMLAttributes }) => ["mark", mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return {
      toggleHighlight: () => ({ commands }) => commands.toggleMark(this.name),
      setHighlight: (color) => ({ commands }) => commands.setMark(this.name, { color: color ?? null }),
      unsetHighlight: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { "Mod-Shift-h": () => this.editor.commands.toggleHighlight() };
  },
});

/** Text colour on a selection, saved as <span style="color:#0f766e">. */
export const TextColor = Mark.create({
  name: "textColor",
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.color || null,
        renderHTML: (attrs) => (attrs.color ? { style: `color:${attrs.color}` } : {}),
      },
    };
  },
  parseHTML: () => [{ tag: "span", getAttrs: (el) => ((el as HTMLElement).style.color ? {} : false) }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return {
      setTextColor: (color) => ({ commands }) => commands.setMark(this.name, { color }),
      unsetTextColor: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});

/** Colours offered in the editor's colour menus (any other colour can be picked too). */
export const TEXT_COLORS: { name: string; value: string }[] = [
  { name: "Black", value: "#111827" },
  { name: "Dark grey", value: "#374151" },
  { name: "Grey", value: "#6b7280" },
  { name: "Brand teal", value: "#0f766e" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Green", value: "#059669" },
  { name: "Lime", value: "#65a30d" },
  { name: "Amber", value: "#d97706" },
  { name: "Orange", value: "#ea580c" },
  { name: "Red", value: "#dc2626" },
  { name: "Rose", value: "#e11d48" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Brown", value: "#92400e" },
  { name: "White", value: "#ffffff" },
];
export const HIGHLIGHT_COLORS: { name: string; value: string }[] = [
  { name: "Yellow", value: "#fef08a" },
  { name: "Mint", value: "#ccfbf1" },
  { name: "Green", value: "#bbf7d0" },
  { name: "Blue-grey", value: "#e2e8f0" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Pink", value: "#fbcfe8" },
  { name: "Purple", value: "#e9d5ff" },
  { name: "Red", value: "#fecaca" },
];

export const Subscript = Mark.create({
  name: "subscript",
  excludes: "superscript",
  parseHTML: () => [{ tag: "sub" }],
  renderHTML: ({ HTMLAttributes }) => ["sub", mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return { toggleSubscript: () => ({ commands }) => commands.toggleMark(this.name) };
  },
});

export const Superscript = Mark.create({
  name: "superscript",
  excludes: "subscript",
  parseHTML: () => [{ tag: "sup" }],
  renderHTML: ({ HTMLAttributes }) => ["sup", mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return { toggleSuperscript: () => ({ commands }) => commands.toggleMark(this.name) };
  },
});

export type Align = "left" | "center" | "right" | "justify";
/** Classes the website already styles; kept in this list so Tailwind generates them. */
export const ALIGN_CLASS: Record<Align, string> = { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify" };
const CLASS_TO_ALIGN = Object.fromEntries(Object.entries(ALIGN_CLASS).map(([a, c]) => [c, a])) as Record<string, Align>;

/** Left / centre / right / justified paragraphs and headings, saved as a class (no inline styles). */
export const TextAlign = Extension.create({
  name: "textAlign",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          textAlign: {
            default: null,
            parseHTML: (el) => {
              for (const c of Array.from(el.classList)) if (CLASS_TO_ALIGN[c]) return CLASS_TO_ALIGN[c];
              const s = el.style.textAlign;
              return s === "center" || s === "right" || s === "justify" ? s : null;
            },
            renderHTML: (attrs) => (attrs.textAlign && attrs.textAlign !== "left" ? { class: ALIGN_CLASS[attrs.textAlign as Align] } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setTextAlign: (align) => ({ commands }) => ["paragraph", "heading"].map((t) => commands.updateAttributes(t, { textAlign: align === "left" ? null : align })).some(Boolean),
      unsetTextAlign: () => ({ commands }) => ["paragraph", "heading"].map((t) => commands.resetAttributes(t, "textAlign")).some(Boolean),
    };
  },
});

/** A picture from the media library (or a web address), with alt text. */
export const Image = Node.create({
  name: "image",
  group: "block",
  draggable: true,
  atom: true,
  addAttributes() {
    return { src: { default: null }, alt: { default: null } };
  },
  parseHTML: () => [{ tag: "img[src]" }],
  renderHTML: ({ HTMLAttributes }) => ["img", mergeAttributes(HTMLAttributes, { loading: "lazy" })],
  addCommands() {
    return { setImage: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }) };
  },
});

/** Font sizes offered in the editor's list (pixels); "Custom…" accepts any size in px, rem, em or %. */
export const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 44, 48, 56, 64, 72];
/** Custom sizes the server keeps: 6–200px, 0.5–12rem/em, 50–400%. */
export const SIZE_PATTERN = /^(\d{1,3}(\.\d{1,2})?)(px|rem|em|%)$/;
export function validFontSize(v: string): boolean {
  const m = SIZE_PATTERN.exec(v.trim());
  if (!m) return false;
  const n = Number(m[1]);
  return m[3] === "px" ? n >= 6 && n <= 200 : m[3] === "%" ? n >= 50 && n <= 400 : n >= 0.5 && n <= 12;
}

/** Exact text size on a selection, saved as <span style="font-size:18px">. */
export const FontSize = Mark.create({
  name: "fontSize",
  addAttributes() {
    return {
      size: {
        default: null,
        parseHTML: (el) => el.style.fontSize || null,
        renderHTML: (attrs) => (attrs.size ? { style: `font-size:${attrs.size}` } : {}),
      },
    };
  },
  parseHTML: () => [{ tag: "span", getAttrs: (el) => ((el as HTMLElement).style.fontSize ? {} : false) }],
  renderHTML: ({ HTMLAttributes }) => ["span", mergeAttributes(HTMLAttributes), 0],
  addCommands() {
    return {
      setFontSize: (size) => ({ commands }) => commands.setMark(this.name, { size }),
      unsetFontSize: () => ({ commands }) => commands.unsetMark(this.name),
    };
  },
});
