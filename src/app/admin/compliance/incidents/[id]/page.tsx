import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { getIncident } from "@/server/services/compliance/incidents";
import { caseAssignees } from "@/server/services/compliance/cases";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { IncidentForm, type IncidentValues } from "../incident-form";
import { SEVERITY_TONE } from "../tones";

export const metadata = { title: "Security incident" };

/** Date for a datetime-local input, in India time. */
const local = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

const EMPTY: IncidentValues = { title: "", description: "", severity: "MEDIUM", status: "OPEN", detectedAt: "", occurredAt: "", containedAt: "", resolvedAt: "", personalDataAffected: false, dataCategories: "", affectedCount: "", reportable: "undecided", decisionNote: "", reportedToBoardAt: "", reportedToCertInAt: "", usersNotifiedAt: "", rootCause: "", remediation: "", assignedToId: "" };

export default async function IncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("compliance.incidents", `/admin/compliance/incidents/${id}`);
  const people = await caseAssignees();
  if (id === "new") {
    return (
      <>
        <Link href="/admin/compliance/incidents" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden />Security incidents</Link>
        <PageHeader title="Record an incident" description="Write down what you know now; you can add to it as the investigation goes on." />
        <IncidentForm id={null} people={people} editable initial={{ ...EMPTY, detectedAt: local(new Date()) }} />
      </>
    );
  }
  const i = await getIncident(user, id);
  const late = i.decisionDueAt && i.reportable === "undecided" && i.decisionDueAt < new Date();
  return (
    <>
      <Link href="/admin/compliance/incidents" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden />Security incidents</Link>
      <PageHeader
        title={i.title}
        description={`${i.referenceNo} · recorded by ${i.reportedBy?.name ?? "a former user"} on ${formatDateTime(i.createdAt)}`}
        actions={<span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", SEVERITY_TONE[i.severity])}>{i.severity.charAt(0) + i.severity.slice(1).toLowerCase()}</span>}
      />
      {i.decisionDueAt && i.reportable === "undecided" && (
        <p className={cn("mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium", late ? "border-danger/30 bg-danger/5 text-danger" : "border-warning/40 bg-warning/5 text-ink")}>
          <Clock className="h-4 w-4" aria-hidden />Reporting decision {late ? "was due" : "due"} by {formatDateTime(i.decisionDueAt)} (internal target from Compliance settings).
        </p>
      )}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <IncidentForm
          id={i.id}
          people={people}
          editable
          initial={{
            title: i.title, description: i.description, severity: i.severity, status: i.status,
            detectedAt: local(i.detectedAt), occurredAt: local(i.occurredAt), containedAt: local(i.containedAt), resolvedAt: local(i.resolvedAt),
            personalDataAffected: i.personalDataAffected, dataCategories: i.dataCategories.join(", "), affectedCount: i.affectedCount?.toString() ?? "",
            reportable: i.reportable, decisionNote: i.decisionNote ?? "", reportedToBoardAt: local(i.reportedToBoardAt), reportedToCertInAt: local(i.reportedToCertInAt), usersNotifiedAt: local(i.usersNotifiedAt),
            rootCause: i.rootCause ?? "", remediation: i.remediation ?? "", assignedToId: i.assignedToId ?? "",
          }}
        />
        <aside className="h-fit rounded-2xl border border-line bg-surface">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">History</h2>
          <ol className="divide-y divide-line">
            {i.events.map((e) => (
              <li key={e.id} className="px-4 py-3 text-sm">
                <p className="text-xs text-muted">{formatDateTime(e.createdAt)}{e.actor && ` · ${e.actor.name}`}</p>
                <p className="mt-0.5 text-ink">{e.type === "update" ? `Changed: ${e.message}` : e.message}</p>
                {e.type === "update" && e.changes && (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted">
                    {Object.entries(e.changes as Record<string, { from: unknown; to: unknown }>).filter(([k]) => !["description", "rootCause", "remediation", "decisionNote"].includes(k)).map(([k, v]) => (
                      <li key={k}>{k}: {String(v.from ?? "—")} → {String(v.to ?? "—")}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  );
}
