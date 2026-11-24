import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Clock, ExternalLink, Inbox, Package, Pencil, Plus, Search, Star } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listSoftwareAdmin } from "@/server/services/software";
import { formatNumber, toNumber, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { FilterBar, PageHeader, StatusBadge } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { SoftwareBulkActions } from "./bulk-actions";

export const metadata = { title: "All products" };
type SP = Record<string, string | undefined>;

const TABS = [
  { key: "ALL", label: "All" },
  { key: "PUBLISHED", label: "Published" },
  { key: "DRAFT", label: "Drafts" },
  { key: "IN_REVIEW", label: "In review" },
  { key: "ARCHIVED", label: "Archived" },
] as const;

const FLAG_PILLS = [
  ["isFeatured", "Featured", "bg-mint-soft text-mint-ink"],
  ["isPopular", "Popular", "bg-bg text-ink/70 ring-1 ring-line"],
  ["isTrending", "Trending", "bg-accent/10 text-accent"],
  ["isRecommended", "Recommended", "bg-success/10 text-success"],
  ["isSponsored", "Sponsored", "bg-warning/10 text-warning"],
] as const;

const SELECT = "w-full max-w-[11rem] appearance-none truncate rounded-control border border-line bg-surface pl-3 pr-8 text-sm text-ink outline-none transition hover:border-ink/20 focus:border-mint focus:ring-4 focus:ring-mint-soft";

function Dropdown({ name, label, value, children }: { name: string; label: string; value?: string; children: React.ReactNode }) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value ?? ""} aria-label={label} className={SELECT}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </label>
  );
}

