import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { listLeads } from "@/server/services/leads";
import { Download, Inbox, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { formatNumber } from "@/lib/format";
import { FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { DateField, ListPanel, PanelEmpty, PanelPagination, SelectField, showing } from "@/components/admin/list-panel";
import { ListSearch } from "@/components/site/list-search";
import { buttonClass } from "@/components/ui/button";
import { LEAD_SOURCES, LEAD_SOURCE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_TYPES, LEAD_TYPE_LABEL } from "@/lib/validation/leads";
import { LeadTable } from "@/components/admin/lead-table";
import { LockedBanner, UpgradeProvider } from "@/components/vendor/contact-lock";
import { requireVendor } from "../_lib";
import { upgradeBilling } from "../_billing";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

export default async function VendorLeads({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireVendor("vendor.leads", "/vendor/leads");
  const vendor = await db.vendor.findUnique({ where: { id: user.vendorId }, select: { receivesLeads: true, kind: true } });
  const reseller = vendor?.kind === "RESELLER";
  const base = reseller ? "/reseller" : "/vendor";
  if (!vendor?.receivesLeads) redirect("/vendor?denied=1");
  const sp = await searchParams;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const scope: Prisma.LeadWhereInput = { ...(reseller ? { resellers: { some: { resellerId: user.vendorId } } } : { vendorId: user.vendorId }), status: { not: "SPAM" } };
  const OPEN = ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL"] as const;
  const [data, open, fresh, week, wonMonth, products, billing] = await Promise.all([
    listLeads(user, { ...sp, status: sp.status ?? "ALL" }),
    db.lead.count({ where: { ...scope, status: { in: [...OPEN] } } }),
    db.lead.count({ where: { ...scope, status: "NEW" } }),
    db.lead.count({ where: { ...scope, createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } } }),
    db.lead.count({ where: { ...scope, status: "WON", updatedAt: { gte: monthStart } } }),
    reseller
      ? db.software.findMany({ where: { resellers: { some: { resellerId: user.vendorId } } }, orderBy: { name: "asc" }, select: { id: true, name: true, enquiryCount: true } })
      : db.software.findMany({ where: { vendorId: user.vendorId }, orderBy: { name: "asc" }, select: { id: true, name: true, enquiryCount: true } }),
    upgradeBilling(user),
  ]);
  const filtered = Boolean(sp.q || sp.softwareId || sp.from || sp.to || (sp.status && sp.status !== "ALL") || sp.source || sp.type);
  const q = data.query;
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  // Opening Leads marks everything up to now as seen (clears the bell and the Leads badge).
  await db.user.update({ where: { id: user.id }, data: { leadsSeenAt: new Date() } });
  return (
    <UpgradeProvider billing={billing}>
      <PageHeader
        title="Leads"
        description={reseller ? "Follow up on every buyer enquiry for the products you resell." : "Follow up on every buyer enquiry for your products."}
        actions={<a href={`/api/admin/leads/export?${exportQs}`} className={buttonClass("secondary", "sm")}><Download className="h-4 w-4" aria-hidden /> Export CSV</a>}
      />
      {data.contactLocked && <LockedBanner />}
      <PageStats
        items={[
          { label: "Open leads", value: formatNumber(open), icon: Inbox, tone: "red", sub: "Not won or lost yet", href: `${base}/leads?status=OPEN` },
          { label: "New", value: formatNumber(fresh), icon: Sparkles, tone: fresh ? "amber" : "neutral", sub: fresh ? "Not contacted yet" : "All contacted", href: `${base}/leads?status=NEW` },
          { label: "Last 7 days", value: formatNumber(week), icon: TrendingUp, sub: week ? "Contact them promptly" : "No new leads" },
          { label: "Won this month", value: formatNumber(wonMonth), icon: Trophy, tone: "green", sub: "Marked as won", href: `${base}/leads?status=WON` },
        ]}
      />
      <ListPanel
        title="All leads"
        meta={showing(data.page, data.perPage, data.total)}
        actions={<ListSearch panel placeholder="Search name, company or ref…" basePath={`${base}/leads`} params={sp} scopeLabel="Leads" className="w-full sm:w-72" />}
        filters={
          <FilterBar action={`${base}/leads`} bare oneLine>
            {q.q && <input type="hidden" name="q" value={q.q} />}
            <SelectField name="status" label="Status" value={q.status} resting="ALL">
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open leads</option>
              {LEAD_STATUSES.filter((st) => st !== "SPAM").map((st) => <option key={st} value={st}>{LEAD_STATUS_LABEL[st]}</option>)}
            </SelectField>
            <SelectField name="type" label="Type" value={q.type}>
              <option value="ALL">All types</option>
              {LEAD_TYPES.filter((t) => t !== "PARTNERSHIP").map((t) => <option key={t} value={t}>{LEAD_TYPE_LABEL[t]}</option>)}
            </SelectField>
            <SelectField name="source" label="Source" value={q.source}>
              <option value="ALL">All sources</option>
              {LEAD_SOURCES.map((src) => <option key={src} value={src}>{LEAD_SOURCE_LABEL[src]}</option>)}
            </SelectField>
            <SelectField name="softwareId" label="Product" value={sp.softwareId}>
              <option value="">All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </SelectField>
            <DateField name="from" label="From" defaultValue={sp.from} />
            <DateField name="to" label="To" defaultValue={sp.to} />
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath={`${base}/leads`} params={sp} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<Inbox className="h-5 w-5" />} title={filtered ? "No leads match these filters" : "No leads yet"}>{filtered ? "Try another status or date range." : reseller ? "When a buyer enquires about a product you resell, it shows up here." : "When a buyer enquires about one of your products, it shows up here."}</PanelEmpty>
        ) : (
          <LeadTable items={data.items} basePath={`${base}/leads`} selectable={false} vendorView bare />
        )}
      </ListPanel>
    </UpgradeProvider>
  );
}
