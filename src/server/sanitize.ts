import "server-only";
import sanitizeHtml from "sanitize-html";

const ALIGN = ["text-left", "text-center", "text-right", "text-justify"];
const HEX = /^#[0-9a-f]{3,8}$/i;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/i;

/** Allow-list for rich text produced by the admin editor. Applied on save. */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "code", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6", "span", "hr", "table", "thead", "tbody", "tr", "th", "td", "img", "figure", "figcaption", "mark", "sub", "sup", "colgroup", "col",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height", "loading"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
    p: ["class"], h1: ["class"], h2: ["class"], h3: ["class"], h4: ["class"], h5: ["class"], h6: ["class"],
    span: ["style"],
    mark: ["style"],
  },
  // Text alignment from the editor is saved as one of these classes (no inline styles).
  allowedClasses: { p: ALIGN, h1: ALIGN, h2: ALIGN, h3: ALIGN, h4: ALIGN, h5: ALIGN, h6: ALIGN },
  // Font size and colours from the editor: only these simple values are kept (no other CSS).
  allowedStyles: {
    span: { "font-size": [/^\d{1,3}(\.\d{1,2})?(px|rem|em|%)$/], color: [HEX, RGB] },
    mark: { "background-color": [HEX, RGB] },
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["https", "http"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//i.test(attribs.href ?? "");
      return { tagName, attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } : attribs };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};

export const sanitizeRichText = (html: string | null | undefined): string | null => {
  if (!html) return null;
  const clean = sanitizeHtml(html, OPTIONS).trim();
  return clean === "" || clean === "<p></p>" ? null : clean;
};

/** Plain text only (FAQ answers, review bodies). */
export const sanitizePlain = (text: string) => sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }).trim();