/** All products: KPI cards, then one panel with status tabs, live filters, bulk actions, the product table and pages. */
export default async function SoftwareList({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("software.view", "/admin/software");
  const sp = await searchParams;
  const [data, categories, vendors, leads] = await Promise.all([
    listSoftwareAdmin(user, sp),
    db.category.findMany({ orderBy: [{ depth: "asc" }, { name: "asc" }], select: { id: true, name: true, depth: true } }),
    db.vendor.findMany({ where: { kind: "VENDOR" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.software.aggregate({ _sum: { enquiryCount: true } }),
  ]);
  const { items, query: q, statusCounts } = data;
  const total = Object.values(statusCounts).reduce((a, b) => a + (b ?? 0), 0);
  const tabHref = (status: string) => {
    const p = new URLSearchParams(Object.entries({ ...sp, status, page: undefined }).filter(([, v]) => v) as [string, string][]);
    return `/admin/software?${p.toString()}`;
  };
  const can = (p: Parameters<typeof user.permissions.has>[0]) => user.permissions.has(p);
  const from = data.total ? (data.page - 1) * data.perPage + 1 : 0;
  const to = Math.min(data.page * data.perPage, data.total);
  const inReview = statusCounts.IN_REVIEW ?? 0;

  return (
    <SelectionProvider>
      <PageHeader
        title="All products"
        description="Manage every software listing on your marketplace."
        actions={can("software.create") && <ButtonLink size="sm" href="/admin/software/new"><Plus className="h-4 w-4" aria-hidden /> Add software</ButtonLink>}
      />
      <PageStats
        items={[
          { label: "Total listings", value: formatNumber(total), icon: Package, tone: "red", sub: `${formatNumber(statusCounts.DRAFT ?? 0)} drafts · ${formatNumber(statusCounts.ARCHIVED ?? 0)} archived`, href: tabHref("ALL") },
          { label: "Published", value: formatNumber(statusCounts.PUBLISHED ?? 0), icon: ExternalLink, tone: "green", sub: "Live on the website", href: tabHref("PUBLISHED") },
          { label: "Waiting for review", value: formatNumber(inReview), icon: Clock, tone: inReview ? "amber" : "neutral", sub: inReview ? "Submitted by your team" : "Nothing waiting", href: tabHref("IN_REVIEW") },
          { label: "Product enquiries", value: formatNumber(leads._sum.enquiryCount ?? 0), icon: Inbox, sub: "1 lead counts once per product it asks about", href: "/admin/leads" },
        ]}
      />

      {/* Bulk bar above the list, like every other admin list. */}
      <SoftwareBulkActions canPublish={can("software.publish")} canDelete={can("software.delete")} canEdit={can("software.edit")} />

      <section className="overflow-hidden rounded-[20px] border border-line/80 bg-surface shadow-[0_1px_2px_rgb(var(--color-ink)/0.04),0_12px_32px_-24px_rgb(var(--color-ink)/0.25)]">
        {/* Status tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <nav aria-label="Status" className="flex gap-1 overflow-x-auto rounded-xl bg-bg p-1">
            {TABS.map((t) => {
              const count = t.key === "ALL" ? total : statusCounts[t.key] ?? 0;
              const active = q.status === t.key;
              return (
                <Link
                  key={t.key}
                  href={tabHref(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition", active ? "bg-surface font-semibold text-ink shadow-[0_1px_3px_rgb(16_24_40/0.1)] ring-1 ring-line" : "text-muted hover:text-ink")}
                >
                  {t.label}
                  <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", active ? "bg-mint-soft text-mint-ink" : "bg-surface text-muted")}>{count}</span>
                </Link>
              );
            })}
          </nav>
          <p className="text-xs text-muted">{data.total ? `Showing ${from}–${to} of ${formatNumber(data.total)}` : "No listings"}</p>
        </div>

        {/* Filters (update as you type / choose) */}
        <div className="border-b border-line bg-bg/40 px-4 py-3 sm:px-5">
          <FilterBar action="/admin/software" bare oneLine>
            <input type="hidden" name="status" value={q.status} />
            <label className="relative min-w-[12rem] flex-1">
              <span className="sr-only">Search products</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input name="q" defaultValue={q.q} placeholder="Search by name, slug or vendor…" className="w-full rounded-control border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft" />
            </label>
            <Dropdown name="categoryId" label="Category" value={q.categoryId}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>)}
            </Dropdown>
            <Dropdown name="vendorId" label="Vendor" value={q.vendorId}>
              <option value="">All vendors</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </Dropdown>
            <Dropdown name="flag" label="Flag" value={q.flag}>
              <option value="">Any flag</option>
              <option value="isFeatured">Featured</option><option value="isPopular">Popular</option><option value="isTrending">Trending</option><option value="isRecommended">Recommended</option><option value="isSponsored">Sponsored</option>
            </Dropdown>
            <Dropdown name="sort" label="Sort" value={q.sort}>
              <option value="updated">Recently updated</option><option value="created">Newest</option><option value="name">Name A–Z</option><option value="popular">Most popular</option>
            </Dropdown>
          </FilterBar>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="No listings match"
            icon={<span className="grid h-12 w-12 place-items-center rounded-2xl bg-bg ring-1 ring-line"><Package className="h-5 w-5" /></span>}
            action={can("software.create") ? <ButtonLink size="sm" href="/admin/software/new" variant="secondary"><Plus className="h-4 w-4" aria-hidden /> Add software</ButtonLink> : undefined}
          >
            Change the filters, or add a new listing.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-bg/60 text-xs font-semibold uppercase tracking-[0.05em] text-muted [&>th]:whitespace-nowrap [&>th]:px-4 [&>th]:py-2.5 sm:[&>th]:px-5">
                  <th className="w-10"><AllCheckbox ids={items.map((i) => i.id)} /></th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Category</th>
                  <th>Rating</th>
                  <th>Flags</th>
                  <th className="text-right">Leads</th>
                  <th>Updated</th>
                  <th className="w-20"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((sw) => {
                  const r = toNumber(sw.ratingAvg) ?? 0;
                  return (
                    <tr key={sw.id} className="group transition-colors hover:bg-bg/60 [&>td]:px-4 [&>td]:py-3 sm:[&>td]:px-5">
                      <td><RowCheckbox id={sw.id} label={sw.name} /></td>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                            {sw.logo ? <Image src={sw.logo.url} alt="" fill className="object-contain p-1" sizes="40px" /> : <span className="text-sm font-bold text-primary">{sw.name.slice(0, 1)}</span>}
                          </span>
                          <span className="min-w-0">
                            <Link href={`/admin/software/${sw.id}`} className="block max-w-[18rem] truncate font-semibold text-ink hover:text-mint-ink">{sw.name}</Link>
                            <span className="block max-w-[18rem] truncate text-xs text-muted">{sw.vendor?.name ?? "No vendor"} · /{sw.slug}</span>
                          </span>
                        </div>
                      </td>
                      <td><StatusBadge status={sw.status} scheduledAt={sw.scheduledAt} /></td>
                      <td className="max-w-[12rem] truncate text-muted">{sw.primaryCategory?.name ?? "—"}</td>
                      <td className="whitespace-nowrap">
                        {sw.ratingCount ? (
                          <span className="inline-flex items-center gap-1 text-ink">
                            <Star className="h-3.5 w-3.5 text-accent" fill="currentColor" strokeWidth={0} aria-hidden />
                            <span className="font-semibold tabular-nums">{r.toFixed(1)}</span>
                            <span className="text-xs text-muted">({sw.ratingCount})</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted">No reviews</span>
                        )}
                      </td>
                      <td>
                        <div className="flex max-w-[14rem] flex-wrap gap-1">
                          {FLAG_PILLS.filter(([k]) => sw[k]).map(([k, label, cls]) => (
                            <span key={k} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", cls)}>{label}</span>
                          ))}
                          {!FLAG_PILLS.some(([k]) => sw[k]) && <span className="text-muted/60">—</span>}
                        </div>
                      </td>
                      <td className="text-right font-semibold tabular-nums text-ink">{formatNumber(sw.enquiryCount)}</td>
                      <td className="whitespace-nowrap text-muted">{formatDateTime(sw.updatedAt)}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <Link href={`/admin/software/${sw.id}`} title="Edit" aria-label={`Edit ${sw.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 transition hover:bg-surface hover:text-ink hover:shadow-[0_1px_3px_rgb(16_24_40/0.08)] hover:ring-1 hover:ring-line">
                            <Pencil className="h-4 w-4" />
                          </Link>
                          {sw.status === "PUBLISHED" ? (
                            <Link href={`/software/${sw.slug}`} target="_blank" title="View on website" aria-label={`View ${sw.name} on the website`} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 transition hover:bg-surface hover:text-ink hover:shadow-[0_1px_3px_rgb(16_24_40/0.08)] hover:ring-1 hover:ring-line">
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          ) : (
                            <Link href={`/software/${sw.slug}?preview=1`} target="_blank" title="Preview" aria-label={`Preview ${sw.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-ink/50 transition hover:bg-surface hover:text-ink hover:shadow-[0_1px_3px_rgb(16_24_40/0.08)] hover:ring-1 hover:ring-line">
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data.pages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
            <p className="text-xs text-muted">Page {data.page} of {data.pages}</p>
            <Pagination page={data.page} pages={data.pages} basePath="/admin/software" params={sp} />
          </div>
        )}
      </section>
    </SelectionProvider>
  );
}
