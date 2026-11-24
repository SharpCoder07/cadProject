import Link from "next/link";
import { ArrowLeft, Clock, Lock, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import type { Principal } from "@/server/rbac/policy";
import { can } from "@/server/rbac/policy";
import { caseAssignees, getCase } from "@/server/services/compliance/cases";
import { CONTENT_ACTIONS, isOverdue, nextStatuses, STATUS_LABEL, typeLabel, type CaseKind } from "@/lib/compliance/cases";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";
import { STATUS_TONE } from "./list";
import { AssignSelect, CaseUpdateForm, EraseButton, ExportButton, WithdrawConsentsButton } from "./case-actions";

const EVENT: Record<string, string> = { action: "Action on content", created: "Received", verified: "Email confirmed", status: "Status", assigned: "Assignment", note: "Internal note", message: "Message to requester", export: "Data export", erasure: "Erasure", consent_withdrawn: "Consents withdrawn" };

/** Shared detail page for a data request or grievance. */
export async function CaseDetail({ user, id, kind, base, title }: { user: Principal; id: string; kind: CaseKind; base: string; title: string }) {
  const [c, people] = await Promise.all([getCase(user, id), caseAssignees()]);
  const editable = can(user, "compliance.manage");
  const late = isOverdue(c);
  const verified = Boolean(c.verifiedAt);
  const account = c.user ?? c.matchedAccount;
  const facts = [
    { label: "Type", value: typeLabel(kind, c.type) },
    { label: "Received", value: formatDateTime(c.createdAt) },
    { label: "Identity", value: c.verification === "signed_in" ? "Signed-in account" : c.verification === "email_link" ? `Email confirmed ${c.verifiedAt ? formatDateTime(c.verifiedAt) : ""}` : "Not confirmed yet" },
    ...(kind === "GRIEVANCE" ? [{ label: "Acknowledge by", value: c.ackDueAt ? `${formatDate(c.ackDueAt)}${c.acknowledgedAt ? ` (done ${formatDate(c.acknowledgedAt)})` : ""}` : "No timeline set" }] : []),
    { label: kind === "GRIEVANCE" ? "Resolve by" : "Respond by", value: c.dueAt ? formatDate(c.dueAt) : "No timeline set" },
    ...(c.resolvedAt ? [{ label: "Finished", value: formatDateTime(c.resolvedAt) }] : []),
  ];
  return (
    <>
      <Link href={base} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden />{title}</Link>
      <PageHeader
        title={c.subject || typeLabel(kind, c.type)}
        description={`${c.referenceNo} · from ${c.name}`}
        actions={<span className={cn("rounded-full px-3 py-1 text-xs font-semibold ring-1", STATUS_TONE[c.status])}>{STATUS_LABEL[c.status]}</span>}
      />
      {late && <p className="mb-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-medium text-danger"><Clock className="h-4 w-4" aria-hidden />Past its target date.</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-2 text-sm font-semibold text-muted">What they wrote</h2>
            <p className="whitespace-pre-line text-ink">{c.details}</p>
            {c.contentUrl && (
              <p className="mt-3 text-sm"><span className="text-muted">Content: </span><a href={c.contentUrl} target="_blank" rel="noopener noreferrer nofollow" className="break-all font-semibold text-primary hover:underline">{c.contentUrl}</a></p>
            )}
            {c.kind === "CONTENT_COMPLAINT" && <p className="mt-1 text-xs text-muted">{c.declaration ? "Good-faith statement confirmed by the sender." : "No good-faith statement."}{c.actionTaken ? ` · Action: ${CONTENT_ACTIONS.find((a) => a.value === c.actionTaken)?.label}` : ""}</p>}
          </section>

          {editable && verified && c.kind === "DATA_REQUEST" && ["access", "erasure", "withdraw_consent"].includes(c.type) && (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="mb-1 text-base font-semibold text-ink">Fulfil the request</h2>
              <p className="mb-4 text-sm text-muted">{account ? `Linked account: ${account.name} (${account.role.name}).` : "No account uses this email: only enquiries, reviews and consents sent with it are covered."}</p>
              <div className="flex flex-wrap gap-2">
                {c.type === "access" && (can(user, "compliance.sensitive") ? <ExportButton id={c.id} /> : <p className="flex items-center gap-1.5 text-sm text-muted"><Lock className="h-4 w-4" aria-hidden />Downloading someone&apos;s data needs “view personal data”.</p>)}
                {c.type === "withdraw_consent" && <WithdrawConsentsButton id={c.id} />}
                {c.type === "erasure" && <EraseButton id={c.id} />}
              </div>
              <p className="mt-3 text-xs text-muted">Then tell them the outcome below (Resolved, with what you did and anything you had to keep).</p>
            </section>
          )}
          {editable && verified && c.kind === "DATA_REQUEST" && c.type === "correction" && account && (
            <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
              <h2 className="mb-1 text-base font-semibold text-ink">Fulfil the request</h2>
              <p className="text-muted">Correct the details in <Link href={`/admin/users?q=${encodeURIComponent(account.name)}`} className="font-semibold text-primary hover:underline">Users</Link> (or their enquiries and reviews), then record what changed below.</p>
            </section>
          )}

          <section className="rounded-2xl border border-line bg-surface">
            <h2 className="border-b border-line px-5 py-3 text-sm font-semibold text-ink">History</h2>
            <ol className="divide-y divide-line">
              {c.events.map((e) => (
                <li key={e.id} className="px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-semibold text-ink">{EVENT[e.type] ?? e.type}</span>
                    {e.internal ? <span className="rounded-full bg-ink/[0.05] px-2 py-0.5 ring-1 ring-line">Staff only</span> : <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary ring-1 ring-primary/20">Shown to requester</span>}
                    <span>{formatDateTime(e.createdAt)}</span>
                    {e.actor && <span>· {e.actor.name}</span>}
                  </div>
                  {e.message && <p className="mt-1 whitespace-pre-line text-ink">{e.message}</p>}
                  {e.metadata && e.type === "erasure" && <p className="mt-1 text-xs text-muted">{Object.entries(e.metadata as Record<string, number>).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
                </li>
              ))}
            </ol>
          </section>

          {editable && (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <h2 className="mb-3 text-base font-semibold text-ink">Update</h2>
              <CaseUpdateForm id={c.id} status={c.status} next={nextStatuses(c.status)} verified={verified} content={c.kind === "CONTENT_COMPLAINT" ? { action: c.actionTaken, options: [...CONTENT_ACTIONS] } : undefined} />
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="mb-3 font-semibold text-ink">Requester</h2>
            <p className="flex items-center gap-2 text-ink"><UserRound className="h-4 w-4 text-muted" aria-hidden />{c.name}</p>
            <p className="mt-1.5 flex items-center gap-2 text-ink"><Mail className="h-4 w-4 text-muted" aria-hidden />{c.email}</p>
            {c.phone && <p className="mt-1.5 flex items-center gap-2 text-ink"><Phone className="h-4 w-4 text-muted" aria-hidden />{c.phone}</p>}
            {c.masked && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Lock className="h-3.5 w-3.5" aria-hidden />Contact details masked: needs “view personal data”.</p>}
            {account && <p className="mt-3 flex items-center gap-1.5 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{c.user ? "Sent from their account" : "Matches an account"}: {account.role.name}</p>}
          </section>
          <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <dl className="space-y-2.5">
              {facts.map((f) => (
                <div key={f.label}><dt className="text-xs text-muted">{f.label}</dt><dd className="text-ink">{f.value}</dd></div>
              ))}
            </dl>
          </section>
          <section className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <h2 className="mb-2 font-semibold text-ink">Assigned to</h2>
            {editable ? <AssignSelect id={c.id} current={c.assignedToId} people={people} me={user.id} /> : <p className="text-ink">{c.assignedTo?.name ?? "Nobody"}</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
