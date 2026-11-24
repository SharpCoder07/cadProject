import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { buildMetadata } from "@/server/seo/metadata";
import { Icon } from "@/components/ui/icon";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { InstantFilter } from "@/components/site/instant-filter";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return buildMetadata({ path: "/industries", title: t("industries.seoTitle"), description: t("industries.seoDescription") });
}

export default async function IndustriesIndex() {
  const t = await getT();
  const industries = await db.industry.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, slug: true, icon: true, description: true } });
  return (
    <EditRegion label="All industries" live={{ kind: "industries", id: "all", section: "all", title: "Industries" }} actions={[{ label: "Open in admin", href: "/admin/industries" }, { label: "Wording", href: "/admin/cms/texts?group=industries" }]}>
    <div className="container py-8">
      <Breadcrumbs items={[{ name: t("industries.breadcrumb"), path: "/industries" }]} />
      <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{t("industries.heading")}</h1>
      <InstantFilter placeholder={t("industries.search")} scopeHref="/industries" scopeLabel={t("industries.breadcrumb")} className="mt-5">
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((i) => (
            <li key={i.id} data-filter={`${i.name} ${i.description ?? ""}`}>
              <Link href={`/industries/${i.slug}`} className="flex h-full gap-3 rounded-panel border border-line bg-surface p-5 hover:border-primary/40">
                <Icon name={i.icon} className="h-6 w-6 shrink-0 text-primary" />
                <span>
                  <span className="block font-semibold">{i.name}</span>
                  {i.description && <span className="mt-1 block text-sm text-muted">{i.description}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </InstantFilter>
    </div>
    </EditRegion>
  );
}
