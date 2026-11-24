import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { errorResponse } from "@/server/http";
import { AppError } from "@/server/errors";

/** Typeahead for admin relation pickers (software, vendors, categories, pages, users). */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Sign in to continue.", "UNAUTHENTICATED");
    // Vendor-portal users may look up public taxonomy and published products only.
    const isVendor = Boolean(user.vendorId);
    const canBrowse = isVendor ? user.permissions.has("vendor.listings") || user.permissions.has("vendor.authorised") : user.permissions.has("software.view");
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().slice(0, 60);
    const type = sp.get("type");
    const ids = (sp.get("ids") ?? "").split(",").filter(Boolean).slice(0, 50);
    const where = (field: string) => (ids.length ? { id: { in: ids } } : q ? { [field]: { contains: q, mode: "insensitive" as const } } : {});
    let items: { id: string; label: string; meta?: string | null }[] = [];
    if (type === "software" && canBrowse) {
      const rows = await db.software.findMany({ where: { ...where("name"), ...(isVendor ? { status: "PUBLISHED" as const } : {}) }, take: 20, orderBy: { popularityScore: "desc" }, select: { id: true, name: true, status: true, vendor: { select: { name: true } } } });
      items = rows.map((r) => ({ id: r.id, label: r.name, meta: [r.vendor?.name, r.status !== "PUBLISHED" ? r.status.toLowerCase() : null].filter(Boolean).join(" · ") }));
    } else if (type === "vendor" && canBrowse && !isVendor) {
      const rows = await db.vendor.findMany({ where: { ...where("name"), kind: sp.get("kind") === "RESELLER" ? ("RESELLER" as const) : ("VENDOR" as const) }, take: 20, orderBy: { name: "asc" }, select: { id: true, name: true } });
      items = rows.map((r) => ({ id: r.id, label: r.name }));
    } else if (type === "brand" && canBrowse) {
      const rows = await db.brand.findMany({ where: { ...where("name"), ...(isVendor ? { isActive: true } : {}) }, take: 20, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, logoId: true } });
      items = rows.map((r) => ({ id: r.id, label: r.name, meta: r.logoId ? null : "No logo yet" }));
    } else if (type === "category" && canBrowse) {
      const rows = await db.category.findMany({ where: where("name"), take: 30, orderBy: [{ depth: "asc" }, { name: "asc" }], select: { id: true, name: true, depth: true } });
      items = rows.map((r) => ({ id: r.id, label: r.name, meta: r.depth ? "Subcategory" : null }));
    } else if (type === "page" && !isVendor && user.permissions.has("cms.navigation")) {
      const rows = await db.page.findMany({ where: where("title"), take: 20, select: { id: true, title: true, slug: true } });
      items = rows.map((r) => ({ id: r.id, label: r.title, meta: `/${r.slug}` }));
    } else if (type === "industry" && canBrowse) {
      const rows = await db.industry.findMany({ where: where("name"), take: 30, select: { id: true, name: true } });
      items = rows.map((r) => ({ id: r.id, label: r.name }));
    } else {
      throw new AppError("You don't have access to that list.", "FORBIDDEN");
    }
    return NextResponse.json({ items });
  } catch (e) {
    return errorResponse(e);
  }
}
