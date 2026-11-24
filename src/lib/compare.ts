/** How many products the compare page (and the compare tray on listings) holds at once. */
export const COMPARE_SLOTS = 3;

/** A product as shown in a compare slot and in the "Choose product" list. */
export interface CompareProduct {
  slug: string;
  name: string;
  logoUrl: string | null;
  /** Brand name, falling back to the vendor's. */
  maker: string | null;
  category: string | null;
  rating: number;
  ratingCount: number;
}

/** Separator between product slugs in a comparison URL: /compare/alibre-design-vs-altair-inspire */
export const COMPARE_SEPARATOR = "-vs-";

/**
 * The one URL for a set of products. Slugs are de-duplicated and sorted alphabetically, so
 * "A vs B" and "B vs A" share a single address (no duplicate pages). No products → /compare.
 */
export function compareUrl(slugs: string[]): string {
  const unique = [...new Set(slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))].sort();
  return unique.length ? `/compare/${unique.join(COMPARE_SEPARATOR)}` : "/compare";
}

/** The product order used on comparison pages and in their URLs. */
export const canonicalCompareOrder = (slugs: string[]) => [...new Set(slugs)].sort();

/**
 * Every way to read "a-vs-b-vs-c" as product slugs (a slug may itself contain "-vs-"), longest
 * pieces first. Used by the server to match the pieces against real products.
 */
export function compareSlugReadings(path: string, max = 8): string[][] {
  const parts = path.split(COMPARE_SEPARATOR);
  const out: string[][] = [];
  const walk = (start: number, acc: string[]) => {
    if (out.length >= 64) return;
    if (start === parts.length) {
      if (acc.length <= max) out.push(acc);
      return;
    }
    for (let end = parts.length; end > start; end--) walk(end, [...acc, parts.slice(start, end).join(COMPARE_SEPARATOR)]);
  };
  walk(0, []);
  // Prefer readings with more products (the common case: no slug contains "-vs-").
  return out.sort((a, b) => b.length - a.length);
}
