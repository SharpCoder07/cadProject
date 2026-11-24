/**
 * Fonts offered in Settings › Website design (heading and body). Each key has a matching
 * next/font declaration in app/fonts.ts; only the fonts in use are downloaded by visitors.
 */
export const FONTS = [
  { key: "jakarta", label: "Plus Jakarta Sans", group: "Modern sans" },
  { key: "inter", label: "Inter", group: "Modern sans" },
  { key: "manrope", label: "Manrope", group: "Modern sans" },
  { key: "dm-sans", label: "DM Sans", group: "Modern sans" },
  { key: "figtree", label: "Figtree", group: "Modern sans" },
  { key: "outfit", label: "Outfit", group: "Modern sans" },
  { key: "urbanist", label: "Urbanist", group: "Modern sans" },
  { key: "lexend", label: "Lexend", group: "Modern sans" },
  { key: "sora", label: "Sora", group: "Modern sans" },
  { key: "poppins", label: "Poppins", group: "Classic sans" },
  { key: "roboto", label: "Roboto", group: "Classic sans" },
  { key: "open-sans", label: "Open Sans", group: "Classic sans" },
  { key: "lato", label: "Lato", group: "Classic sans" },
  { key: "montserrat", label: "Montserrat", group: "Classic sans" },
  { key: "nunito-sans", label: "Nunito Sans", group: "Classic sans" },
  { key: "work-sans", label: "Work Sans", group: "Classic sans" },
  { key: "rubik", label: "Rubik", group: "Classic sans" },
  { key: "raleway", label: "Raleway", group: "Classic sans" },
  { key: "plex", label: "IBM Plex Sans", group: "Classic sans" },
  { key: "bricolage", label: "Bricolage Grotesque", group: "Display" },
  { key: "space-grotesk", label: "Space Grotesk", group: "Display" },
  { key: "source-serif", label: "Source Serif", group: "Serif" },
  { key: "merriweather", label: "Merriweather", group: "Serif" },
  { key: "playfair", label: "Playfair Display", group: "Serif" },
] as const;

export type FontKey = (typeof FONTS)[number]["key"];
export const FONT_KEYS = FONTS.map((f) => f.key) as [FontKey, ...FontKey[]];
/** CSS variable set by app/fonts.ts for each font. */
export const fontVar = (key: string) => `var(--f-${key})`;
