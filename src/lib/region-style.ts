import type { CSSProperties } from "react";
import { hexToRgb, readableOn, tint } from "./theme";
import { fontVar } from "./font-choices";

/**
 * Design of one box / section of the website, set in edit mode (Design tab): colours and fonts that
 * apply inside that part only, on top of the website theme. Empty = use the theme. Stored in the
 * `regionStyles` setting, by style key (see styleKey). Pure, safe anywhere.
 */
export interface RegionStyle {
  background?: string;
  surface?: string;
  text?: string;
  primary?: string;
  accent?: string;
  border?: string;
  displayFont?: string;
  bodyFont?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const ok = (v?: string): v is string => Boolean(v && HEX.test(v));
const rgb = (h: string) => hexToRgb(h).join(" ");
const mix = (a: string, b: string, p: number) => {
  const [x, y] = [hexToRgb(a), hexToRgb(b)];
  return x.map((c, i) => Math.round(c * p + y[i]! * (1 - p))).join(" ");
};

/** CSS for the wrapper of a styled part: theme variables re-set inside it, plus its own background and text. */
export function regionStyleCss(s: RegionStyle | undefined): CSSProperties | null {
  if (!s) return null;
  const v: Record<string, string> = {};
  if (ok(s.background)) v.backgroundColor = s.background;
  if (ok(s.surface)) v["--color-surface"] = rgb(s.surface);
  if (ok(s.text)) {
    const under = ok(s.background) ? s.background : ok(s.surface) ? s.surface : "#FFFFFF";
    v["--color-ink"] = rgb(s.text);
    v["--color-muted"] = mix(s.text, under, 0.7);
    v.color = "rgb(var(--color-ink))";
  }
  if (ok(s.border)) v["--color-line"] = rgb(s.border);
  else if (ok(s.text)) v["--color-line"] = mix(s.text, ok(s.background) ? s.background : "#FFFFFF", 0.14);
  if (ok(s.primary)) {
    v["--color-primary"] = v["--color-action"] = rgb(s.primary);
    v["--color-primary-fg"] = v["--color-action-fg"] = rgb(readableOn(s.primary));
    v["--color-primary-soft"] = rgb(tint(s.primary, 0.9));
  }
  if (ok(s.accent)) {
    v["--color-accent"] = rgb(s.accent);
    v["--color-accent-fg"] = rgb(readableOn(s.accent));
  }
  if (s.displayFont) v["--font-display"] = fontVar(s.displayFont);
  if (s.bodyFont) {
    v["--font-body"] = fontVar(s.bodyFont);
    v.fontFamily = "var(--font-body)";
  }
  return Object.keys(v).length ? (v as CSSProperties) : null;
}

/** Same key on every page that shows this part (e.g. "Pricing plans" on all product pages). */
export function styleKey(label: string, parts: string[]): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug}~${[...new Set(parts)].sort().join("+")}`.slice(0, 180);
}
