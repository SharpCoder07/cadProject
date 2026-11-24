import { db } from "@/server/db";
import type { Principal } from "@/server/rbac/policy";
import { getCategoryForEdit } from "@/server/services/categories";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryForm } from "./category-form";

export async function CategoryFormPage({ user, id }: { user: Principal; id: string | null }) {
  const [parents, attributes, c] = await Promise.all([
    db.category.findMany({ orderBy: [{ path: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, depth: true } }),
    db.attribute.findMany({ orderBy: { label: "asc" }, select: { id: true, label: true, type: true, isFilterable: true } }),
    id ? getCategoryForEdit(user, id) : Promise.resolve(null),
  ]);
  return (
    <>
      <PageHeader title={c?.name ?? "Add category"} back={{ href: "/admin/categories", label: "Categories" }} />
      <CategoryForm
        id={id}
        parents={parents}
        attributes={attributes}
        previews={{ image: c?.image?.url, banner: c?.banner?.url }}
        defaults={{
          name: c?.name ?? "", slug: c?.slug ?? "", shortName: c?.shortName ?? null, description: c?.description ?? null, content: c?.content ?? "", icon: c?.icon ?? null,
          parentId: c?.parentId ?? null, isActive: c?.isActive ?? true, showInNav: c?.showInNav ?? true, imageId: c?.imageId ?? null, bannerId: c?.bannerId ?? null,
          layout: c?.layout ?? {},
          featuredSoftwareIds: c?.featured.map((f) => f.softwareId) ?? [],
          attributes: c?.attributes.map((a) => ({ attributeId: a.attributeId, isFilter: a.isFilter })) ?? [],
          seo: { title: c?.seo?.title ?? null, description: c?.seo?.description ?? null, keywords: c?.seo?.keywords ?? null, canonicalUrl: c?.seo?.canonicalUrl ?? null, noIndex: c?.seo?.noIndex ?? false, ogImageId: c?.seo?.ogImageId ?? null },
        }}
      />
    </>
  );
}
