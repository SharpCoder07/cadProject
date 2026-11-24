import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

// Colours are CSS variables (RGB channels) so the admin theme settings can
// change them at runtime without a rebuild. See src/components/site/theme-style.tsx.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  // `dark:` applies inside the admin when its wrapper has data-admin-theme="dark" (the public site has no dark mode).
  darkMode: ["variant", '&:where([data-admin-theme="dark"], [data-admin-theme="dark"] *)'],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", lg: "2rem" }, screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        bg: token("color-bg"),
        surface: token("color-surface"),
        sidebar: token("color-sidebar"),
        ink: token("color-ink"),
        // Dark brand surface for the footer and dark banners (derived from the main colour).
        band: token("color-band"),
        muted: token("color-muted"),
        line: token("color-line"),
        primary: { DEFAULT: token("color-primary"), fg: token("color-primary-fg"), soft: token("color-primary-soft") },
        accent: { DEFAULT: token("color-accent"), fg: token("color-accent-fg") },
        // Main action buttons: the brand colour on the site, near-black in the admin.
        action: { DEFAULT: token("color-action"), fg: token("color-action-fg") },
        success: token("color-success"),
        danger: token("color-danger"),
        warning: token("color-warning"),
        // Focus colour for search boxes and form fields (soft mint glow + a slightly deeper border).
        mint: { DEFAULT: token("color-mint"), soft: token("color-mint-soft"), ink: token("color-mint-ink") },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        control: "var(--radius-control)",
        panel: "var(--radius-panel)",
      },
      maxWidth: { prose: "68ch" },
    },
  },
  plugins: [typography],
};

export default config;
