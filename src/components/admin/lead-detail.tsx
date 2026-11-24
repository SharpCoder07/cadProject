import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import type { getLead } from "@/server/services/leads";
import { formatDateTime } from "@/lib/format";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL } from "@/lib/validation/leads";
import { Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { LeadTypeBadge, leadTone } from "./lead-table";

type Lead = Awaited<ReturnType<typeof getLead>>;

const ACTIVITY: Record<string, (a: Lead["activities"][number], names: Record<string, string>) => string> = {
  CREATED: (a) => `Enquiry received from ${LEAD_SOURCE_LABEL[a.toValue as keyof typeof LEAD_SOURCE_LABEL] ?? a.toValue}`,
  STATUS_CHANGED: (a) => `Status ${LEAD_STATUS_LABEL[a.fromValue as keyof typeof LEAD_STATUS_LABEL] ?? a.fromValue} → ${LEAD_STATUS_LABEL[a.toValue as keyof typeof LEAD_STATUS_LABEL] ?? a.toValue}`,
  ASSIGNED: (a, n) => (a.toValue ? `Assigned to ${n[a.toValue] ?? "a team member"}` : "Unassigned"),
  NOTE_ADDED: () => "Added a note",
  FOLLOW_UP_SET: (a) => (a.toValue ? `Follow-up set for ${formatDateTime(a.toValue)}` : "Follow-up cleared"),
  PRIORITY_CHANGED: (a) => `Priority ${a.fromValue?.toLowerCase()} → ${a.toValue?.toLowerCase()}`,
  NOTIFICATION_SENT: (a) => `Notification sent (${a.toValue})`,
  RESELLER_ASSIGNED: (a) => (a.toValue ? `Forwarded to reseller ${a.toValue}` : `Taken back from reseller ${a.fromValue ?? ""}`),
};

/** Read-only lead summary + timeline, shared by the admin and vendor portal. */
/** `contact` replaces the email/phone links (the vendor portal passes masked values with View buttons). */
/** `noteForm` (admin) sits at the top of the Notes card; `besideNotes` (e.g. the pipeline) goes above the notes in place of the timeline (render <LeadTimeline> elsewhere). */
export function LeadSummary({ lead, staffNames, showInternal, contact, noteForm, besideNotes }: { lead: Lead; staffNames: Record<string, string>; showInternal: boolean; contact?: React.ReactNode; noteForm?: React.ReactNode; besideNotes?: React.ReactNode }) {
  const rows: [string, React.ReactNode][] = [
    ["Company", lead.company ? `${lead.company}${lead.companySize ? ` (${lead.companySize} employees)` : ""}` : "—"],
    ["City", lead.city ?? "—"],
    ["Received", formatDateTime(lead.createdAt)],
    ["Software", lead.software.length ? <span className="flex flex-wrap gap-x-3 gap-y-1">{lead.software.map((s) => <Link key={s.software.id} href={`/software/${s.software.slug}`} target="_blank" className="font-medium text-mint-ink hover:underline">{s.software.name}</Link>)}</span> : "General enquiry"],
    ["Type", <LeadTypeBadge key="type" type={lead.type} />],
    ["Source", <span key="src" className="block min-w-0">{LEAD_SOURCE_LABEL[lead.source]}{lead.sourceUrl && <a href={lead.sourceUrl} target="_blank" rel="noopener" className="block truncate text-xs text-muted hover:text-mint-ink" title={lead.sourceUrl}>{lead.sourceUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}</a>}</span>],
    ["Campaign", [lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(" / ") || "—"],
  ];
  const initials = lead.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const requirement = [lead.requirement, lead.message].filter(Boolean).join("\n\n");
  return (
    <div className="space-y-5">
      <Panel>
        {/* Who it is and how to reach them */}
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-mint-soft text-base font-bold text-mint-ink" aria-hidden>{initials}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-sans text-lg font-semibold text-ink">{lead.name}</h2>
              <Badge tone={leadTone(lead.status)}>{LEAD_STATUS_LABEL[lead.status]}</Badge>
              {lead.priority === "HIGH" && <Badge tone="danger">High priority</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-muted">{[lead.company, lead.city, lead.referenceNo].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {contact ?? (
              <>
                <a href={`mailto:${lead.email}`} className={buttonClass("secondary", "sm", "max-w-full")}><Mail className="h-4 w-4 shrink-0" aria-hidden /><span className="truncate">{lead.email}</span></a>
                <a href={`tel:${lead.phone}`} className={buttonClass("secondary", "sm")}><Phone className="h-4 w-4" aria-hidden />{lead.phone}</a>
              </>
            )}
          </div>
        </div>
        {/* Enquiry details */}
        <dl className="grid gap-px border-t border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k} className="min-w-0 bg-surface px-5 py-3">
              <dt className="text-xs font-medium text-muted">{k}</dt>
              <dd className="mt-0.5 text-sm text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {requirement && (
          <div className="border-t border-line p-5">
            <p className="text-xs font-medium text-muted">Requirement</p>
            <p className="mt-1.5 whitespace-pre-line rounded-control bg-bg px-4 py-3 text-sm leading-relaxed text-ink">{requirement}</p>
          </div>
        )}
      </Panel>
      {showInternal && (
        <div className={besideNotes ? "space-y-5" : "grid gap-5 lg:grid-cols-2"}>
          {besideNotes ? (
            <>
              {besideNotes}
              <Panel>
                <PanelHeader title={`Notes${lead.notes.length ? ` (${lead.notes.length})` : ""}`} />
                {noteForm && <div className="border-b border-line p-4">{noteForm}</div>}
                <ul className="divide-y divide-line">
                  {lead.notes.length === 0 && <li className="px-5 py-4 text-sm text-muted">No notes yet.</li>}
                  {lead.notes.map((n) => (
                    <li key={n.id} className="px-5 py-3 text-sm">
                      <p className="whitespace-pre-line text-ink [overflow-wrap:anywhere]">{n.body}</p>
                      <p className="mt-1 text-xs text-muted">{n.author?.name ?? "Deleted user"} · {formatDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          ) : (
            <>
              <Panel className="self-start">
                <PanelHeader title={`Notes${lead.notes.length ? ` (${lead.notes.length})` : ""}`} />
                {noteForm && <div className="border-b border-line p-4">{noteForm}</div>}
                <ul className="divide-y divide-line">
                  {lead.notes.length === 0 && <li className="px-5 py-4 text-sm text-muted">No notes yet.</li>}
                  {lead.notes.map((n) => (
                    <li key={n.id} className="px-5 py-3 text-sm">
                      <p className="whitespace-pre-line text-ink [overflow-wrap:anywhere]">{n.body}</p>
                      <p className="mt-1 text-xs text-muted">{n.author?.name ?? "Deleted user"} · {formatDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
              <LeadTimeline lead={lead} staffNames={staffNames} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Staff timeline of a lead (status changes, assignments, notifications). */
export function LeadTimeline({ lead, staffNames, className = "self-start" }: { lead: Lead; staffNames: Record<string, string>; className?: string }) {
  const failed = lead.notifications.filter((n) => n.status === "FAILED");
  return (
      <Panel className={className}>
        <PanelHeader title="Timeline" />
        <ol className="relative space-y-4 p-5 before:absolute before:bottom-6 before:left-[1.6rem] before:top-6 before:w-px before:bg-line">
          {lead.activities.map((a) => (
            <li key={a.id} className="relative flex gap-3 text-sm">
              <span className="relative z-10 mt-1 h-3 w-3 shrink-0 rounded-full border-2 border-surface bg-mint-ink" aria-hidden />
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <span className="text-ink">{ACTIVITY[a.type]?.(a, staffNames) ?? a.type}</span>
                <span className="block text-xs text-muted">{a.actor?.name ?? "System"} · {formatDateTime(a.createdAt)}</span>
              </span>
            </li>
          ))}
        </ol>
        {failed.length > 0 && (
          <p className="border-t border-line px-5 py-3 text-xs text-danger [overflow-wrap:anywhere]">Some notifications failed and will be retried automatically: {failed.map((n) => `${n.channel} (${n.error})`).join(", ")}</p>
        )}
      </Panel>
  );
}
