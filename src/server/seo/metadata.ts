import type { Metadata } from "next";

const APP_URL = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const absoluteUrl = (path: string) => (/^https?:\/\//.test(path) ? path : `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`);

/**
 * Canonical + indexing for listing pages. Page 2, 3… are indexable with a self-referencing
 * canonical (?page=N); filtered/sorted/searched variants are noindex and point at the clean URL.
 */
export function listingIndexing(path: string, params: Record<string, string | string[] | undefined>) {
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const filtered = Object.entries(params).some(([k, v]) => k !== "page" && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));
  return { path: page > 1 && !filtered ? `${path}?page=${page}` : path, noIndex: filtered, page };
}

/** Branded share image generated on the fly (see /og) for pages without their own image. */
export const ogImageUrl = (title: string, subtitle?: string | null) =>
  `/og?${new URLSearchParams({ title: title.slice(0, 110), ...(subtitle ? { subtitle: subtitle.slice(0, 160) } : {}) })}`;

interface SeoOverrides {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  canonicalUrl?: string | null;
  noIndex?: boolean | null;
  ogImage?: { url: string } | null;
}

/**
 * Merges per-entity SEO overrides with computed fallbacks. `path` is the
 * canonical path of the page; an explicit canonical URL override wins.
 */
export function buildMetadata(opts: {
  path: string;
  title: string;
  description?: string | null;
  image?: string | null;
  seo?: SeoOverrides | null;
  type?: "website" | "article";
  publishedTime?: Date | null;
  noIndex?: boolean;
  absoluteTitle?: boolean;
}): Metadata {
  const title = opts.seo?.title || opts.title;
  const description = (opts.seo?.description || opts.description || "").slice(0, 170) || undefined;
  const canonical = opts.seo?.canonicalUrl || absoluteUrl(opts.path);
  const image = opts.seo?.ogImage?.url || opts.image || ogImageUrl(title, description);
  const noIndex = Boolean(opts.seo?.noIndex || opts.noIndex);
  return {
    title: opts.absoluteTitle ? { absolute: title } : title,
    description,
    keywords: opts.seo?.keywords || undefined,
    alternates: { canonical, languages: { "en-IN": canonical, "x-default": canonical } },
    robots: noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      type: opts.type ?? "website",
      locale: "en_IN",
      images: [{ url: absoluteUrl(image), ...(image.startsWith("/og?") ? { width: 1200, height: 630 } : {}), alt: title }],
      ...(opts.publishedTime ? { publishedTime: new Date(opts.publishedTime).toISOString() } : {}),
    },
    twitter: { card: "summary_large_image", title, description, images: [absoluteUrl(image)] },
  };
}
