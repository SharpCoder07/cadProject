import { FileText, FolderOpen, FolderX } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { PageStats } from "@/components/admin/page-stats";
import { ItemTitle } from "@/components/admin/list-panel";

import { deleteBlogCategoryAction, saveBlogCategoryAction } from "../actions";

export const metadata = { title: "Blog categories" };

export default async function BlogCategoriesPage() {
  await requirePermission("blog.view", "/admin/blog/categories");
  const cats = await db.blogCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { posts: true } } } });
  return (
    <>
      <PageHeader title="Blog categories" description="Organise your blog posts into topics." actions={<CrudAddButton entity="category" label="Add category" />} />
      <PageStats
        items={[
          { label: "Categories", value: cats.length, icon: FolderOpen, tone: "red", sub: "Blog topics" },
          { label: "Posts", value: cats.reduce((n, c) => n + c._count.posts, 0), icon: FileText, tone: "green", sub: "Filed under a category" },
          { label: "Empty", value: cats.filter((c) => c._count.posts === 0).length, icon: FolderX, sub: "No posts yet" },
        ]}
      />
      <CrudManager
        addInHeader
        entity="category" newLabel="Add category" columns={["Category", "Posts"]}
        rows={cats.map((c) => ({ id: c.id, name: c.name, searchText: `${c.name} ${c.slug}`, cells: [<ItemTitle key="t" icon={<FolderOpen className="h-4 w-4" />} title={c.name} sub={`/blog?category=${c.slug}`} />, String(c._count.posts)], values: { name: c.name, slug: c.slug, description: c.description } }))}
        fields={[{ name: "name", label: "Name", type: "text", required: true }, { name: "slug", label: "URL slug", type: "text", required: true }, { name: "description", label: "Description", type: "textarea" }]}
        emptyValues={{ name: "", slug: "" }} save={saveBlogCategoryAction} remove={deleteBlogCategoryAction}
      />
    </>
  );
}
