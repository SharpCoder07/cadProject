import { FONT_VAR } from "@/app/fonts";
import { contrastRatio, hexToRgb, luminance, readableOn, tint } from "@/lib/theme";

/**
 * Fixed palette for the staff admin and vendor portal: teal brand and actions (links, active menu,
 * Create button, charts), neutral greys. Kept separate from Settings → Theme so editing the public site's
 * colours never changes the admin. (brandedAdminTheme can derive an admin palette from a website theme; it
 * isn't used.)
 */
export type AdminThemeMode = "light" | "dark";
export const ADMIN_THEME_COOKIE = "admin_theme";

export const ADMIN_THEME: Record<string, string> = {
  "--color-bg": "247 248 250",
  "--color-surface": "255 255 255",
  "--color-sidebar": "251 251 252",
  "--color-ink": "17 24 39",
  "--color-muted": "107 114 128",
  "--color-line": "229 231 235",
  "--color-primary": "13 148 136",
  "--color-primary-fg": "255 255 255",
  "--color-primary-soft": "230 247 244",
  "--color-action": "16 166 150",
  "--color-action-fg": "255 255 255",
  "--color-mint": "153 222 210",
  "--color-mint-soft": "230 247 244",
  "--color-mint-ink": "14 128 116",
  "--color-accent": "245 158 11",
  "--color-accent-fg": "17 24 39",
  "--color-success": "5 150 105",
  "--color-danger": "220 38 38",
  "--color-warning": "202 110 4",
  "--radius-control": "10px",
  "--radius-panel": "18px",
  "--font-display": FONT_VAR.inter!,
  "--font-body": FONT_VAR.inter!,
};

/** Dark palette: near-black canvas, slightly lifted cards, the same teal brand. */
export const ADMIN_THEME_DARK: Record<string, string> = {
  "--color-bg": "11 13 18",
  "--color-surface": "21 24 31",
  "--color-sidebar": "16 18 24",
  "--color-ink": "236 238 242",
  "--color-muted": "148 155 170",
  "--color-line": "42 46 56",
  "--color-primary": "45 212 191",
  "--color-primary-fg": "4 47 46",
  "--color-primary-soft": "17 50 47",
  "--color-action": "20 184 166",
  "--color-action-fg": "4 32 30",
  "--color-mint": "35 110 100",
  "--color-mint-soft": "17 50 47",
  "--color-mint-ink": "94 234 212",
  "--color-accent": "251 191 36",
  "--color-accent-fg": "17 24 39",
  "--color-success": "52 211 153",
  "--color-danger": "248 113 113",
  "--color-warning": "251 191 36",
};

const block = (selector: string, vars: Record<string, string>, scheme: AdminThemeMode) =>
  `${selector}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")};color-scheme:${scheme}}`;

const rgbOf = (hex: string) => hexToRgb(hex).join(" ");
/** Mixes a colour towards black by `amount` (0–1). */
const shade = (hex: string, amount: number) => `#${hexToRgb(hex).map((c) => Math.round(c * (1 - amount)).toString(16).padStart(2, "0")).join("")}`;
/** Mixes two colours (p = share of `a`). */
const mixHex = (a: string, b: string, p: number) => {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return `#${x.map((c, i) => Math.round(c * p + y[i]! * (1 - p)).toString(16).padStart(2, "0")).join("")}`;
};
/** Darkens (light mode) or lightens (dark mode) a colour until text in it is readable on `bg`. */
function readableColor(hex: string, bg: string, min = 4.5) {
  let c = hex;
  const darken = contrastRatio(bg, "#000000") < contrastRatio(bg, "#FFFFFF");
  for (let i = 0; i < 12 && contrastRatio(c, bg) < min; i++) c = darken ? shade(c, 0.12) : tint(c, 0.14);
  return c;
}

/** The website theme's brand colours (Website settings › Design & theme). */
export interface SiteBrandColors { primary: string; accent: string; success: string }

