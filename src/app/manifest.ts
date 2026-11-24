import type { MetadataRoute } from "next";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** Web app manifest (install prompt, theme colour, icons). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { site, seo, theme } = await getSettings();
  return {
    name: site.name,
    short_name: site.name,
    description: seo.defaultDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: theme.primary,
    lang: "en-IN",
    icons: site.faviconUrl ? [{ src: site.faviconUrl, sizes: "any" }] : [{ src: "/brand-icon?size=192", sizes: "192x192", type: "image/png" }, { src: "/brand-icon?size=512", sizes: "512x512", type: "image/png" }],
  };
}
