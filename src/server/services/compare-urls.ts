import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { COMPARE_SLOTS, compareSlugReadings, compareUrl } from "@/lib/compare";

/**
 * Clean comparison URLs (/compare/{slug}-vs-{slug}[-vs-{slug}]).
 * - Products are matched by their unique slug; a product whose slug changed is found through its
 *   automatic /software/old → /software/new redirect, and the page redirects to the new URL.
 * - Slugs are always in alphabetical order; any other order redirects to that one URL.
 * - Only published products count; an unknown slug means 404.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type CompareResolution =
  | { kind: "ok"; slugs: string[]; path: string }
  | { kind: "redirect"; to: string }
  | { kind: "not-found" };

async function renamedSlugs(slugs: string[]) {
  if (!slugs.length) return new Map<string, string>();
  const rows = await db.redirect.findMany({ where: { isActive: true, fromPath: { in: slugs.map((s) => `/software/${s}`) } }, select: { fromPath: true, toPath: true } });
  const map = new Map<string, string>();
  for (const r of rows) {
    const m = /^\/software\/([a-z0-9-]+)$/.exec(r.toPath);
    if (m?.[1]) map.set(r.fromPath.slice("/software/".length), m[1]);
  }
  return map;
}

export const resolveCompareSlug = cache(async (raw: string): Promise<CompareResolution> => {
  const path = decodeURIComponent(raw).trim();
  const lower = path.toLowerCase();
  if (!lower || lower.length > 400) return { kind: "not-found" };
  if (lower !== path) return { kind: "redirect", to: `/compare/${lower}` };
  const readings = compareSlugReadings(lower, COMPARE_SLOTS).filter((r) => r.every((s) => SLUG.test(s)));
  if (!readings.length) return { kind: "not-found" };

  const candidates = [...new Set(readings.flat())];
  const [live, renamed] = await Promise.all([
    db.software.findMany({ where: { slug: { in: candidates }, status: "PUBLISHED" }, select: { slug: true } }),
    renamedSlugs(candidates),
  ]);
  const liveSet = new Set(live.map((s) => s.slug));
  const renamedTargets = [...new Set(renamed.values())];
  const liveTargets = renamedTargets.length ? new Set((await db.software.findMany({ where: { slug: { in: renamedTargets }, status: "PUBLISHED" }, select: { slug: true } })).map((s) => s.slug)) : new Set<string>();

  for (const reading of readings) {
    const current = reading.map((s) => (liveSet.has(s) ? s : renamed.has(s) && liveTargets.has(renamed.get(s)!) ? renamed.get(s)! : null));
    if (current.some((s) => s === null)) continue;
    const slugs = current as string[];
    if (new Set(slugs).size !== slugs.length) {
      // The same product twice: point at the comparison without the repeat.
      return { kind: "redirect", to: compareUrl(slugs) };
    }
    const canonical = compareUrl(slugs);
    if (canonical !== `/compare/${lower}`) return { kind: "redirect", to: canonical };
    return { kind: "ok", slugs: [...slugs].sort(), path: canonical };
  }
  return { kind: "not-found" };
});

/** A published curated comparison of exactly these products (it owns the indexable URL). */
export async function curatedComparisonFor(slugs: string[]) {
  if (slugs.length < 2) return null;
  const pages = await db.comparisonPage.findMany({
    where: { status: "PUBLISHED", items: { every: { software: { slug: { in: slugs } } } } },
    select: { slug: true, items: { select: { software: { select: { slug: true } } } } },
    take: 5,
  });
  return pages.find((p) => p.items.length === slugs.length) ?? null;
}

/**
 * Old comparison links: /compare?products[]=97061&products[]=97341 (the previous website's product
 * IDs, saved on each product as "Old website ID"), /compare?products[]=<id or slug> and /compare?p=a,b.
 * Returns the new address.
 */
export async function legacyCompareTarget(params: URLSearchParams): Promise<string> {
  const values: string[] = [];
  for (const [key, value] of params) {
    if (/^products(\[\d*\])?$/.test(key) || key === "product" || key === "p") values.push(...value.split(","));
  }
  const cleaned = [...new Set(values.map((v) => v.trim()).filter(Boolean))].slice(0, 10);
  if (!cleaned.length) return "/compare";
  const numbers = cleaned.filter((v) => /^\d{1,10}$/.test(v)).map(Number);
  const ids = cleaned.filter((v) => /^c[a-z0-9]{20,30}$/.test(v));
  const slugs = cleaned.filter((v) => SLUG.test(v.toLowerCase())).map((v) => v.toLowerCase());
  const rows = await db.software.findMany({
    where: { status: "PUBLISHED", OR: [...(numbers.length ? [{ legacyId: { in: numbers } }] : []), ...(ids.length ? [{ id: { in: ids } }] : []), ...(slugs.length ? [{ slug: { in: slugs } }] : [])] },
    select: { id: true, slug: true, legacyId: true },
  });
  const found = cleaned
    .map((v) => rows.find((r) => String(r.legacyId) === v || r.id === v || r.slug === v.toLowerCase())?.slug)
    .filter((s): s is string => Boolean(s))
    .slice(0, COMPARE_SLOTS);
  return compareUrl(found);
}
