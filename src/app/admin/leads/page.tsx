import { AlarmClock, Download, Inbox, Sparkles, Trophy } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listLeads } from "@/server/services/leads";
import { LEAD_SOURCES, LEAD_SOURCE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, LEAD_TYPES, LEAD_TYPE_LABEL } from "@/lib/validation/leads";
import { formatNumber } from "@/lib/format";
import { FilterBar, PageHeader } from "@/components/admin/page-header";
import { buttonClass } from "@/components/ui/button";
import { PageStats } from "@/components/admin/page-stats";
import { DateField, ListPanel, PanelEmpty, PanelPagination, SelectField, showing } from "@/components/admin/list-panel";
import { SelectionProvider } from "@/components/admin/bulk-table";
import { LeadTable } from "@/components/admin/lead-table";
import { ListSearch } from "@/components/site/list-search";
import { LeadBulk } from "./lead-bulk";

export const metadata = { title: "Leads" };
const OPEN = ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL"] as const;

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("leads.view", "/admin/leads");
  const sp = await searchParams;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  // ?reseller=<id> (from a reseller's page) is the same filter as "Assigned to → reseller".
  const params = sp.reseller && !sp.assignee ? { ...sp, assignee: `r:${sp.reseller}` } : sp;
  const [data, staff, resellers, open, fresh, due, won] = await Promise.all([
    listLeads(user, params),
    db.user.findMany({ where: { status: "ACTIVE", vendorId: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.vendor.findMany({ where: { kind: "RESELLER" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.lead.count({ where: { status: { in: [...OPEN] } } }),
    db.lead.count({ where: { status: "NEW" } }),
    db.lead.count({ where: { status: { in: [...OPEN] }, nextFollowUpAt: { lte: new Date() } } }),
    db.lead.count({ where: { status: "WON", updatedAt: { gte: monthStart } } }),
  ]);
  const q = data.query;
  const exportQs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  const canManage = user.permissions.has("leads.manage");
  return (
    <SelectionProvider>
      <PageHeader
        title="Leads"
        description="Track and follow up on every buyer enquiry."
        actions={user.permissions.has("leads.export") && <a href={`/api/admin/leads/export?${exportQs}`} className={buttonClass("secondary", "sm")}><Download className="h-4 w-4" aria-hidden /> Export CSV</a>}
      />
      <PageStats
        items={[
          { label: "Open leads", value: formatNumber(open), icon: Inbox, tone: "red", sub: "Not won, lost or spam", href: "/admin/leads?status=OPEN" },
          { label: "New", value: formatNumber(fresh), icon: Sparkles, tone: fresh ? "amber" : "neutral", sub: fresh ? "Not contacted yet" : "All contacted", href: "/admin/leads?status=NEW" },
          { label: "Follow-ups due", value: formatNumber(due), icon: AlarmClock, tone: due ? "amber" : "neutral", sub: due ? "Due today or overdue" : "Nothing overdue", href: "/admin/leads?status=OPEN&followUp=due" },
          { label: "Won this month", value: formatNumber(won), icon: Trophy, tone: "green", sub: "Marked as won", href: "/admin/leads?status=WON" },
        ]}
      />
      {/* Bulk bar above the list, like every other admin list. */}
      {canManage && <LeadBulk staff={staff} />}
      <ListPanel
        title="All leads"
        meta={showing(data.page, data.perPage, data.total)}
        actions={<ListSearch panel placeholder="Search name, email, phone or ref…" basePath="/admin/leads" params={sp} scopeLabel="Leads" className="w-full sm:w-72" />}
        filters={
          <FilterBar action="/admin/leads" bare oneLine>
            {q.q && <input type="hidden" name="q" value={q.q} />}
            <SelectField name="status" label="Status" value={q.status} resting="OPEN">
              <option value="OPEN">Open leads</option>
              <option value="ALL">All statuses</option>
              {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>)}
            </SelectField>
            <SelectField name="type" label="Type" value={q.type}>
              <option value="ALL">All types</option>
              {LEAD_TYPES.map((t) => <option key={t} value={t}>{LEAD_TYPE_LABEL[t]}</option>)}
            </SelectField>
            <SelectField name="source" label="Source" value={q.source}>
              <option value="ALL">All sources</option>
              {LEAD_SOURCES.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}
            </SelectField>
            <SelectField name="assignee" label="Assigned to" value={q.assignee}>
              <option value="">Anyone</option><option value="me">Assigned to me</option><option value="none">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              {resellers.length > 0 && (
                <optgroup label="Shared with a reseller">
                  <option value="r:any">Any reseller</option>
                  {resellers.map((r) => <option key={r.id} value={`r:${r.id}`}>{r.name}</option>)}
                </optgroup>
              )}
            </SelectField>
            <SelectField name="followUp" label="Follow-up" value={q.followUp}>
              <option value="">Any follow-up</option><option value="due">Due or overdue</option><option value="upcoming">Upcoming</option>
            </SelectField>
            <DateField name="from" label="From" defaultValue={sp.from} />
            <DateField name="to" label="To" defaultValue={sp.to} />
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/leads" params={sp} />}
      >
        {data.items.length === 0 ? <PanelEmpty icon={<Inbox className="h-5 w-5" />} title="No leads match these filters">Try another status or date range.</PanelEmpty> : <LeadTable items={data.items} basePath="/admin/leads" selectable={canManage} bare />}
      </ListPanel>
    </SelectionProvider>
  );
}
