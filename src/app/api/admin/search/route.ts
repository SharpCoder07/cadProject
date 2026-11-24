import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { AppError } from "@/server/errors";

export interface AdminSearchHit {
  type: "Products" | "Vendors" | "Categories" | "Leads" | "Users" | "Pages" | "Blog posts";
  label: string;
  meta: string | null;
  href: string;
}

/** Search across admin records for the command palette. Each group is checked against the user's permissions. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Sign in to continue.", "UNAUTHENTICATED");
    if (user.vendorId) throw new AppError("Not available in the vendor portal.", "FORBIDDEN");
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60);
    if (q.length < 2) return NextResponse.json({ hits: [] });
    const has = (p: Parameters<typeof user.permissions.has>[0]) => user.permissions.has(p);
    const like = { contains: q, mode: "insensitive" as const };
    const none = Promise.resolve([] as AdminSearchHit[]);

    const groups = await Promise.all([
      has("software.view")
        ? db.software
            .findMany({ where: { OR: [{ name: like }, { slug: like }] }, take: 5, orderBy: { popularityScore: "desc" }, select: { id: true, name: true, status: true, vendor: { select: { name: true } } } })
            .then((rows) => rows.map((r): AdminSearchHit => ({ type: "Products", label: r.name, meta: [r.vendor?.name, r.status.toLowerCase().replace("_", " ")].filter(Boolean).join(" · "), href: `/admin/software/${r.id}` })))
        : none,
      has("vendors.view")
        ? db.vendor
            .findMany({ where: { name: like }, take: 4, orderBy: { name: "asc" }, select: { id: true, name: true, verification: true } })
            .then((rows) => rows.map((r): AdminSearchHit => ({ type: "Vendors", label: r.name, meta: r.verification === "VERIFIED" ? "Verified" : null, href: `/admin/vendors/${r.id}` })))
        : none,
      has("categories.view")
        ? db.category
            .findMany({ where: { name: like }, take: 4, orderBy: [{ depth: "asc" }, { name: "asc" }], select: { id: true, name: true, depth: true } })
            .then((rows) => rows.map((r): AdminSearchHit => ({ type: "Categories", label: r.name, meta: r.depth ? "Subcategory" : "Top-level", href: `/admin/categories/${r.id}` })))
        : none,
      has("leads.view")
        ? db.lead
            .findMany({ where: { OR: [{ name: like }, { email: like }, { company: like }, { referenceNo: like }] }, take: 5, orderBy: { createdAt: "desc" }, select: { id: true, name: true, company: true, referenceNo: true } })
            .then((rows) => rows.map((r): AdminSearchHit => ({ type: "Leads", label: r.name, meta: [r.referenceNo, r.company].filter(Boolean).join(" · "), href: `/admin/leads/${r.id}` })))
        : none,
      has("users.view")
        ? db.user
            .findMany({ where: { OR: [{ name: like }, { email: like }] }, take: 4, orderBy: { name: "asc" }, select: { id: true, name: true, email: true } })
            .then((rows) => rows.map((r): AdminSearchHit => ({ type: "Users", label: r.name, meta: r.email, href: `/admin/users/${r.id}` })))
        : none,
      has("cms.pages.view")
        ? db.page
            .findMany({ where: { OR: [{ title: like }, { slug: like }] }, take: 4, orderBy: { title: "asc" }, select: { id: true, title: true, slug: true } })
            .then((rows) => rows.map((r): AdminSearchHit => ({ type: "Pages", label: r.title, meta: `/${r.slug === "home" ? "" : r.slug}`, href: `/admin/cms/pages/${r.id}` })))
        : none,
      has("blog.view")
        ? db.post
            .findMany({ where: { title: like }, take: 4, orderBy: { updatedAt: "desc" }, select: { id: true, title: true, status: true } })
            .then((rows) => rows.map((r): AdminSearchHit => ({ type: "Blog posts", label: r.title, meta: r.status.toLowerCase(), href: `/admin/blog/${r.id}` })))
        : none,
    ]);
    return NextResponse.json({ hits: groups.flat() });
  } catch (e) {
    return errorResponse(e);
  }
}
