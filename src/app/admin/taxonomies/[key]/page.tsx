import { notFound } from "next/navigation";
import { Eye, EyeOff, Package, Tags } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listTermsAdmin, parseFaqs } from "@/server/services/taxonomies";
import { TAXONOMY_BY_KEY, taxonomyDef } from "@/lib/taxonomies";
import { getSettings } from "@/server/settings";
import { Alert } from "@/components/ui/misc";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { TermsHeaderActions, TermsManager } from "./terms-manager";

type Props = { params: Promise<{ key: string }>; searchParams: Promise<{ q?: string; page?: string }> };

export async function generateMetadata({ params }: Props) {
  const def = TAXONOMY_BY_KEY[(await params).key];
  return { title: def?.plural ?? "Classifications" };
}
export const dynamic = "force-dynamic";

export default async function TaxonomyAdmin({ params, searchParams }: Props) {
  const { key } = await params;
  const base = TAXONOMY_BY_KEY[key];
  if (!base) notFound();
  const def = taxonomyDef(base.kind, (await getSettings()).taxonomies);
  const user = await requirePermission("taxonomy.view", `/admin/taxonomies/${key}`);
  const sp = await searchParams;
  const [data, active, tagged] = await Promise.all([
    listTermsAdmin(user, def.kind, { search: sp.q?.trim() || undefined, page: Number(sp.page) || 1 }),
    db.taxonomyTerm.count({ where: { kind: def.kind, isActive: true } }),
    db.software.count({ where: { terms: { some: { term: { kind: def.kind } } } } }),
  ]);
  const all = data.all.length;
  return (
    <>
      <PageHeader title={def.plural} description={def.help} actions={<TermsHeaderActions kind={def.kind} singular={def.singular} />} />
      {!def.enabled && (
        <Alert tone="warning" title="This list is switched off" className="mb-4">
          Its pages aren&apos;t on the website and it doesn&apos;t show on product pages. Switch it on in <Link href="/admin/settings?tab=taxonomies" className="underline">Website settings › Classification lists</Link>.
        </Alert>
      )}
      <PageStats
        items={[
          { label: def.plural, value: all, icon: Tags, tone: "red", sub: "In total" },
          { label: "Visible", value: active, icon: Eye, tone: "green", sub: "Have a public page" },
          { label: "Hidden", value: all - active, icon: EyeOff, sub: "Not shown to buyers" },
          { label: "Products tagged", value: tagged, icon: Package, sub: `Have at least one ${def.singular.toLowerCase()}` },
        ]}
      />
      <TermsManager
        def={def}
        search={sp.q ?? ""}
        page={data.page}
        pages={data.pages}
        total={data.total}
        parents={data.all.map((t) => ({ id: t.id, name: t.name, parentId: t.parentId }))}
        rows={data.items.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          parentId: t.parentId,
          parentName: t.parent?.name ?? null,
          description: t.description ?? "",
          headline: t.headline ?? "",
          content: t.content ?? "",
          sortOrder: t.sortOrder,
          isActive: t.isActive,
          promotedSoftwareId: t.promotedSoftwareId,
          promotedName: t.promotedSoftware?.name ?? null,
          promotedBadge: t.promotedBadge ?? "",
          faqs: parseFaqs(t.faqs),
          seoTitle: t.seoTitle ?? "",
          seoDescription: t.seoDescription ?? "",
          noIndex: t.noIndex,
          count: t._count.software,
          children: t._count.children,
        }))}
      />
    </>
  );
}
