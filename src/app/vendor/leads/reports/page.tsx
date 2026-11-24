import { CalendarDays, Inbox, Hourglass, Trophy } from "lucide-react";
import { leadReport } from "@/server/services/leads";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL } from "@/lib/validation/leads";
import { Panel, PanelHeader, EmptyState } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { PillTabs } from "@/components/admin/list-panel";
import { DateRangeField } from "@/components/admin/date-range-field";
import { HBarChart, TrendChart } from "@/components/admin/charts";
import { requireVendor } from "../../_lib";

export const metadata = { title: "Lead reports" };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Today's date in India, as YYYY-MM-DD. */
const todayIst = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
const shift = (day: string, n: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
const nice = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * A custom range from the address bar (?from=&to=), or null. A missing end is filled in (from → today,
 * to → the 30 days before it), a reversed range is swapped, and the range is kept to two years.
 */
function customRange(sp: { from?: string; to?: string }): { from: string; to: string } | null {
  const f = DAY.test(sp.from ?? "") && !Number.isNaN(Date.parse(sp.from!)) ? sp.from! : null;
  const t = DAY.test(sp.to ?? "") && !Number.isNaN(Date.parse(sp.to!)) ? sp.to! : null;
  if (!f && !t) return null;
  let from = f ?? shift(t!, -29);
  let to = t ?? todayIst();
  if (from > to) [from, to] = [to, from];
  if (shift(from, 730) < to) from = shift(to, -730);
  return { from, to };
}

export default async function LeadReports({ searchParams }: { searchParams: Promise<{ days?: string; from?: string; to?: string }> }) {
  const user = await requireVendor("vendor.leads", "/vendor/leads/reports");
  const sp = await searchParams;
  const range = customRange(sp);
  const preset = [7, 30, 90, 365].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const r = await leadReport(user, range ?? preset);
  const days = r.days;
  const total = r.byStatus.reduce((n, x) => n + x.count, 0);
  const won = r.byStatus.find((x) => x.key === "WON")?.count ?? 0;
  const spam = 0; // Spam is never counted in the vendor portal.
  const open = r.byStatus.filter((x) => !["WON", "LOST", "SPAM"].includes(x.key)).reduce((n, x) => n + x.count, 0);
  const map = new Map(r.perDay.map((p) => [p.day, p.count]));
  // One point per day: the whole custom range, or the last 90 days of a preset.
  const end = range?.to ?? todayIst();
  const points = range ? days : Math.min(days, 90);
  const trend = Array.from({ length: points }, (_, i) => { const d = shift(end, i - (points - 1)); return { day: d, leads: map.get(d) ?? 0 }; });
  const periodText = range ? (range.from === range.to ? `On ${nice(range.from)}` : `${nice(range.from)} – ${nice(range.to)}`) : `In the last ${days === 365 ? "year" : `${days} days`}`;
  // The leads list filters by the same dates when a custom range is chosen.
  const listHref = range ? `/vendor/leads?from=${range.from}&to=${range.to}` : "/vendor/leads";
  return (
    <>
      <PageHeader
        title="Lead reports"
        description="See how many people asked about your products, where they came from and how they are going."
        actions={
          <>
            <PillTabs label="Period" items={[7, 30, 90, 365].map((d) => ({ href: `/vendor/leads/reports?days=${d}`, label: d === 365 ? "1 year" : `${d} days`, active: !range && d === preset }))} />
            {/* Custom dates: picking a range reloads this page with ?from=&to= */}
            <form method="get" action="/vendor/leads/reports">
              <DateRangeField key={`${range?.from}-${range?.to}`} from={range?.from} to={range?.to} label="Custom dates" hide={["Last 7 days", "Last 30 days"]} />
            </form>
          </>
        }
      />
      <PageStats
        items={[
          { label: "Leads", value: (total - spam).toLocaleString("en-IN"), icon: Inbox, tone: "red", sub: periodText, href: listHref },
          { label: "Won", value: won.toLocaleString("en-IN"), icon: Trophy, tone: "green", sub: `${total - spam ? Math.round((won / (total - spam)) * 100) : 0}% of leads became customers` },
          { label: "Average per day", value: ((total - spam) / days).toFixed(1), icon: CalendarDays, sub: `Over ${days} ${days === 1 ? "day" : "days"}` },
          { label: "Still open", value: open.toLocaleString("en-IN"), icon: Hourglass, tone: open ? "amber" : "neutral", sub: "Not yet won or lost", href: listHref },
        ]}
      />
      <Panel><PanelHeader title="Leads per day" description={range ? periodText : undefined} /><div className="p-4"><TrendChart data={trend} dataKey="leads" label="Leads" color="accent" /></div></Panel>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Panel><PanelHeader title="By type" description="What buyers asked for" /><div className="p-4">{r.byType.length ? <HBarChart data={r.byType.map((t) => ({ name: LEAD_TYPE_LABEL[t.key], value: t.count }))} label="Leads" /> : <EmptyState title="No leads in this period" />}</div></Panel>
        <Panel><PanelHeader title="By status" /><div className="p-4">{total ? <HBarChart data={r.byStatus.map((s) => ({ name: LEAD_STATUS_LABEL[s.key], value: s.count }))} label="Leads" /> : <EmptyState title="No leads in this period" />}</div></Panel>
        <Panel><PanelHeader title="By source" /><div className="p-4">{total ? <HBarChart data={r.bySource.map((s) => ({ name: LEAD_SOURCE_LABEL[s.key], value: s.count }))} label="Leads" /> : <EmptyState title="No leads in this period" />}</div></Panel>
        <Panel><PanelHeader title="Top products" description="Leads per product (1 lead can ask about several)" /><div className="p-4">{r.topSoftware.length ? <HBarChart data={r.topSoftware.map((s) => ({ name: s.name, value: s.count }))} label="Leads" /> : <EmptyState title="No product enquiries" />}</div></Panel>
      </div>
    </>
  );
}
