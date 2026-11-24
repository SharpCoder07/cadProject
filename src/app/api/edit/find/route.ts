import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { errorResponse } from "@/server/http";
import { editModeUser } from "@/server/edit-api";

/**
 * Website edit mode Finder (Ctrl+K): website pages matching a search — your pages, products,
 * categories, articles, brands, vendors and comparisons — to jump to in edit mode.
 */
export const dynamic = "force-dynamic";

export interface FinderHit { group: string; label: string; meta: string | null; href: string }

export async function GET(req: NextRequest) {
  try {
    await editModeUser();
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
    if (q.length < 2) return NextResponse.json({ hits: [] });
    const like = { contains: q, mode: "insensitive" as const };
    const [pages, products, categories, posts, brands, vendors, comparisons] = await Promise.all([
      db.page.findMany({ where: { status: "PUBLISHED", OR: [{ title: like }, { slug: like }] }, take: 5, orderBy: { title: "asc" }, select: { title: true, slug: true } }),
      db.software.findMany({ where: { status: "PUBLISHED", OR: [{ name: like }, { slug: like }] }, take: 6, orderBy: { popularityScore: "desc" }, select: { name: true, slug: true, vendor: { select: { name: true } } } }),
      db.category.findMany({ where: { isActive: true, name: like }, take: 5, orderBy: [{ depth: "asc" }, { name: "asc" }], select: { name: true, slug: true } }),
      db.post.findMany({ where: { status: "PUBLISHED", title: like }, take: 5, orderBy: { updatedAt: "desc" }, select: { title: true, slug: true } }),
      db.brand.findMany({ where: { isActive: true, name: like }, take: 4, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
      db.vendor.findMany({ where: { isActive: true, kind: "VENDOR", name: like }, take: 4, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
      db.comparisonPage.findMany({ where: { status: "PUBLISHED", OR: [{ title: like }, { slug: like }] }, take: 4, orderBy: { title: "asc" }, select: { title: true, slug: true } }),
    ]);
    const hits: FinderHit[] = [
      ...pages.map((p) => ({ group: "Pages", label: p.slug === "home" ? "Homepage" : p.title, meta: p.slug === "home" ? "/" : `/${p.slug}`, href: p.slug === "home" ? "/" : `/${p.slug}` })),
      ...products.map((p) => ({ group: "Products", label: p.name, meta: p.vendor?.name ?? null, href: `/software/${p.slug}` })),
      ...categories.map((c) => ({ group: "Categories", label: c.name, meta: null, href: `/categories/${c.slug}` })),
      ...posts.map((p) => ({ group: "Articles", label: p.title, meta: null, href: `/blog/${p.slug}` })),
      ...brands.map((b) => ({ group: "Brands", label: b.name, meta: null, href: `/brands/${b.slug}` })),
      ...vendors.map((v) => ({ group: "Vendors", label: v.name, meta: null, href: `/vendors/${v.slug}` })),
      ...comparisons.map((c) => ({ group: "Comparisons", label: c.title, meta: null, href: `/compare/${c.slug}` })),
    ];
    return NextResponse.json({ hits }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
