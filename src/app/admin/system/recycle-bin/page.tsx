import { CalendarClock, Layers, Trash2 } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { binDays, BIN_PAGE_SIZE, listBin } from "@/server/system/trash";
import { db } from "@/server/db";
import { formatNumber } from "@/lib/format";
import { FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, SearchField, SelectField, showing } from "@/components/admin/list-panel";
import { BinTable, EmptyBinButton } from "./bin-table";

export const metadata = { title: "Recycle bin" };
export const dynamic = "force-dynamic";

export default async function RecycleBinPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; page?: string }> }) {
  const user = await requirePermission("system.manage", "/admin/system/recycle-bin");
  const sp = await searchParams;
  const days = await binDays();
  const data = await listBin(user, { q: sp.q?.trim() || undefined, type: sp.type || undefined, page: Number(sp.page) || 1 });
  const all = data.types.reduce((n, t) => n + t.count, 0);
  const soon = await db.trashItem.count({ where: { purgeAt: { lt: new Date(Date.now() + 7 * 86_400_000) } } });
  return (
    <>
      <PageHeader
        title="Recycle bin"
        description={`Deleted items wait here for ${days} days, then they are removed for good. Restore puts an item back exactly as it was, with its plans, features, links and SEO settings.`}
        actions={all > 0 && <EmptyBinButton count={all} />}
      />
      <PageStats
        items={[
          { label: "In the bin", value: formatNumber(all), icon: Trash2, tone: "red", sub: "Deleted items you can restore" },
          { label: "Removed within 7 days", value: formatNumber(soon), icon: CalendarClock, sub: "Restore these soon if needed" },
          { label: "Kinds of items", value: formatNumber(data.types.length), icon: Layers, sub: "Products, pages, posts…" },
        ]}
      />
      {/* The bulk bar (from the table below) shows here, above the list, like on every other list. */}
      <div id="bin-bulk-bar" />
      <ListPanel
        title="Deleted items"
        meta={showing(data.page, BIN_PAGE_SIZE, data.total)}
        filters={
          <FilterBar action="/admin/system/recycle-bin" bare oneLine>
            <SearchField defaultValue={sp.q} placeholder="Search by name…" />
            <SelectField name="type" label="Type" value={sp.type}>
              <option value="">All types</option>
              {data.types.map((t) => <option key={t.type} value={t.type}>{t.type} ({t.count})</option>)}
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/system/recycle-bin" params={sp} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<Trash2 className="h-5 w-5" />} title={sp.q || sp.type ? "Nothing matches" : "The recycle bin is empty"}>
            {sp.q || sp.type ? "Try a different search or type." : "When someone deletes a product, page, blog post or anything else, it appears here."}
          </PanelEmpty>
        ) : (
          <BinTable
            items={data.items.map((i) => ({ ...i, deletedAt: i.deletedAt.toISOString(), purgeAt: i.purgeAt.toISOString() }))}
          />
        )}
      </ListPanel>
    </>
  );
}
