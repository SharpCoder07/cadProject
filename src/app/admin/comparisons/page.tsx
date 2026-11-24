import Link from "next/link";
import { Columns3, ExternalLink, FilePen, Globe, Package } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { buttonClass } from "@/components/ui/button";
import { PageStats } from "@/components/admin/page-stats";
import { SEO_CRUD_FIELDS, SEO_EMPTY, seoValues } from "@/components/admin/seo-crud";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { deleteComparisonAction, saveComparisonAction } from "../reviews/actions";
import { readSections } from "@/lib/comparison-sections";

export const metadata = { title: "Comparisons" };

export default async function ComparisonsAdmin() {
  await requirePermission("comparisons.view", "/admin/comparisons");
  const items = await db.comparisonPage.findMany({
    orderBy: { updatedAt: "desc" },
    include: { seo: { include: { ogImage: { select: { url: true } } } }, items: { orderBy: { sortOrder: "asc" }, select: { softwareId: true, software: { select: { name: true, logo: { select: { url: true } } } } } } },
  });
  const published = items.filter((c) => c.status === "PUBLISHED").length;
  const drafts = items.filter((c) => c.status === "DRAFT" || c.status === "IN_REVIEW").length;
  const products = new Set(items.flatMap((c) => c.items.map((i) => i.softwareId))).size;

  return (
    <>
      <PageHeader title="Comparisons" description="Manage every head-to-head comparison on your marketplace." actions={<><Link href="/admin/comparisons/showcase" className={buttonClass("secondary", "sm")}>Compare page lists</Link><CrudAddButton entity="comparison" label="Add comparison" /></>} />
      <PageStats
        items={[
          { label: "Comparisons", value: items.length, icon: Columns3, tone: "red", sub: "Curated pages in total" },
          { label: "Published", value: published, icon: Globe, tone: "green", sub: "Live on the website" },
          { label: "Drafts", value: drafts, icon: FilePen, tone: drafts ? "amber" : "neutral", sub: drafts ? "Not visible yet" : "Nothing waiting" },
          { label: "Products compared", value: products, icon: Package, sub: "Different products used" },
        ]}
      />
      <CrudManager
        addInHeader
        entity="comparison"
        newLabel="Add comparison"
        columns={["Comparison", "Products", "Updated", "Status"]}
        rows={items.map((c) => ({
          id: c.id,
          searchText: `${c.title} ${c.slug} ${c.items.map((i) => i.software.name).join(" ")}`,
          cells: [
            <div key="t" className="flex min-w-0 items-center gap-3">
              <span className="flex shrink-0 -space-x-2">
                {c.items.slice(0, 3).map((i, n) =>
                  i.software.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small logo
                    <img key={n} src={i.software.logo.url} alt="" className="h-8 w-8 rounded-full border-2 border-surface bg-white object-contain shadow-sm" />
                  ) : (
                    <span key={n} className="grid h-8 w-8 place-items-center rounded-full border-2 border-surface bg-mint-soft text-[11px] font-bold text-mint-ink">{i.software.name.slice(0, 1)}</span>
                  ),
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{c.title}</span>
                {c.status === "PUBLISHED" ? (
                  <Link href={`/compare/${c.slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-muted hover:text-mint-ink">/compare/{c.slug} <ExternalLink className="h-3 w-3" aria-hidden /></Link>
                ) : (
                  <span className="block truncate text-xs text-muted">/compare/{c.slug}</span>
                )}
              </span>
            </div>,
            c.items.map((i) => i.software.name).join(" vs ") || null,
            formatDate(c.updatedAt),
            c.status === "IN_REVIEW" ? "in review" : c.status.toLowerCase(),
          ],
          values: { title: c.title, slug: c.slug, intro: c.intro ?? "", verdict: c.verdict ?? "", sections: readSections(c.sections), softwareIds: c.items.map((i) => i.softwareId), status: c.status === "IN_REVIEW" ? "DRAFT" : c.status, ...seoValues(c.seo) },
        }))}
        fields={[
          { name: "title", label: "Title", type: "text", required: true, wide: true, placeholder: "Tally Prime vs Zoho Books" },
          { name: "slug", label: "URL slug", type: "text", placeholder: "Leave empty for product-a-vs-product-b", hint: "Leave empty to use the products’ own comparison address (/compare/a-vs-b, in alphabetical order). Published comparisons are the ones search engines index." },
          { name: "status", label: "Status", type: "select", options: [{ value: "DRAFT", label: "Draft" }, { value: "PUBLISHED", label: "Published" }, { value: "ARCHIVED", label: "Archived" }] },
          { name: "softwareIds", label: "Products (2–4, in order)", type: "pickers", picker: "software", wide: true },
          { name: "intro", label: "Introduction", type: "rich", hint: "Shown first, below the comparison table." },
          { name: "sections", label: "Sections below the table", type: "comparisonSections", hint: "Headings, text, images, videos, FAQs and calls to action for this comparison only, shown after the introduction, in this order." },
          { name: "verdict", label: "Verdict", type: "rich", hint: "Shown after the sections." },
          ...SEO_CRUD_FIELDS,
        ]}
        emptyValues={{ title: "", slug: "", status: "DRAFT", softwareIds: [], intro: "", verdict: "", sections: [], ...SEO_EMPTY }}
        emptyText="No comparisons yet"
        save={saveComparisonAction}
        remove={deleteComparisonAction}
        dialogSize="xl"
      />
    </>
  );
}
