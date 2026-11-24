import Link from "next/link";
import { AlertOctagon, Plus, ShieldAlert, Timer } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { listIncidents } from "@/server/services/compliance/incidents";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminTable, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { SEVERITY_TONE } from "./tones";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, showing } from "@/components/admin/list-panel";

export const metadata = { title: "Security incidents" };

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const user = await requirePermission("compliance.incidents", "/admin/compliance/incidents");
  const sp = await searchParams;
  const data = await listIncidents(user, { status: sp.status, page: Number(sp.page) || 1 });
  const tab = (status: string | undefined, label: string) => ({ href: status ? `/admin/compliance/incidents?status=${status}` : "/admin/compliance/incidents", label, active: (sp.status ?? "") === (status ?? "") });
  return (
    <>
      <PageHeader
        title="Security incidents"
        description="Security incidents and personal data breaches: what happened, what was affected, the reporting decision and the fix. The history of each one can't be edited."
        actions={<Link href="/admin/compliance/incidents/new" className="inline-flex h-8 items-center gap-1.5 rounded-control bg-action px-3 text-sm font-semibold text-action-fg hover:bg-action/90"><Plus className="h-4 w-4" aria-hidden />Record incident</Link>}
      />
      <PageStats
        items={[
          { label: "Open", value: data.open, icon: ShieldAlert, tone: data.open ? "red" : "neutral", sub: "Open, investigating or contained" },
          { label: "Reporting not decided", value: data.undecided, icon: Timer, sub: "Personal data affected" },
          { label: "All incidents", value: data.total, icon: AlertOctagon, sub: "In this view" },
        ]}
      />
      <ListPanel
        tabs={<PillTabs items={[tab(undefined, "Open"), tab("RESOLVED", "Resolved"), tab("CLOSED", "Closed"), tab("ALL", "All")]} />}
        meta={showing(data.page, 30, data.total)}
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/compliance/incidents" params={sp} />}
      >
        {data.rows.length === 0 ? (
          <PanelEmpty icon={<ShieldAlert className="h-5 w-5" />} title="No incidents">Record one as soon as you suspect a security problem, even before you know the details.</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={56}>
            <thead><tr><th>Reference</th><th>Incident</th><th>Severity</th><th>Status</th><th>Personal data</th><th>Detected</th></tr></thead>
            <tbody>
              {data.rows.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/admin/compliance/incidents/${i.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">{i.referenceNo}</Link></td>
                  <td><Link href={`/admin/compliance/incidents/${i.id}`} className="font-medium text-ink hover:underline">{i.title}</Link>{i.assignedTo && <span className="block text-xs text-muted">{i.assignedTo.name}</span>}</td>
                  <td><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", SEVERITY_TONE[i.severity])}>{cap(i.severity)}</span></td>
                  <td>{cap(i.status)}</td>
                  <td className="text-muted">{i.personalDataAffected ? `Yes${i.reportable === "undecided" ? " · decision pending" : i.reportable === "yes" ? " · reportable" : " · not reportable"}` : "No"}</td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(i.detectedAt)}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </>
  );
}
