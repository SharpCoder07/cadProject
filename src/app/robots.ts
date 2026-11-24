import type { MetadataRoute } from "next";
import { getSettings } from "@/server/settings";
import { absoluteUrl } from "@/server/seo/metadata";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { seo } = await getSettings();
  if (!seo.allowIndexing) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // "/vendor$" + "/vendor/" block the vendor portal without blocking the public /vendors pages.
        disallow: ["/admin", "/vendor$", "/vendor/", "/reseller$", "/reseller/", "/account", "/api", "/login", "/signup", "/invite", "/verify-email", "/reset-password", "/search", "/*?preview="],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
