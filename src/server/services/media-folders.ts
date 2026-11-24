import "server-only";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { db } from "@/server/db";
import { assertCan, type Principal } from "@/server/rbac/policy";

/**
 * Media gallery folders. Folders are worked out from where each file is used (product logo,
 * blog cover, a homepage section…), so nobody has to file uploads by hand, and "Unused images"
 * always lists exactly the files that appear nowhere.
 *
 * Galleries: staff see their own library ("Our library") and each vendor company's gallery;
 * vendor users only ever see their own company's gallery.
 */

export const MEDIA_FOLDERS = [
  { key: "all", label: "All files", hint: "Everything in this gallery." },
  { key: "products", label: "Products", hint: "Product logos, screenshots and images in product descriptions." },
  { key: "companies", label: "Vendors & brands", hint: "Vendor and brand logos." },
  { key: "categories", label: "Categories & industries", hint: "Category and industry images and banners, landing pages." },
  { key: "blog", label: "Blog", hint: "Post covers, images inside posts and author photos." },
  { key: "pages", label: "Pages & homepage", hint: "Homepage and page sections, comparisons, testimonials, site settings." },
  { key: "banners", label: "Banners & ads", hint: "Banner and ad images." },
  { key: "seo", label: "SEO & social", hint: "Images used when a page is shared on social media." },
  { key: "unused", label: "Unused images", hint: "Not used anywhere on the site. Safe to tidy up." },
] as const;
export type MediaFolderKey = (typeof MEDIA_FOLDERS)[number]["key"];
export const isMediaFolder = (k: unknown): k is MediaFolderKey => MEDIA_FOLDERS.some((f) => f.key === k);
/** Folders a vendor's gallery shows (the rest only ever hold the Cadgram team's files). */
export const VENDOR_FOLDERS: MediaFolderKey[] = ["all", "products", "companies", "unused"];

type UsedIn = Exclude<MediaFolderKey, "all" | "unused">;

/** Files referenced through a database link (logo, cover image…), per folder. */
const RELATION_USE: Record<UsedIn, Prisma.MediaAssetWhereInput[]> = {
  products: [{ softwareLogos: { some: {} } }, { softwareMedia: { some: {} } }],
  companies: [{ vendorLogos: { some: {} } }, { brandLogos: { some: {} } }],
  categories: [{ categoryImages: { some: {} } }, { categoryBanners: { some: {} } }, { industryImages: { some: {} } }],
  blog: [{ postCovers: { some: {} } }, { authorAvatars: { some: {} } }],
  pages: [{ testimonialAvatar: { some: {} } }],
  banners: [{ banners: { some: {} } }, { bannersMobile: { some: {} } }],
  seo: [{ seoOgImages: { some: {} } }],
};

/** Text and JSON columns that can contain a file's URL (rich text, page-builder sections, settings). */
const TEXT_USE: Record<UsedIn, Prisma.Sql[]> = {
  products: [Prisma.sql`SELECT "description" AS t FROM "Software"`, Prisma.sql`SELECT "description" AS t FROM "SoftwareFeature"`, Prisma.sql`SELECT "description" AS t FROM "ProductOffer"`],
  companies: [Prisma.sql`SELECT "description" AS t FROM "Vendor"`, Prisma.sql`SELECT "description" AS t FROM "Brand"`],
  categories: [
    Prisma.sql`SELECT "content" AS t FROM "Category"`,
    Prisma.sql`SELECT "layout"::text AS t FROM "Category"`,
    Prisma.sql`SELECT "content" AS t FROM "Industry"`,
    Prisma.sql`SELECT "content" AS t FROM "TaxonomyTerm"`,
    Prisma.sql`SELECT "sections"::text AS t FROM "GeoPage"`,
  ],
  blog: [Prisma.sql`SELECT "content" AS t FROM "Post"`],
  pages: [
    Prisma.sql`SELECT "data"::text AS t FROM "PageSection"`,
    Prisma.sql`SELECT "data"::text AS t FROM "ReusableBlock"`,
    Prisma.sql`SELECT "value"::text AS t FROM "Setting"`,
    Prisma.sql`SELECT concat_ws(' ', "intro", "verdict") AS t FROM "ComparisonPage"`,
  ],
  banners: [],
  seo: [Prisma.sql`SELECT "structuredData"::text AS t FROM "SeoMeta"`],
};

// Library files are stored as yyyy/mm/name.ext; find those keys inside any URL in the text.
const KEY_PATTERN = String.raw`(\d{4}/\d{2}/[A-Za-z0-9._-]+\.(webp|png|jpe?g|gif|avif|svg|pdf))`;

