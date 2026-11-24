import { z } from "zod";
import { FONT_KEYS } from "@/lib/font-choices";

/**
 * Free layout, stage 3: Style and Advanced settings of each widget and row, per device (Elementor's
 * Style / Advanced tabs). Desktop is the base; Tablet and Mobile only hold what differs (empty =
 * same as the bigger screen). Turned into CSS scoped to the widget / row (layoutCss). Pure.
 */

const num = (min: number, max: number) => z.number().min(min).max(max).optional().catch(undefined);
const hex = z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).optional().catch(undefined);
const url = z
  .string()
  .max(500)
  .refine((v) => v === "" || v.startsWith("/") || /^https:\/\//i.test(v))
  .optional()
  .catch(undefined);

export const styleSet = z.object({
  // Typography
  fontFamily: z.union([z.enum(FONT_KEYS), z.literal("")]).optional().catch(undefined),
  fontSize: num(8, 160),
  fontWeight: z.enum(["", "300", "400", "500", "600", "700", "800", "900"]).optional().catch(undefined),
  lineHeight: num(0.8, 3),
  letterSpacing: num(-5, 20),
  textTransform: z.enum(["", "none", "uppercase", "lowercase", "capitalize"]).optional().catch(undefined),
  textAlign: z.enum(["", "left", "center", "right"]).optional().catch(undefined),
  // Colours
  textColor: hex,
  buttonColor: hex,
  buttonTextColor: hex,
  // Background
  bgColor: hex,
  bgImage: url,
  bgSize: z.enum(["", "cover", "contain", "auto"]).optional().catch(undefined),
  // Spacing (pixels)
  paddingY: num(0, 400),
  paddingX: num(0, 400),
  marginTop: num(-200, 400),
  marginBottom: num(-200, 400),
  // Border & shadow
  borderWidth: num(0, 20),
  borderColor: hex,
  borderRadius: num(0, 400),
  shadow: z.enum(["", "none", "sm", "md", "lg"]).optional().catch(undefined),
  // Size
  maxWidth: num(40, 2400),
  minHeight: num(0, 2000),
});
export type StyleSet = z.infer<typeof styleSet>;

export const DEVICES = ["desktop", "tablet", "mobile"] as const;
export type Device = (typeof DEVICES)[number];

export const responsiveStyle = z
  .object({ desktop: styleSet.default({}), tablet: styleSet.optional().catch(undefined), mobile: styleSet.optional().catch(undefined) })
  .optional()
  .catch(undefined);
export type ResponsiveStyle = z.infer<typeof responsiveStyle>;

export const advanced = z
  .object({
    hideDesktop: z.boolean().optional().catch(undefined),
    hideTablet: z.boolean().optional().catch(undefined),
    hideMobile: z.boolean().optional().catch(undefined),
    /** id="…" so a link can jump to it (#pricing). */
    anchor: z.string().regex(/^$|^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/).optional().catch(undefined),
    /** Extra CSS class names for your own stylesheet. */
    cssClass: z.string().regex(/^$|^[a-zA-Z0-9_ -]{1,120}$/).optional().catch(undefined),
  })
  .optional()
  .catch(undefined);
export type Advanced = z.infer<typeof advanced>;

// ── CSS ────────────────────────────────────────────────────────────────────────────────────────
const MEDIA: Record<Device, string | null> = { desktop: null, tablet: "(max-width: 1023px)", mobile: "(max-width: 767px)" };
const ONLY: Record<Device, string> = { desktop: "(min-width: 1024px)", tablet: "(min-width: 768px) and (max-width: 1023px)", mobile: "(max-width: 767px)" };
const SHADOW = { none: "none", sm: "0 2px 8px -2px rgb(0 0 0 / .15)", md: "0 12px 28px -12px rgb(0 0 0 / .25)", lg: "0 28px 60px -24px rgb(0 0 0 / .35)" } as const;
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
const cssUrl = (u: string) => `url("${u.replace(/["\\<>\n\r()]/g, (c) => encodeURIComponent(c))}")`;
const ok = (v: unknown): v is string => typeof v === "string" && v !== "";
const has = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function rules(sel: string, s: StyleSet | undefined): string {
  if (!s) return "";
  const self: string[] = [];
  const all: string[] = []; // on everything inside (beats the widget's own sizes)
  if (ok(s.fontFamily)) self.push(`--font-display:var(--f-${s.fontFamily})`, `--font-body:var(--f-${s.fontFamily})`, `font-family:var(--f-${s.fontFamily})`), all.push(`font-family:var(--f-${s.fontFamily})`);
  if (has(s.fontSize)) all.push(`font-size:${s.fontSize}px`);
  if (ok(s.fontWeight)) all.push(`font-weight:${s.fontWeight}`);
  if (has(s.lineHeight)) all.push(`line-height:${s.lineHeight}`);
  if (has(s.letterSpacing)) all.push(`letter-spacing:${s.letterSpacing}px`);
  if (ok(s.textTransform)) all.push(`text-transform:${s.textTransform}`);
  if (ok(s.textAlign)) self.push(`text-align:${s.textAlign}`), all.push(`text-align:${s.textAlign}`);
  if (ok(s.textColor)) self.push(`--color-ink:${rgb(s.textColor)}`, `--color-muted:${rgb(s.textColor)}`, `color:${s.textColor}`);
  if (ok(s.buttonColor)) self.push(`--color-accent:${rgb(s.buttonColor)}`, `--color-primary:${rgb(s.buttonColor)}`, `--color-action:${rgb(s.buttonColor)}`);
  if (ok(s.buttonTextColor)) self.push(`--color-accent-fg:${rgb(s.buttonTextColor)}`, `--color-primary-fg:${rgb(s.buttonTextColor)}`, `--color-action-fg:${rgb(s.buttonTextColor)}`);
  if (ok(s.bgColor)) self.push(`background-color:${s.bgColor}`);
  if (ok(s.bgImage)) self.push(`background-image:${cssUrl(s.bgImage)}`, `background-size:${ok(s.bgSize) ? s.bgSize : "cover"}`, "background-position:center", "background-repeat:no-repeat");
  else if (ok(s.bgSize)) self.push(`background-size:${s.bgSize}`);
  if (has(s.paddingY)) self.push(`padding-top:${s.paddingY}px`, `padding-bottom:${s.paddingY}px`);
  if (has(s.paddingX)) self.push(`padding-left:${s.paddingX}px`, `padding-right:${s.paddingX}px`);
  if (has(s.marginTop)) self.push(`margin-top:${s.marginTop}px`);
  if (has(s.marginBottom)) self.push(`margin-bottom:${s.marginBottom}px`);
  if (has(s.borderWidth)) self.push(`border-width:${s.borderWidth}px`, "border-style:solid", `border-color:${ok(s.borderColor) ? s.borderColor : "rgb(var(--color-line))"}`);
  else if (ok(s.borderColor)) self.push(`border-color:${s.borderColor}`);
  if (has(s.borderRadius)) self.push(`border-radius:${s.borderRadius}px`, "overflow:hidden");
  if (ok(s.shadow)) self.push(`box-shadow:${SHADOW[s.shadow as keyof typeof SHADOW]}`);
  if (has(s.maxWidth)) self.push(`max-width:${s.maxWidth}px`, "margin-left:auto", "margin-right:auto");
  if (has(s.minHeight)) self.push(`min-height:${s.minHeight}px`);
  let css = "";
  if (self.length) css += `${sel}{${self.join(";")}}`;
  if (all.length) css += `${sel} *,${sel}{${all.map((d) => `${d}!important`).join(";")}}`;
  // Buttons and images sit in a flex box: alignment moves them too.
  if (ok(s.textAlign)) css += `${sel} .flex{justify-content:${s.textAlign === "center" ? "center" : s.textAlign === "right" ? "flex-end" : "flex-start"}!important}`;
  return css;
}

interface Styled { id: string; style?: ResponsiveStyle; adv?: Advanced }

/** The CSS for every styled widget and row of a Free layout (scoped by data-fw / data-fr). */
export function layoutCss(rows: (Styled & { columns: { widgets: Styled[] }[] })[], opts: { editing?: boolean } = {}): string {
  const items: [string, Styled][] = [];
  for (const r of rows) {
    items.push([`[data-fr="${r.id}"]`, r]);
    for (const c of r.columns) for (const w of c.widgets) items.push([`[data-fw="${w.id}"]`, w]);
  }
  let out = "";
  for (const d of DEVICES) {
    let block = "";
    for (const [sel, it] of items) block += rules(sel, it.style?.[d]);
    if (block) out += MEDIA[d] ? `@media ${MEDIA[d]}{${block}}` : block;
  }
  // Hidden on a device: gone for visitors; faded (still editable) in edit mode.
  for (const d of DEVICES) {
    const key = d === "desktop" ? "hideDesktop" : d === "tablet" ? "hideTablet" : "hideMobile";
    const sels = items.filter(([, it]) => it.adv?.[key]).map(([sel]) => sel);
    if (sels.length) out += `@media ${ONLY[d]}{${sels.join(",")}{${opts.editing ? "opacity:.35;outline:1px dashed #f59e0b" : "display:none!important"}}}`;
  }
  return out.replace(/</g, "\\3C ");
}

export const hasStyle = (s: StyleSet | undefined) => Boolean(s && Object.values(s).some((v) => v !== undefined && v !== ""));
