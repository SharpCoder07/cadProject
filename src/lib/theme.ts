/** Pure helpers that turn theme settings into CSS custom properties. */

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  return [parseInt(m[1] as string, 16), parseInt(m[2] as string, 16), parseInt(m[3] as string, 16)];
}

const channel = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white text, whichever contrasts more with the background. */
export const readableOn = (bg: string, ink = "#111827") => (contrastRatio(bg, "#FFFFFF") >= contrastRatio(bg, ink) ? "#FFFFFF" : ink);

/** Mixes a colour towards white by `amount` (0–1). */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

const rgb = (hex: string) => hexToRgb(hex).join(" ");

export interface ThemeInput {
  primary: string;
  accent: string;
  ink: string;
  background: string;
  surface: string;
  success: string;
  radius: "sharp" | "soft" | "round";
}

export function themeVariables(t: ThemeInput): Record<string, string> {
  const radius = { sharp: ["2px", "4px"], soft: ["6px", "10px"], round: ["10px", "16px"] }[t.radius];
  // Muted text and hairlines are derived from ink/background so custom palettes stay coherent.
  const [ir, ig, ib] = hexToRgb(t.ink);
  const [br, bg, bb] = hexToRgb(t.background);
  const mix = (a: number, b: number, p: number) => Math.round(a * p + b * (1 - p));
  return {
    "--color-bg": rgb(t.background),
    "--color-surface": rgb(t.surface),
    "--color-ink": rgb(t.ink),
    "--color-muted": `${mix(ir, br, 0.66)} ${mix(ig, bg, 0.66)} ${mix(ib, bb, 0.66)}`,
    "--color-line": `${mix(ir, br, 0.12)} ${mix(ig, bg, 0.12)} ${mix(ib, bb, 0.12)}`,
    "--color-primary": rgb(t.primary),
    "--color-primary-fg": rgb(readableOn(t.primary, t.ink)),
    "--color-primary-soft": rgb(tint(t.primary, 0.9)),
    "--color-action": rgb(t.primary),
    "--color-action-fg": rgb(readableOn(t.primary, t.ink)),
    "--color-accent": rgb(t.accent),
    "--color-accent-fg": rgb(readableOn(t.accent, t.ink)),
    "--color-success": rgb(t.success),
    // Dark brand surface (footer, dark banners): the main colour taken most of the way to black.
    "--color-band": hexToRgb(t.primary).map((c) => Math.round(c * 0.38)).join(" "),
    "--radius-control": radius[0] as string,
    "--radius-panel": radius[1] as string,
  };
}

export const cssVarsBlock = (vars: Record<string, string>) => `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(";")}}`;