/** Storage keys of files mentioned in text/JSON, per folder (once per request). */
const textKeys = cache(async (): Promise<Record<UsedIn, string[]>> => {
  const entries = await Promise.all(
    (Object.keys(TEXT_USE) as UsedIn[]).map(async (folder) => {
      const sources = TEXT_USE[folder];
      if (!sources.length) return [folder, []] as const;
      const rows = await db.$queryRaw<{ key: string }[]>`
        SELECT DISTINCT (regexp_matches(src.t, ${KEY_PATTERN}, 'g'))[1] AS key
        FROM (${Prisma.join(sources, " UNION ALL ")}) AS src
        WHERE src.t IS NOT NULL`;
      return [folder, rows.map((r) => r.key)] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<UsedIn, string[]>;
});

/** Prisma filter for files in a folder. */
export async function folderWhere(folder: MediaFolderKey): Promise<Prisma.MediaAssetWhereInput> {
  if (folder === "all") return {};
  const keys = await textKeys();
  if (folder === "unused") {
    const allKeys = [...new Set(Object.values(keys).flat())];
    const none = Object.values(RELATION_USE)
      .flat()
      .map((w) => {
        const rel = Object.keys(w)[0] as string;
        return { [rel]: { none: {} } } as Prisma.MediaAssetWhereInput;
      });
    return { AND: [...none, ...(allKeys.length ? [{ storageKey: { notIn: allKeys } }] : [])] };
  }
  const or = [...RELATION_USE[folder], ...(keys[folder].length ? [{ storageKey: { in: keys[folder] } }] : [])];
  return { OR: or };
}

/** Where one file is used, as folder labels (for the file details panel). */
export async function mediaUsedIn(id: string): Promise<string[]> {
  const asset = await db.mediaAsset.findUnique({ where: { id }, select: { storageKey: true } });
  if (!asset) return [];
  const keys = await textKeys();
  const hits = await Promise.all(
    (Object.keys(RELATION_USE) as UsedIn[]).map(async (folder) => {
      if (keys[folder].includes(asset.storageKey)) return folder;
      const n = await db.mediaAsset.count({ where: { id, OR: RELATION_USE[folder] } });
      return n ? folder : null;
    }),
  );
  return hits.filter((f): f is UsedIn => Boolean(f)).map((f) => MEDIA_FOLDERS.find((x) => x.key === f)!.label);
}

// ─── Galleries ───────────────────────────────────────────────────────────────

/** "staff" = the Cadgram team's own library; "vendor:<id>" = one vendor company's uploads. */
export type GalleryKey = "staff" | `vendor:${string}`;

export function galleryWhere(gallery: GalleryKey): Prisma.MediaAssetWhereInput {
  if (gallery === "staff") return { OR: [{ uploadedById: null }, { uploadedBy: { vendorId: null } }] };
  return { uploadedBy: { vendorId: gallery.slice("vendor:".length) } };
}

/** The gallery a user may open: vendors are always pinned to their own company. */
export function resolveGallery(user: Principal, requested?: string | null): GalleryKey {
  if (user.vendorId) return `vendor:${user.vendorId}`;
  if (requested && /^vendor:c[a-z0-9]{20,30}$/.test(requested)) return requested as GalleryKey;
  return "staff";
}

/** Vendor companies that have uploaded files, for the Super Admin's gallery list. */
export async function vendorGalleries(user: Principal) {
  assertCan(user, "media.view");
  if (user.vendorId) return [];
  const rows = await db.$queryRaw<{ id: string; name: string; files: bigint }[]>`
    SELECT v."id", v."name", COUNT(m."id") AS files
    FROM "MediaAsset" m JOIN "User" u ON u."id" = m."uploadedById" JOIN "Vendor" v ON v."id" = u."vendorId"
    GROUP BY v."id", v."name" ORDER BY v."name" ASC`;
  return rows.map((r) => ({ id: r.id, name: r.name, files: Number(r.files) }));
}

/** File counts per folder for a gallery (the folder sidebar). */
export async function folderCounts(gallery: GalleryKey, folders: readonly MediaFolderKey[]) {
  const base = galleryWhere(gallery);
  const counts = await Promise.all(folders.map(async (f) => db.mediaAsset.count({ where: { AND: [base, await folderWhere(f)] } })));
  return Object.fromEntries(folders.map((f, i) => [f, counts[i]])) as Record<MediaFolderKey, number>;
}
