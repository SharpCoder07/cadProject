import Link from "next/link";
import { ExternalLink, FilePen, FileText, Globe, House, LayoutTemplate, Pencil } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { listPages } from "@/server/services/cms";
import { formatNumber, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { AdminTable, FilterBar, PageHeader, StatusBadge } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PillTabs, ROW_ICON, SearchField, SelectField, showingAll } from "@/components/admin/list-panel";
import { NewPageButton } from "./new-page-button";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { deletePageAction, setPageStatusAction } from "./actions";

export const metadata = { title: "Pages" };
const TEMPLATE: Record<string, string> = { DEFAULT: "Standard", LANDING: "Landing", LEGAL: "Legal", CONTACT: "Contact", HOMEPAGE: "Homepage" };
const STATUSES = ["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED"];

export default async function PagesList({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; template?: string }> }) {
  const user = await requirePermission("cms.pages.view", "/admin/cms/pages");
  const sp = await searchParams;
  const all = await listPages(user);
  const q = sp.q?.trim().toLowerCase();
  const pages = all.filter(
    (p) => (!sp.status || p.status === sp.status) && (!sp.template || p.template === sp.template) && (!q || p.title.toLowerCase().includes(q) || p.slug.includes(q)),
  );
  const count = (s?: string) => all.filter((p) => !s || p.status === s).length;
  const statuses = STATUSES.filter((s) => count(s) > 0 || s === "PUBLISHED" || s === "DRAFT");
  const href = (status?: string) => {
    const p = new URLSearchParams(Object.entries({ status, q: sp.q, template: sp.template }).filter(([, v]) => v) as [string, string][]);
    return `/admin/cms/pages${p.size ? `?${p}` : ""}`;
  };
  const home = all.find((p) => p.slug === "home");
  return (
    <SelectionProvider>
      <PageHeader title="Pages & homepage" description="Build and manage every page on your website." actions={<NewPageButton />} />
      <PageStats
        items={[
          { label: "Pages", value: formatNumber(all.length), icon: FileText, tone: "red", sub: "Including the homepage" },
          { label: "Published", value: formatNumber(count("PUBLISHED")), icon: Globe, tone: "green", sub: "Live on your website", href: href("PUBLISHED") },
          { label: "Drafts", value: formatNumber(count("DRAFT")), icon: FilePen, tone: count("DRAFT") ? "amber" : "neutral", sub: count("DRAFT") ? "Not published yet" : "Nothing in progress", href: href("DRAFT") },
          { label: "Homepage sections", value: formatNumber(home?._count.sections ?? 0), icon: House, sub: home ? `Updated ${formatDateTime(home.updatedAt)}` : "No homepage yet", href: home ? `/admin/cms/pages/${home.id}` : undefined },
        ]}
      />
      <BulkActionBar
        noun="page"
        items={[
          { label: "Publish", action: setPageStatusAction, extra: { status: "PUBLISHED" }, done: "Published" },
          { label: "Move to draft", action: setPageStatusAction, extra: { status: "DRAFT" }, done: "Moved to draft", confirm: "Draft pages are taken off the website until you publish them again." },
          { label: "Delete", action: deletePageAction, done: "Deleted", danger: true, confirm: "System pages such as the homepage can’t be deleted and will be skipped." },
        ]}
      />
      <ListPanel
        tabs={<PillTabs label="Status" items={[{ href: href(), label: "All", count: count(), active: !sp.status }, ...statuses.map((s) => ({ href: href(s), label: s === "IN_REVIEW" ? "In review" : s.charAt(0) + s.slice(1).toLowerCase(), count: count(s), active: sp.status === s }))]} />}
        meta={showingAll(pages.length)}
        filters={
          <FilterBar action="/admin/cms/pages" bare oneLine>
            {sp.status && <input type="hidden" name="status" value={sp.status} />}
            <SearchField defaultValue={sp.q} placeholder="Search page titles or URLs…" />
            <SelectField name="template" label="Template" value={sp.template}>
              <option value="">All templates</option>
              {Object.entries(TEMPLATE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </SelectField>
          </FilterBar>
        }
      >
        {pages.length === 0 ? (
          <PanelEmpty icon={<LayoutTemplate className="h-5 w-5" />} title="No pages found">Try another status or search.</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={52}>
            <thead><tr><th className="w-10"><AllCheckbox ids={pages.filter((p) => !p.isSystem).map((p) => p.id)} /></th><th>Page</th><th>Template</th><th>Status</th><th className="text-right">Sections</th><th>Updated</th><th className="w-20"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {pages.map((p) => {
                const url = p.slug === "home" ? "/" : `/${p.slug}`;
                return (
                  <tr key={p.id}>
                    <td>{!p.isSystem && <RowCheckbox id={p.id} label={p.title} />}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-soft text-mint-ink">{p.slug === "home" ? <House className="h-4 w-4" aria-hidden /> : <FileText className="h-4 w-4" aria-hidden />}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <Link href={`/admin/cms/pages/${p.id}`} className="truncate font-semibold text-ink hover:text-mint-ink">{p.title}</Link>
                            {p.isSystem && <Badge>System</Badge>}
                          </span>
                          <span className="block truncate text-xs text-muted">{url}</span>
                        </span>
                      </div>
                    </td>
                    <td className="text-muted">{TEMPLATE[p.template]}</td>
                    <td><StatusBadge status={p.status} scheduledAt={p.scheduledAt} /></td>
                    <td className="text-right tabular-nums text-muted">{p._count.sections}</td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(p.updatedAt)}{p.updatedBy && <span className="block text-xs">by {p.updatedBy.name}</span>}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/cms/pages/${p.id}`} title="Edit" aria-label={`Edit ${p.title}`} className={ROW_ICON}><Pencil className="h-4 w-4" /></Link>
                        {p.status === "PUBLISHED" && <Link href={url} target="_blank" title="View on website" aria-label={`View ${p.title}`} className={ROW_ICON}><ExternalLink className="h-4 w-4" /></Link>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
