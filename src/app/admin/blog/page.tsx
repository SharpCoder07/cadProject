import Link from "next/link";
import { BookOpen, ExternalLink, FilePen, Globe, Pencil, Plus, Star } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { formatNumber, formatDateTime } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { AdminTable, FilterBar, PageHeader, StatusBadge } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { deletePostAction, setPostStatusAction } from "./actions";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, ROW_ICON, SearchField, SelectField, showing } from "@/components/admin/list-panel";

export const metadata = { title: "Blog" };
const PER_PAGE = 25;
const TYPE_LABEL = { ARTICLE: "Article", GUIDE: "Buying guide", NEWS: "News", RESOURCE: "Resource" } as const;
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export default async function BlogAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; type?: string; page?: string }> }) {
  await requirePermission("blog.view", "/admin/blog");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const status = STATUSES.find((s) => s === sp.status);
  const type = (Object.keys(TYPE_LABEL) as (keyof typeof TYPE_LABEL)[]).find((t) => t === sp.type);
  const where = {
    ...(sp.q ? { title: { contains: sp.q, mode: "insensitive" as const } } : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };
  const [posts, total, byStatus, guides, featured] = await Promise.all([
    db.post.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { author: { select: { name: true } }, category: { select: { name: true } }, cover: { select: { url: true } } } }),
    db.post.count({ where }),
    db.post.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    db.post.count({ where: { type: "GUIDE", status: "PUBLISHED" } }),
    db.post.count({ where: { isFeatured: true, status: "PUBLISHED" } }),
  ]);
  const count = (s?: string) => byStatus.filter((b) => !s || b.status === s).reduce((n, b) => n + (typeof b._count === "object" ? b._count._all ?? 0 : 0), 0);
  const href = (st?: string) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, type: sp.type, status: st }).filter(([, x]) => x) as [string, string][]);
    return p.toString() ? `/admin/blog?${p}` : "/admin/blog";
  };
  return (
    <SelectionProvider>
      <PageHeader
        title="Blog"
        description="Manage every article, buying guide and news post."
        actions={<ButtonLink size="sm" href="/admin/blog/new"><Plus className="h-4 w-4" aria-hidden /> New post</ButtonLink>}
      />
      <PageStats
        items={[
          { label: "Posts", value: formatNumber(count()), icon: BookOpen, tone: "red", sub: "Articles, guides and news" },
          { label: "Published", value: formatNumber(count("PUBLISHED")), icon: Globe, tone: "green", sub: "Live on the blog", href: href("PUBLISHED") },
          { label: "Drafts", value: formatNumber(count("DRAFT")), icon: FilePen, tone: count("DRAFT") ? "amber" : "neutral", sub: count("DRAFT") ? "Not published yet" : "Nothing in progress", href: href("DRAFT") },
          { label: "Buying guides", value: formatNumber(guides), icon: Star, sub: `${formatNumber(featured)} featured on the blog` },
        ]}
      />
      <BulkActionBar
        noun="post"
        items={[
          { label: "Publish", action: setPostStatusAction, extra: { status: "PUBLISHED" }, done: "Published" },
          { label: "Move to draft", action: setPostStatusAction, extra: { status: "DRAFT" }, done: "Moved to draft" },
          { label: "Archive", action: setPostStatusAction, extra: { status: "ARCHIVED" }, done: "Archived", confirm: "Archived posts are hidden from the blog. You can publish them again later." },
          { label: "Delete", action: deletePostAction, done: "Deleted", danger: true },
        ]}
      />
      <ListPanel
        tabs={
          <PillTabs
            label="Status"
            items={[{ href: href(), label: "All", count: count(), active: !status }, ...STATUSES.map((s) => ({ href: href(s), label: s.charAt(0) + s.slice(1).toLowerCase(), count: count(s), active: status === s }))]}
          />
        }
        meta={showing(page, PER_PAGE, total)}
        filters={
          <FilterBar action="/admin/blog" bare oneLine>
            {status && <input type="hidden" name="status" value={status} />}
            <SearchField defaultValue={sp.q} placeholder="Search post titles…" />
            <SelectField name="type" label="Type" value={sp.type}>
              <option value="">All types</option>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} basePath="/admin/blog" params={sp} />}
      >
        {posts.length === 0 ? (
          <PanelEmpty icon={<BookOpen className="h-5 w-5" />} title="No posts here" action={<ButtonLink size="sm" href="/admin/blog/new" variant="secondary"><Plus className="h-4 w-4" aria-hidden /> Write a post</ButtonLink>}>Try another status or search.</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={56}>
            <thead><tr><th className="w-10"><AllCheckbox ids={posts.map((p) => p.id)} /></th><th>Post</th><th>Type</th><th>Category</th><th>Author</th><th>Status</th><th>Updated</th><th className="w-20"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td><RowCheckbox id={p.id} label={p.title} /></td>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded-lg bg-[linear-gradient(135deg,rgb(var(--color-mint-soft)),rgb(var(--color-surface)))] ring-1 ring-line">
                        {p.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- small cover
                          <img src={p.cover.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <BookOpen className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-mint-ink/70" aria-hidden />
                        )}
                      </span>
                      <span className="min-w-0">
                        <Link href={`/admin/blog/${p.id}`} className="block max-w-[22rem] truncate font-semibold text-ink hover:text-mint-ink">{p.title}</Link>
                        <span className="block truncate text-xs text-muted">/blog/{p.slug}{p.isFeatured && " · Featured"}</span>
                      </span>
                    </div>
                  </td>
                  <td className="text-muted">{TYPE_LABEL[p.type]}</td>
                  <td className="text-muted">{p.category?.name ?? "—"}</td>
                  <td className="text-muted">{p.author?.name ?? "—"}</td>
                  <td><StatusBadge status={p.status} scheduledAt={p.scheduledAt} /></td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(p.updatedAt)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <Link href={`/admin/blog/${p.id}`} title="Edit" aria-label={`Edit ${p.title}`} className={ROW_ICON}><Pencil className="h-4 w-4" /></Link>
                      {p.status === "PUBLISHED" && <Link href={`/blog/${p.slug}`} target="_blank" title="View on website" aria-label={`View ${p.title}`} className={ROW_ICON}><ExternalLink className="h-4 w-4" /></Link>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
