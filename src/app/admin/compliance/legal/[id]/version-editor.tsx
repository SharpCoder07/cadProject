"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Eye, FilePlus2, Rocket, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { RichTextEditor } from "@/components/admin/rich-text";
import { useServerAction } from "@/components/admin/use-action";
import { archiveLegalVersionAction, createLegalDraftAction, deleteLegalDraftAction, publishLegalVersionAction, saveLegalDraftAction } from "../../actions";

export interface EditableVersion {
  id: string;
  version: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  title: string;
  content: string;
  summaryOfChanges: string | null;
  requireReacceptance: boolean;
  legalReviewed: boolean;
  legalReviewNote: string | null;
  effectiveAt: string | null;
}

export function NewDraftButton({ documentId, label = "New version" }: { documentId: string; label?: string }) {
  const router = useRouter();
  const run = useServerAction(createLegalDraftAction, { onSuccess: (vid) => router.push(`/admin/compliance/legal/${documentId}?v=${vid}`) });
  return <Button size="sm" loading={run.pending} onClick={() => void run.run({ documentId })}><FilePlus2 className="h-4 w-4" aria-hidden />{label}</Button>;
}

/** Draft editor (and, for published versions, the legal review note only). */
export function VersionEditor({ documentId, slug, v, editable, requiresAcceptance }: { documentId: string; slug: string; v: EditableVersion; editable: boolean; requiresAcceptance: boolean }) {
  const router = useRouter();
  const draft = v.status === "DRAFT";
  const [form, setForm] = useState({ version: v.version, title: v.title, content: v.content, summaryOfChanges: v.summaryOfChanges ?? "", requireReacceptance: v.requireReacceptance, legalReviewed: v.legalReviewed, legalReviewNote: v.legalReviewNote ?? "" });
  const [dirty, setDirty] = useState(false);
  const set = <K extends keyof typeof form>(k: K, val: (typeof form)[K]) => { setForm((f) => ({ ...f, [k]: val })); setDirty(true); };
  const save = useServerAction(saveLegalDraftAction, { onSuccess: () => setDirty(false) });
  const publish = useServerAction(publishLegalVersionAction, { onSuccess: () => setPublishing(false) });
  const remove = useServerAction(deleteLegalDraftAction, { onSuccess: () => router.push(`/admin/compliance/legal/${documentId}`) });
  const archive = useServerAction(archiveLegalVersionAction, { onSuccess: () => setArchiving(false) });
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const fe = (k: string) => save.fieldErrors[k] ?? save.fieldErrors.data;
  const doSave = () => save.run({ id: v.id, documentId, data: { ...form, summaryOfChanges: form.summaryOfChanges || null, legalReviewNote: form.legalReviewNote || null } });

  return (
    <div className="space-y-4">
      {draft ? (
        <>
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <Field label="Version" htmlFor="lv-version" error={save.fieldErrors.version}>
              <Input id="lv-version" value={form.version} disabled={!editable} onChange={(e) => set("version", e.target.value)} />
            </Field>
            <Field label="Title shown on the page" htmlFor="lv-title">
              <Input id="lv-title" value={form.title} disabled={!editable} onChange={(e) => set("title", e.target.value)} />
            </Field>
          </div>
          <Field label="Document text" hint="Use Heading 2 for sections: they become the “On this page” list.">
            {editable ? <RichTextEditor value={form.content} onChange={(html) => set("content", html)} minHeight="24rem" /> : <div className="prose-content max-w-none rounded-xl border border-line p-4" dangerouslySetInnerHTML={{ __html: form.content }} />}
          </Field>
          <Field label="Summary of changes" htmlFor="lv-summary" hint="Shown with the update notice when people are asked to accept again, and in the version history here.">
            <Textarea id="lv-summary" rows={3} value={form.summaryOfChanges} disabled={!editable} onChange={(e) => set("summaryOfChanges", e.target.value)} />
          </Field>
          {requiresAcceptance && (
            <Switch label="Ask people to accept this version" hint="Buyers, vendors or resellers this document applies to see a notice in their account until they accept it." checked={form.requireReacceptance} disabled={!editable} onChange={(e) => set("requireReacceptance", e.target.checked)} />
          )}
        </>
      ) : (
        <div className="prose-content max-w-none rounded-xl border border-line bg-bg/50 p-5" dangerouslySetInnerHTML={{ __html: v.content || "<p><em>No text.</em></p>" }} />
      )}

      <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
        <Switch label="Reviewed by a lawyer" checked={form.legalReviewed} disabled={!editable} onChange={(e) => set("legalReviewed", e.target.checked)} />
        <Field label="Review note" htmlFor="lv-note" className="mt-3">
          <Input id="lv-note" value={form.legalReviewNote} disabled={!editable} placeholder="Who reviewed it and when" onChange={(e) => set("legalReviewNote", e.target.value)} />
        </Field>
      </div>
      {save.fieldErrors.data && <p className="text-sm text-danger">{fe("data")?.[0]}</p>}

      {editable && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button variant={draft ? "secondary" : "primary"} loading={save.pending} onClick={() => void doSave()}><Save className="h-4 w-4" aria-hidden />{draft ? "Save draft" : "Save review note"}</Button>
          {draft && (
            <>
              <a href={`/${slug}?legalPreview=${v.id}`} target="_blank" rel="noopener" className="inline-flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-bg" title={dirty ? "Save first to preview your latest changes" : undefined}>
                <Eye className="h-4 w-4" aria-hidden />Preview{dirty ? " (last saved)" : ""}
              </a>
              <Button onClick={() => setPublishing(true)} disabled={dirty}><Rocket className="h-4 w-4" aria-hidden />Publish…</Button>
              <Button variant="ghost" className="ml-auto text-danger" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" aria-hidden />Delete draft</Button>
            </>
          )}
          {v.status === "PUBLISHED" && <Button variant="ghost" className="ml-auto" onClick={() => setArchiving(true)}><Archive className="h-4 w-4" aria-hidden />Archive version</Button>}
          {dirty && draft && <p className="w-full text-xs text-muted">Save the draft before publishing.</p>}
        </div>
      )}

      <Dialog open={publishing} onClose={() => setPublishing(false)} title={`Publish version ${form.version}`} description="Once published, this version's text can't be changed: make a new version for later edits.">
        <div className="space-y-3 text-sm">
          {!form.legalReviewed && <p className="rounded-lg bg-warning/10 p-3 text-ink">This version isn&apos;t marked as reviewed by a lawyer.</p>}
          <label className="flex items-center gap-2"><input type="radio" checked={when === "now"} onChange={() => setWhen("now")} /> In force now</label>
          <label className="flex items-center gap-2"><input type="radio" checked={when === "later"} onChange={() => setWhen("later")} /> In force from a later date</label>
          {when === "later" && <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} aria-label="In force from" />}
          {publish.fieldErrors.effectiveAt && <p className="text-danger">{publish.fieldErrors.effectiveAt[0]}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPublishing(false)}>Cancel</Button>
            <Button
              loading={publish.pending}
              disabled={when === "later" && !at}
              onClick={() => void publish.run({ id: v.id, documentId, effectiveAt: when === "later" && at ? new Date(at).toISOString() : null })}
            >
              Publish
            </Button>
          </div>
        </div>
      </Dialog>
      <ConfirmDialog open={deleting} onClose={() => setDeleting(false)} onConfirm={() => void remove.run({ id: v.id, documentId })} title={`Delete draft ${v.version}?`} confirmLabel="Delete draft" busy={remove.pending}>
        The draft text is deleted. Published versions aren&apos;t affected.
      </ConfirmDialog>
      <ConfirmDialog open={archiving} onClose={() => setArchiving(false)} onConfirm={() => void archive.run({ id: v.id, documentId })} title={`Archive version ${v.version}?`} confirmLabel="Archive" tone="primary" busy={archive.pending}>
        It stays on record with its acceptances. If it&apos;s the version in force, the previous published version applies again (or the Website page, if there is none).
      </ConfirmDialog>
    </div>
  );
}
