import { Eye, EyeOff, Factory, Package } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { PageStats } from "@/components/admin/page-stats";
import { SEO_CRUD_FIELDS, SEO_EMPTY, seoValues } from "@/components/admin/seo-crud";
import { ItemTitle } from "@/components/admin/list-panel";

import { ICON_NAMES } from "@/components/ui/icon";
import { deleteIndustryAction, saveIndustryAction } from "../attributes/actions";

export const metadata = { title: "Industries" };

export default async function IndustriesAdmin() {
  await requirePermission("taxonomy.view", "/admin/industries");
  const items = await db.industry.findMany({ orderBy: { sortOrder: "asc" }, include: { seo: { include: { ogImage: { select: { url: true } } } }, image: { select: { url: true } }, _count: { select: { software: true } } } });
  const visible = items.filter((i) => i.isActive).length;
  return (
    <>
      <PageHeader title="Industries" description="Manage every industry landing page on your marketplace." actions={<CrudAddButton entity="industry" label="Add industry" />} />
      <PageStats
        items={[
          { label: "Industries", value: items.length, icon: Factory, tone: "red", sub: "Landing pages in total" },
          { label: "Visible", value: visible, icon: Eye, tone: "green", sub: "Live on the website" },
          { label: "Hidden", value: items.length - visible, icon: EyeOff, sub: "Not shown to buyers" },
          { label: "Products tagged", value: items.reduce((n, i) => n + i._count.software, 0), icon: Package, sub: "Across all industries" },
        ]}
      />
      <CrudManager
        addInHeader
        entity="industry"
        newLabel="Add industry"
        columns={["Industry", "Products"]}
        rows={items.map((i) => ({ id: i.id, active: i.isActive, name: i.name, searchText: `${i.name} ${i.slug}`, cells: [<ItemTitle key="t" image={i.image?.url} title={i.name} sub={`/industries/${i.slug}`} />, String(i._count.software)], values: { name: i.name, slug: i.slug, description: i.description, content: i.content ?? "", icon: i.icon, imageId: i.imageId, _image: i.image?.url, isActive: i.isActive, ...seoValues(i.seo) } }))}
        fields={[
          { name: "name", label: "Name", type: "text", required: true },
          { name: "slug", label: "URL slug", type: "text", required: true },
          { name: "icon", label: "Icon", type: "select", options: [{ value: "", label: "Default" }, ...ICON_NAMES.map((n) => ({ value: n, label: n }))] },
          { name: "imageId", label: "Image", type: "media", previewKey: "_image" },
          { name: "description", label: "Short description", type: "textarea" },
          { name: "content", label: "Page content", type: "rich" },
          { name: "isActive", label: "Visible on the website", type: "switch" },
          ...SEO_CRUD_FIELDS,
        ]}
        emptyValues={{ name: "", slug: "", isActive: true, content: "", ...SEO_EMPTY }}
        save={saveIndustryAction}
        remove={deleteIndustryAction}
        dialogSize="xl"
      />
    </>
  );
}
