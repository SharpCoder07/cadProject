import Link from "next/link";
import { ArrowLeft, ExternalLink, EyeOff, GitCompare, Users } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/rbac/policy";
import { getLegalDocument, listAcceptances } from "@/server/services/compliance/legal";
import { diffBlocks, htmlToBlocks, LEGAL_AUDIENCES } from "@/lib/compliance/legal";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AdminTable, PageHeader } from "@/components/admin/page-header";
import { ListPanel, PanelEmpty, PanelPagination, showing } from "@/components/admin/list-panel";
import { NewDraftButton, VersionEditor } from "./version-editor";

export const metadata = { title: "Legal document" };

type SP = { v?: string; compare?: string; page?: string };
const CONTEXT: Record<string, string> = { signup: "Sign-up", reacceptance: "Update notice", vendor_onboarding: "Partner onboarding", admin: "Admin" };

function statusOf(v: { status: string; effectiveAt: Date | null }, currentId: string | undefined, id: string) {
  if (v.status === "DRAFT") return { label: "Draft", cls: "bg-ink/[0.05] text-ink/70 ring-line" };
  if (v.status === "ARCHIVED") return { label: "Archived", cls: "bg-ink/[0.05] text-ink/50 ring-line" };
  if (id === currentId) return { label: "In force", cls: "bg-success/10 text-success ring-success/20" };
  if (v.effectiveAt && v.effectiveAt > new Date()) return { label: "Scheduled", cls: "bg-primary/10 text-primary ring-primary/20" };
  return { label: "Superseded", cls: "bg-ink/[0.05] text-ink/60 ring-line" };
}

