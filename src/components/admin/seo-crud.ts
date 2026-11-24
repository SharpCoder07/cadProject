import type { CrudField } from "./crud-manager";

/**
 * SEO fields for CrudManager forms (industries, comparisons, brands…). Values are flat keys
 * ("seo.title"…) that CrudManager saves as a nested `seo` object.
 */
export const SEO_CRUD_FIELDS: CrudField[] = [
  { name: "_seoSection", label: "Search engine optimisation", type: "section", hint: "Optional. Leave empty to use the automatic title and description." },
  { name: "seo.title", label: "SEO title", type: "text", max: 70, hint: "Shown in Google results and the browser tab" },
  { name: "seo.canonicalUrl", label: "Canonical URL", type: "text", placeholder: "https://…", hint: "Only if this content duplicates another page" },
  { name: "seo.description", label: "Meta description", type: "textarea", max: 170, wide: true, hint: "The snippet under the title in Google" },
  { name: "seo.keywords", label: "Keywords", type: "text", placeholder: "comma, separated" },
  { name: "seo.ogImageId", label: "Social sharing image", type: "media", previewKey: "_seoOg", hint: "1200 × 630 px. Leave empty for the branded card." },
  { name: "seo.noIndex", label: "Hide from search engines (noindex)", type: "switch", wide: true },
];

/** Flattens a SeoMeta row into CrudManager values for SEO_CRUD_FIELDS. */
export function seoValues(seo: { title: string | null; description: string | null; keywords: string | null; canonicalUrl: string | null; noIndex: boolean; ogImageId: string | null; ogImage?: { url: string } | null } | null) {
  return {
    "seo.title": seo?.title ?? "",
    "seo.description": seo?.description ?? "",
    "seo.keywords": seo?.keywords ?? "",
    "seo.canonicalUrl": seo?.canonicalUrl ?? "",
    "seo.noIndex": seo?.noIndex ?? false,
    "seo.ogImageId": seo?.ogImageId ?? null,
    _seoOg: seo?.ogImage?.url ?? null,
  };
}

export const SEO_EMPTY = { "seo.title": "", "seo.description": "", "seo.keywords": "", "seo.canonicalUrl": "", "seo.noIndex": false, "seo.ogImageId": null };
