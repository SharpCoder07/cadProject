import { Eye, EyeOff, FolderTree, Layers, Plus } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { getAdminCategoryTree } from "@/server/services/categories";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty } from "@/components/admin/list-panel";
import { CategoryTree } from "./tree";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const user = await requirePermission("categories.view", "/admin/categories");
  const [tree, flat, active, inNav] = await Promise.all([
    getAdminCategoryTree(user),
    db.category.findMany({ orderBy: [{ path: "asc" }, { sortOrder: "asc" }], select: { id: true, name: true, depth: true } }),
    db.category.count({ where: { isActive: true } }),
    db.category.count({ where: { isActive: true, showInNav: true } }),
  ]);
  const add = <ButtonLink size="sm" href="/admin/categories/new"><Plus className="h-4 w-4" aria-hidden /> Add category</ButtonLink>;
  return (
    <>
      <PageHeader title="Categories" description="Organise every category on your marketplace." actions={add} />
      <PageStats
        items={[
          { label: "Categories", value: flat.length, icon: FolderTree, tone: "red", sub: `${tree.length} top-level` },
          { label: "Visible", value: active, icon: Eye, tone: "green", sub: "Shown on the website" },
          { label: "Hidden", value: flat.length - active, icon: EyeOff, sub: "Not shown to buyers" },
          { label: "In the header menu", value: inNav, icon: Layers, sub: "Shown in navigation" },
        ]}
      />
      <ListPanel title="Category tree" meta="Drag to reorder · use “Move to” to nest">
        {tree.length === 0 ? (
          <PanelEmpty icon={<FolderTree className="h-5 w-5" />} title="No categories yet" action={<ButtonLink size="sm" href="/admin/categories/new" variant="secondary">Add the first category</ButtonLink>} />
        ) : (
          <div className="bg-bg/40 p-3 sm:p-4">
            <CategoryTree roots={tree} flat={flat} />
          </div>
        )}
      </ListPanel>
    </>
  );
}
