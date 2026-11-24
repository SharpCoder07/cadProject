import { absoluteUrl } from "./metadata";
import { toNumber } from "@/lib/format";

type Json = Record<string, unknown>;

export const breadcrumbLd = (items: { name: string; path: string }[]): Json => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.path) })),
});

export const faqLd = (faqs: { question: string; answer: string }[]): Json | null =>
  faqs.length
    ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) }
    : null;

/** A list of pages (products, posts…) shown on a listing page. `offset` = items before this page. */
export const itemListLd = (name: string, items: { name: string; path: string }[], offset = 0): Json | null =>
  items.length
    ? { "@context": "https://schema.org", "@type": "ItemList", name, numberOfItems: items.length, itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: offset + i + 1, url: absoluteUrl(it.path), name: it.name })) }
    : null;

/** A collection page (category, brand, industry…) wrapping its item list. */
export const collectionPageLd = (p: { name: string; path: string; description?: string | null; items: { name: string; path: string }[]; offset?: number }): Json => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: p.name,
  url: absoluteUrl(p.path),
  description: p.description ?? undefined,
  inLanguage: "en-IN",
  mainEntity: itemListLd(p.name, p.items, p.offset ?? 0) ?? undefined,
});

export function softwareLd(sw: {
  name: string; slug: string; shortDescription: string | null; tagline: string | null; startingPrice: unknown; currency: string; pricingModel: string;
  ratingAvg: unknown; ratingCount: number; deployment: string[]; logo: { url: string } | null; vendor: { name: string; website: string | null } | null;
  primaryCategory: { name: string } | null;
  brand?: { name: string } | null;
  reviews?: { rating: number; title: string; body: string; authorName: string; createdAt: Date | string }[];
}): Json {
  const price = toNumber(sw.startingPrice as number | null);
  const rating = toNumber(sw.ratingAvg as number | null) ?? 0;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: sw.name,
    url: absoluteUrl(`/software/${sw.slug}`),
    description: sw.shortDescription ?? sw.tagline ?? undefined,
    // Google expects a schema.org application type here; the marketplace category goes in the subcategory.
    applicationCategory: "BusinessApplication",
    applicationSubCategory: sw.primaryCategory?.name ?? undefined,
    operatingSystem: sw.deployment.includes("CLOUD") ? "Web" : sw.deployment.length ? "Windows" : undefined,
    brand: sw.brand ? { "@type": "Brand", name: sw.brand.name } : undefined,
    image: sw.logo ? absoluteUrl(sw.logo.url) : undefined,
    publisher: sw.vendor ? { "@type": "Organization", name: sw.vendor.name, url: sw.vendor.website ?? undefined } : undefined,
    offers:
      price !== null
        ? { "@type": "Offer", price: price.toFixed(2), priceCurrency: sw.currency, availability: "https://schema.org/InStock" }
        : sw.pricingModel === "FREE"
          ? { "@type": "Offer", price: "0", priceCurrency: sw.currency }
          : undefined,
    // Only emit ratings backed by real, moderated reviews.
    aggregateRating: sw.ratingCount > 0 ? { "@type": "AggregateRating", ratingValue: rating.toFixed(1), reviewCount: sw.ratingCount, bestRating: 5, worstRating: 1 } : undefined,
    review: sw.reviews?.length
      ? sw.reviews.slice(0, 5).map((r) => ({
          "@type": "Review",
          name: r.title,
          reviewBody: r.body.slice(0, 500),
          datePublished: new Date(r.createdAt).toISOString().slice(0, 10),
          author: { "@type": "Person", name: r.authorName },
          reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
        }))
      : undefined,
  };
}

export const articleLd = (p: { title: string; slug: string; excerpt: string | null; publishedAt: Date | null; updatedAt: Date; cover: { url: string } | null; author: { name: string; slug?: string } | null }, publisher: string, logoUrl?: string): Json => ({
  "@context": "https://schema.org",
  "@type": "Article",
  headline: p.title,
  description: p.excerpt ?? undefined,
  url: absoluteUrl(`/blog/${p.slug}`),
  image: p.cover ? absoluteUrl(p.cover.url) : undefined,
  // Cached posts come back with dates as strings, so convert either way.
  datePublished: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined,
  dateModified: new Date(p.updatedAt).toISOString(),
  mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/blog/${p.slug}`) },
  inLanguage: "en-IN",
  author: p.author ? { "@type": "Person", name: p.author.name, ...(p.author.slug ? { url: absoluteUrl(`/blog/author/${p.author.slug}`) } : {}) } : { "@type": "Organization", name: publisher },
  publisher: { "@type": "Organization", name: publisher, url: absoluteUrl("/"), ...(logoUrl ? { logo: { "@type": "ImageObject", url: absoluteUrl(logoUrl) } } : {}) },
});

/** A vendor (software company) profile page. */
export const vendorLd = (v: { name: string; slug: string; description: string | null; website: string | null; logo: { url: string } | null }): Json => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: v.name,
  url: absoluteUrl(`/vendors/${v.slug}`),
  description: v.description ?? undefined,
  logo: v.logo ? absoluteUrl(v.logo.url) : undefined,
  sameAs: v.website ? [v.website] : undefined,
});

export const organizationLd = (site: { name: string; logoUrl: string; contactEmail: string; contactPhone: string; social: Record<string, string> }): Json => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: absoluteUrl("/"),
  logo: site.logoUrl ? absoluteUrl(site.logoUrl) : undefined,
  email: site.contactEmail || undefined,
  telephone: site.contactPhone || undefined,
  sameAs: Object.values(site.social).filter(Boolean),
});

export const websiteLd = (name: string): Json => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name,
  url: absoluteUrl("/"),
  potentialAction: { "@type": "SearchAction", target: `${absoluteUrl("/search")}?q={search_term_string}`, "query-input": "required name=search_term_string" },
});

/** Serializes JSON-LD safely for inline <script> (escapes "<" to prevent breaking out of the tag). */
export const jsonLdString = (data: Json | Json[]) => JSON.stringify(data).replace(/</g, "\\u003c");