export default async function LegalDocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const user = await requirePermission("compliance.view", `/admin/compliance/legal/${id}`);
  const sp = await searchParams;
  const { doc, versions, current, names } = await getLegalDocument(user, id);
  const editable = can(user, "compliance.manage");
  const selected = versions.find((v) => v.id === sp.v) ?? versions.find((v) => v.status === "DRAFT") ?? (current ? versions.find((v) => v.id === current.id) : undefined) ?? versions[0];
  const hasDraft = versions.some((v) => v.status === "DRAFT");
  // Compare with: chosen version, else the version in force, else the previous one.
  const base = selected
    ? versions.find((v) => v.id === sp.compare) ?? (current && current.id !== selected.id ? versions.find((v) => v.id === current.id) : versions.find((v) => v.id !== selected.id && v.status !== "DRAFT"))
    : undefined;
  const diff = selected && base ? diffBlocks(htmlToBlocks(base.content), htmlToBlocks(selected.content)) : [];
  const changed = diff.filter((d) => d.op !== "same").length;
  const acc = await listAcceptances(user, doc.id, Math.max(1, Number(sp.page) || 1));
  const audience = LEGAL_AUDIENCES.find((a) => a.value === doc.audience)?.label ?? doc.audience;

  return (
    <>
      <Link href="/admin/compliance/legal" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden />Legal documents</Link>
      <PageHeader
        title={doc.title}
        description={`/${doc.slug} · ${doc.requiresAcceptance ? `Accepted by: ${audience}` : "Doesn't need acceptance"}${doc.isActive ? "" : " · Switched off"}`}
        actions={
          <div className="flex items-center gap-2">
            {current && <a href={`/${doc.slug}`} target="_blank" rel="noopener" className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink hover:bg-bg"><ExternalLink className="h-4 w-4" aria-hidden />View live</a>}
            {editable && !hasDraft && <NewDraftButton documentId={doc.id} label={versions.length ? "New version" : "Write first version"} />}
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-line bg-surface">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Versions</p>
          {versions.length === 0 ? (
            <p className="p-4 text-sm text-muted">No versions yet.{editable ? " Start with “Write first version”." : ""}</p>
          ) : (
            <ul className="divide-y divide-line">
              {versions.map((v) => {
                const st = statusOf(v, current?.id, v.id);
                return (
                  <li key={v.id}>
                    <Link href={`/admin/compliance/legal/${doc.id}?v=${v.id}`} className={cn("block px-4 py-3 text-sm hover:bg-bg", selected?.id === v.id && "bg-primary-soft/60")}>
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-ink">v{v.version}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", st.cls)}>{st.label}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {v.effectiveAt ? `From ${formatDateTime(v.effectiveAt)}` : `Edited ${formatDateTime(v.updatedAt)}`}
                        {v.status !== "DRAFT" && ` · ${v._count.acceptances} accepted`}
                        {!v.legalReviewed && v.status !== "DRAFT" && " · not reviewed"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="min-w-0 space-y-5">
          {selected && (
            <section className="rounded-2xl border border-line bg-surface p-5">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-ink">Version {selected.version}</h2>
                <p className="text-xs text-muted">
                  {selected.createdById && `Started by ${names.get(selected.createdById) ?? "a former user"}`}
                  {selected.publishedAt && ` · Published ${formatDateTime(selected.publishedAt)}${selected.publishedById ? ` by ${names.get(selected.publishedById) ?? "a former user"}` : ""}`}
                </p>
              </div>
              {selected.summaryOfChanges && selected.status !== "DRAFT" && <p className="mb-4 rounded-lg bg-bg px-3 py-2 text-sm text-ink"><span className="font-semibold">Changes: </span>{selected.summaryOfChanges}</p>}
              <VersionEditor
                key={selected.id + selected.updatedAt.toISOString()}
                documentId={doc.id}
                slug={doc.slug}
                editable={editable}
                requiresAcceptance={doc.requiresAcceptance}
                v={{ id: selected.id, version: selected.version, status: selected.status, title: selected.title, content: selected.content, summaryOfChanges: selected.summaryOfChanges, requireReacceptance: selected.requireReacceptance, legalReviewed: selected.legalReviewed, legalReviewNote: selected.legalReviewNote, effectiveAt: selected.effectiveAt?.toISOString() ?? null }}
              />
            </section>
          )}

          {selected && base && (
            <section className="rounded-2xl border border-line bg-surface">
              <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
                <GitCompare className="h-4 w-4 text-primary" aria-hidden />
                <h2 className="text-sm font-semibold text-ink">Changes from v{base.version} to v{selected.version}</h2>
                <span className="text-xs text-muted">{changed ? `${changed} changed paragraph${changed === 1 ? "" : "s"}` : "No text changes"}</span>
                <span className="ml-auto flex flex-wrap gap-1 text-xs">
                  Compare with:
                  {versions.filter((v) => v.id !== selected.id).map((v) => (
                    <Link key={v.id} href={`/admin/compliance/legal/${doc.id}?v=${selected.id}&compare=${v.id}`} className={cn("rounded-full px-2 py-0.5 font-semibold", v.id === base.id ? "bg-primary text-white" : "bg-bg text-ink hover:bg-primary-soft")}>v{v.version}</Link>
                  ))}
                </span>
              </div>
              <div className="max-h-[28rem] overflow-y-auto p-5 text-sm leading-relaxed">
                {changed === 0 ? (
                  <p className="text-muted">The text is the same.</p>
                ) : (
                  diff.map((d, i) => (
                    <p key={i} className={cn("rounded px-2 py-1", d.op === "add" && "bg-success/10 text-ink", d.op === "remove" && "bg-danger/10 text-ink/70 line-through", d.op === "same" && "text-muted")}>
                      <span className="mr-2 select-none font-mono text-xs">{d.op === "add" ? "+" : d.op === "remove" ? "−" : " "}</span>{d.text}
                    </p>
                  ))
                )}
              </div>
            </section>
          )}

          <ListPanel
            title="Acceptances"
            meta={`${showing(acc.page, 50, acc.total)}${acc.masked ? " · emails masked" : ""}`}
            actions={acc.masked ? <span className="inline-flex items-center gap-1 text-xs text-muted"><EyeOff className="h-3.5 w-3.5" aria-hidden />Needs “view personal data” to see emails</span> : undefined}
            footer={<PanelPagination page={acc.page} pages={acc.pages} basePath={`/admin/compliance/legal/${doc.id}`} params={sp} />}
          >
            {acc.rows.length === 0 ? (
              <PanelEmpty icon={<Users className="h-5 w-5" />} title="No acceptances yet">{doc.requiresAcceptance ? "They're recorded at sign-up and from the update notice." : "This document doesn't ask for acceptance."}</PanelEmpty>
            ) : (
              <AdminTable bare minWidth={44}>
                <thead><tr><th>Person</th><th>Version</th><th>Where</th><th>When</th></tr></thead>
                <tbody>
                  {acc.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="font-medium text-ink">{r.email}{!r.userId && <span className="block text-xs font-normal text-muted">Account deleted</span>}</td>
                      <td>v{r.version.version}</td>
                      <td>{CONTEXT[r.context] ?? r.context}</td>
                      <td className="whitespace-nowrap text-muted">{formatDateTime(r.acceptedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </AdminTable>
            )}
          </ListPanel>
        </div>
      </div>
    </>
  );
}
