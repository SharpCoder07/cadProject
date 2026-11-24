import { Building2, ImageOff, Package, Tags } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { PageStats } from "@/components/admin/page-stats";
import { SEO_CRUD_FIELDS, SEO_EMPTY, seoValues } from "@/components/admin/seo-crud";
import { ItemTitle } from "@/components/admin/list-panel";

import { deleteBrandAction, saveBrandAction } from "../vendors/actions";

export const metadata = { title: "Brands" };

/**
 * Software brands (Autodesk, Tally, Zoho…). Standalone: a brand doesn't need a vendor, and any
 * product can be given a brand in its editor. Brand logos feed the homepage "Top software brands"
 * strip and the public /brands pages.
 */
export default async function BrandsAdmin() {
  await requirePermission("vendors.view", "/admin/brands");
  const [brands, vendors] = await Promise.all([
    db.brand.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { seo: { include: { ogImage: { select: { url: true } } } }, logo: { select: { url: true } }, vendor: { select: { name: true } }, _count: { select: { software: true } } },
    }),
    db.vendor.findMany({ where: { kind: "VENDOR" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const withLogo = brands.filter((b) => b.logo).length;
  const owned = brands.filter((b) => b.vendor).length;
  const products = brands.reduce((n, b) => n + b._count.software, 0);
  return (
    <>
      <PageHeader
        title="Brands"
        description="Manage every software brand and its logo." actions={<CrudAddButton entity="brand" label="Add brand" />} />
      <PageStats
        items={[
          { label: "Brands", value: brands.length, icon: Tags, tone: "red", sub: `${brands.filter((b) => b.isActive).length} visible on the website` },
          { label: "Products", value: products, icon: Package, tone: "green", sub: "Linked to a brand" },
          { label: "Missing logo", value: brands.length - withLogo, icon: ImageOff, tone: brands.length - withLogo ? "amber" : "neutral", sub: brands.length - withLogo ? "Not shown in the logo strip" : "Every brand has a logo" },
          { label: "Owned by vendors", value: owned, icon: Building2, sub: "Linked to a vendor account" },
        ]}
      />
      <CrudManager
        addInHeader
        entity="brand"
        newLabel="Add brand"
        columns={["Brand", "Owned by", "Products", "Logo"]}
        rows={brands.map((b) => ({
          id: b.id,
          active: b.isActive,
          name: b.name,
          searchText: `${b.name} ${b.slug} ${b.vendor?.name ?? ""}`,
          cells: [<ItemTitle key="t" image={b.logo?.url} title={b.name} sub={`/brands/${b.slug}`} />, b.vendor?.name ?? "—", String(b._count.software), b.logo ? "Uploaded" : "Missing"],
          values: { name: b.name, slug: b.slug, description: b.description, website: b.website, vendorId: b.vendorId ?? "", logoId: b.logoId, _logo: b.logo?.url, isActive: b.isActive, sortOrder: b.sortOrder, ...seoValues(b.seo) },
        }))}
        fields={[
          { name: "name", label: "Brand name", type: "text", required: true, placeholder: "Autodesk" },
          { name: "slug", label: "URL slug", type: "text", required: true, hint: "Brand page address: /brands/<slug>" },
          { name: "logoId", label: "Logo", type: "media", previewKey: "_logo", hint: "PNG or SVG with a transparent background, about 300×120 px." },
          { name: "website", label: "Website", type: "text", placeholder: "https://" },
          { name: "description", label: "About the brand", type: "textarea" },
          { name: "vendorId", label: "Owned by vendor (optional)", type: "select", options: [{ value: "", label: "Not linked to a vendor" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))], hint: "Link it if a vendor on the platform owns this brand." },
          { name: "sortOrder", label: "Display order", type: "number", hint: "Lower numbers show first in the logo strip and on /brands." },
          { name: "isActive", label: "Visible on the website", type: "switch" },
          ...SEO_CRUD_FIELDS,
        ]}
        emptyValues={{ name: "", slug: "", vendorId: "", isActive: true, sortOrder: 0, ...SEO_EMPTY }}
        save={saveBrandAction}
        remove={deleteBrandAction}
      />
    </>
  );
}
