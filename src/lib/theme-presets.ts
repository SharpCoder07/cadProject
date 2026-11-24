/**
 * Ready-made themes for Website settings › Design & theme. Applying one sets its colours and, when it has them,
 * its fonts and corner style; everything else (header, announcement bar, animations…) stays as it is.
 * Pure data (client-safe).
 */
export interface ThemePreset {
  key: string;
  name: string;
  description: string;
  colors: { primary: string; accent: string; ink: string; background: string; surface: string; success: string };
  design?: { displayFont?: string; bodyFont?: string; radius?: "sharp" | "soft" | "round"; announcementColor?: "primary" | "accent"; design?: "classic" | "design1"; animations?: "full" | "subtle" | "off" };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    key: "lime-forest-green",
    name: "Lime & Forest Green Color theme",
    description: "certinal.com's palette, colour for colour: white pages, near-black text, deep green (#00301E) for highlights and main buttons, lime (#CDF757) for the call-to-action buttons, their brand green for success, 10px buttons and rounded cards.",
    colors: {
      primary: "#00301E", // their "green ink": eyebrows, highlighted text, dark buttons
      accent: "#CDF757", // their lime call-to-action buttons (dark text on them)
      ink: "#141415", // their headings and body text
      background: "#FFFFFF", // their page background
      surface: "#FFFFFF", // their cards are white with a fine border
      success: "#01B46D", // their brand green
    },
    // Certinal uses Switzer, which isn't one of the site's fonts; Inter is the closest match.
    // Their announcement strip is lime with dark text.
    design: { displayFont: "inter", bodyFont: "inter", radius: "round", announcementColor: "accent" },
  },
  {
    key: "design-1",
    name: "Fresh Lime Design · Lime",
    description: "The whole website in a design modelled on certinal.com: the Lime & Forest Green Color theme colours, white pages, lime buttons with 10px corners, a translucent header, gradient green numbers and accent words, soft lime-tinted sections, white cards with a fine border and green shadow, a lime call-to-action panel and a light footer — plus full animations. Your pages and content stay the same.",
    colors: { primary: "#00301E", accent: "#CDF757", ink: "#141415", background: "#FFFFFF", surface: "#FFFFFF", success: "#01B46D" },
    design: { displayFont: "inter", bodyFont: "inter", radius: "round", announcementColor: "accent", design: "design1", animations: "full" },
  },
  {
    key: "design-1-teal",
    name: "Fresh Lime Design · Teal",
    description: "The same Fresh Lime Design layout (white pages, translucent header, gradient numbers and accent words, soft tinted sections, rounded cards, light footer, full animations) in the site's default teal and amber colours. Your pages and content stay the same.",
    // The default colours (Website settings defaults), on a white page like the design.
    colors: { primary: "#0F766E", accent: "#F59E0B", ink: "#111827", background: "#FFFFFF", surface: "#FFFFFF", success: "#059669" },
    design: { displayFont: "inter", bodyFont: "inter", radius: "round", announcementColor: "primary", design: "design1", animations: "full" },
  },
];

/** The settings values a preset sets. */
export const presetValues = (p: ThemePreset): Record<string, string> => ({ ...p.colors, ...(p.design ?? {}) });
