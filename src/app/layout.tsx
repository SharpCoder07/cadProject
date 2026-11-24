import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./motion.css";
import "./design1.css";
import { fontVariables } from "./fonts";
import { getSettings } from "@/server/settings";
import { absoluteUrl, ogImageUrl } from "@/server/seo/metadata";
import { makeT } from "@/lib/site-texts";
import { TextsProvider } from "@/components/site/texts";
import { FormsProvider } from "@/components/site/form-fields";
import { ErrorReporter } from "@/components/error-reporter";

export async function generateMetadata(): Promise<Metadata> {
  const { site, seo, texts } = await getSettings();
  return {
    metadataBase: new URL(absoluteUrl("/")),
    title: { default: seo.defaultTitle, template: seo.titleTemplate },
    description: seo.defaultDescription,
    applicationName: site.name,
    icons: site.faviconUrl ? { icon: site.faviconUrl, apple: site.faviconUrl } : { icon: [{ url: "/brand-icon?size=64", type: "image/png" }], apple: [{ url: "/brand-icon?size=180", type: "image/png" }] },
    manifest: "/manifest.webmanifest",
    robots: seo.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
    verification: {
      google: seo.googleSiteVerification || undefined,
      other: seo.bingSiteVerification ? { "msvalidate.01": seo.bingSiteVerification } : undefined,
    },
    openGraph: { siteName: site.name, type: "website", locale: "en_IN", images: [seo.ogImageUrl || ogImageUrl(seo.defaultTitle, seo.defaultDescription)] },
    alternates: { types: { "application/rss+xml": [{ url: "/blog/feed.xml", title: makeT(texts)("blog.rssTitle", { site: site.name }) }] } },
    twitter: { card: "summary_large_image", site: seo.twitterHandle || undefined },
  };
}

// Pages render per request against the tag-cached data layer (see unstable_cache in
// src/server), so builds never need database access and admin edits show immediately.
export const dynamic = "force-dynamic";

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0F766E" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { texts, forms, leads } = await getSettings();
  return (
    <html lang="en-IN" className={fontVariables}>
      <body>
        {/* Browser errors (UI and network) go to Admin › Logs › Error logs. */}
        <ErrorReporter />
        {/* Website wording changed in Pages › Website texts, for client components (useT). */}
        <TextsProvider overrides={texts}>
          {/* Enquiry and partner forms set up in Pages › Forms. */}
          <FormsProvider forms={forms} companySizes={leads.companySizes} requireCompany={leads.requireCompany}>
            {children}
          </FormsProvider>
        </TextsProvider>
      </body>
    </html>
  );
}