/**
 * The admin and portals in the website's brand colours: brand, buttons, links, active menu, focus rings, badges
 * and charts take the theme's Primary, Accent and Success colours, adjusted where needed so text stays readable.
 * Backgrounds, text and borders keep the admin's neutral greys (both light and dark mode).
 */
export function brandedAdminTheme(t: SiteBrandColors): { light: Record<string, string>; dark: Record<string, string> } {
  const white = "#FFFFFF";
  const darkSurface = "#15181F";
  // A near-black Primary (e.g. Lime & Forest Green's #00301E) would make the whole admin look black, since the
  // admin's text is already near-black. Then the theme's own bright colours lead: Success (green) for links,
  // the active menu and charts, and a light Accent (lime) for the main buttons and highlighted backgrounds.
  const nearBlack = luminance(t.primary) < 0.03;
  const lightAccent = luminance(t.accent) > 0.45;
  const base = nearBlack ? t.success : t.primary;
  // Light mode: the colour as is, but deepened when it's too pale for links on white.
  const p = readableColor(base, white, 3.2);
  const ink = readableColor(base, white, 4.5);
  const action = nearBlack && lightAccent ? t.accent : p;
  const soft = nearBlack && lightAccent ? tint(t.accent, 0.72) : tint(p, 0.9);
  // Dark mode: a lighter version that stands out on the near-black canvas.
  const pd = readableColor(contrastRatio(base, darkSurface) >= 4.5 ? base : tint(base, 0.35), darkSurface, 4.5);
  return {
    light: {
      "--color-primary": rgbOf(p),
      "--color-primary-fg": rgbOf(readableOn(p, "#111827")),
      "--color-primary-soft": rgbOf(soft),
      "--color-action": rgbOf(action),
      "--color-action-fg": rgbOf(readableOn(action, "#111827")),
      "--color-mint": rgbOf(nearBlack && lightAccent ? t.accent : tint(p, 0.55)),
      "--color-mint-soft": rgbOf(soft),
      "--color-mint-ink": rgbOf(ink),
      "--color-accent": rgbOf(t.accent),
      "--color-accent-fg": rgbOf(readableOn(t.accent, "#111827")),
      "--color-success": rgbOf(readableColor(t.success, white, 3)),
    },
    dark: {
      "--color-primary": rgbOf(pd),
      "--color-primary-fg": rgbOf(readableOn(pd, "#0B0D12")),
      "--color-primary-soft": rgbOf(mixHex(pd, darkSurface, 0.18)),
      "--color-action": rgbOf(nearBlack && lightAccent ? t.accent : pd),
      "--color-action-fg": rgbOf(readableOn(nearBlack && lightAccent ? t.accent : pd, "#0B0D12")),
      "--color-mint": rgbOf(mixHex(pd, darkSurface, 0.55)),
      "--color-mint-soft": rgbOf(mixHex(pd, darkSurface, 0.18)),
      "--color-mint-ink": rgbOf(pd),
      "--color-accent": rgbOf(t.accent),
      "--color-accent-fg": rgbOf(readableOn(t.accent, "#111827")),
      "--color-success": rgbOf(readableColor(t.success, darkSurface, 3)),
    },
  };
}

/**
 * The admin wrapper carries data-admin-theme; :has() lets the whole page (body, toasts,
 * dialogs) follow it, so the server renders the saved theme with no flash. With `brand` (the website
 * theme, when "Admin panel follows website colours" is on), the brand colours come from the website.
 */
export function AdminThemeStyle({ brand }: { brand?: SiteBrandColors | null } = {}) {
  const b = brand ? brandedAdminTheme(brand) : null;
  const css = block(":root", { ...ADMIN_THEME, ...b?.light }, "light") + block(':root:has([data-admin-theme="dark"])', { ...ADMIN_THEME_DARK, ...b?.dark }, "dark");
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
