import type { Metadata } from "next";
import { db } from "@/server/db";
import { getCategoryTree, type CategoryNode } from "@/server/services/categories";
import { buildMetadata } from "@/server/seo/metadata";
import { CategoryCascade, type CascadeCategory } from "@/components/site/category-cascade";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return buildMetadata({ path: "/categories", title: t("categories.seoTitle"), description: t("categories.seoDescription") });
}

/**
 * Products in a category and everything under it, each product counted once — the same number the category's
 * own page shows (a product listed in two subcategories is still one product).
 */
async function subtreeCounts(tree: CategoryNode[]): Promise<Map<string, number>> {
  const links = await db.softwareCategory.findMany({ where: { software: { status: "PUBLISHED" } }, select: { categoryId: true, softwareId: true } });
  const byCategory = new Map<string, string[]>();
  for (const l of links) byCategory.set(l.categoryId, [...(byCategory.get(l.categoryId) ?? []), l.softwareId]);
  const collect = (c: CategoryNode, into: Set<string>) => {
    for (const id of byCategory.get(c.id) ?? []) into.add(id);
    for (const ch of c.children) collect(ch, into);
    return into;
  };
  return new Map(tree.map((c) => [c.id, collect(c, new Set()).size]));
}

function flatSubs(c: CategoryNode): { id: string; name: string; slug: string }[] {
  return c.children.flatMap((ch) => [{ id: ch.id, name: ch.name, slug: ch.slug }, ...flatSubs(ch)]);
}

export default async function CategoriesIndex() {
  const [tree, t] = await Promise.all([getCategoryTree(), getT()]);
  const counts = await subtreeCounts(tree);
  const items: CascadeCategory[] = tree.map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon, count: counts.get(c.id) ?? 0, subs: flatSubs(c) }));
  return (
    <EditRegion label="All categories" actions={[{ label: "Edit categories", href: "/admin/categories" }, { label: "Wording", href: "/admin/cms/texts?group=categories" }]}>
    <div className="container py-8 sm:py-10">
      <Breadcrumbs items={[{ name: t("categories.breadcrumb"), path: "/categories" }]} />
      <h1 className="mt-4 text-[2rem] font-bold tracking-[-0.02em] sm:text-[2.6rem]">{t("categories.heading")}</h1>
      <p className="mt-2 max-w-2xl text-base text-muted">{t("categories.intro", { count: items.length })}</p>
      <CategoryCascade items={items} />
    </div>
    </EditRegion>
  );
}
