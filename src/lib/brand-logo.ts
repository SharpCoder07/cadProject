/**
 * The built-in Cadgram logo follows the website theme (Website settings › Design & theme): its icon and the
 * "gram" part of the wordmark use the Primary colour, "cad" uses the Text colour. Uploaded logos of your own
 * are shown as they are. Pure (client-safe); the recoloured SVG is served by app/brand/themed/[v]/[file].
 */
import { hexToRgb, readableOn, tint } from "./theme";

export const BRAND_FILES = ["cadgram-logo.svg", "cadgram-logo-dark.svg", "cadgram-icon.svg", "cadgram-icon-dark.svg"] as const;
export type BrandFile = (typeof BRAND_FILES)[number];

interface Colors { primary: string; ink: string }

/** Mixes a colour towards black by `amount` (0–1). */
const shade = (hex: string, amount: number) =>
  `#${hexToRgb(hex).map((c) => Math.round(c * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;

/** Short version tag of the colours, so a theme change gives the logo a new address (and fresh caches). */
export const themeTag = (t: Colors) => `${t.primary}${t.ink}`.replace(/#/g, "").toLowerCase();

/** The themed address for a built-in logo URL; any other URL (an uploaded logo) is returned unchanged. */
export function themedLogoUrl(url: string | null | undefined, t: Colors): string | null {
  if (!url) return null;
  const m = /^\/brand\/(cadgram-(?:logo|icon)(?:-dark)?\.svg)$/.exec(url);
  return m ? `/brand/themed/${themeTag(t)}/${m[1]}` : url;
}

/** Replaces the original teal palette in a built-in logo with the theme's colours. */
export function recolorBrandSvg(svg: string, file: BrandFile, t: Colors): string {
  const light: Record<string, string> = {
    "#14B8A6": tint(t.primary, 0.28), // icon gradient, light end
    "#0D9488": t.primary, // icon gradient, dark end + "gram"
    "#111827": t.ink, // "cad"
    "#fff": readableOn(t.primary, t.ink), // the C mark on the icon
  };
  const dark: Record<string, string> = {
    "#5EEAD4": tint(t.primary, 0.62),
    "#14B8A6": tint(t.primary, 0.38),
    "#2DD4BF": tint(t.primary, 0.5), // "gram" on dark backgrounds
    "#042F2E": shade(t.primary, 0.7), // the C mark on the light icon
  };
  const map = file.includes("dark") ? dark : light;
  // Drop the embedded content-credentials metadata (large and not needed for a recoloured copy).
  let out = svg.replace(/<metadata>[\s\S]*?<\/metadata>/g, "").replace(/\s+xmlns:c2pa="[^"]*"/g, "");
  for (const [from, to] of Object.entries(map)) out = out.replace(new RegExp(`"${from}"`, "gi"), `"${to}"`);
  return out;
}
