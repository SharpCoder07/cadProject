"use client";

import { SelectionBar } from "@/components/admin/bulk-table";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Plus, Search, Sparkles, Tags, Trash2, X } from "lucide-react";
import type { TaxonomyDef } from "@/lib/taxonomies";
import { slugifyTerm } from "@/lib/taxonomies";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { ListPanel, PanelEmpty, showing } from "@/components/admin/list-panel";
import { AdminTable } from "@/components/admin/page-header";
import { RelationPicker } from "@/components/admin/relation-picker";
import { RichTextEditor } from "@/components/admin/rich-text";
import { useServerAction } from "@/components/admin/use-action";
import { deleteTermsAction, installStarterTermsAction, saveTermAction } from "../actions";

export interface TermRow {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  description: string;
  headline: string;
  content: string;
  sortOrder: number;
  isActive: boolean;
  promotedSoftwareId: string | null;
  promotedName: string | null;
  promotedBadge: string;
  faqs: { question: string; answer: string }[];
  seoTitle: string;
  seoDescription: string;
  noIndex: boolean;
  count: number;
  children: number;
}

type Draft = Omit<TermRow, "id" | "parentName" | "promotedName" | "count" | "children">;
const EMPTY: Draft = { name: "", slug: "", parentId: null, description: "", headline: "", content: "", sortOrder: 0, isActive: true, promotedSoftwareId: null, promotedBadge: "", faqs: [], seoTitle: "", seoDescription: "", noIndex: false };

/** Indented parent options ("— Child") in tree order, excluding a term and its descendants. */
function parentOptions(all: { id: string; name: string; parentId: string | null }[], exclude?: string) {
  const kids = new Map<string | null, typeof all>();
  for (const t of all) kids.set(t.parentId, [...(kids.get(t.parentId) ?? []), t]);
  const out: { id: string; label: string }[] = [];
  const walk = (pid: string | null, depth: number) => {
    for (const t of kids.get(pid) ?? []) {
      if (t.id === exclude) continue;
      out.push({ id: t.id, label: `${"— ".repeat(depth)}${t.name}` });
      if (depth < 5) walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function TermFields({ def, draft, set, errors, parents, editingId, full }: { def: TaxonomyDef; draft: Draft; set: <K extends keyof Draft>(k: K, v: Draft[K]) => void; errors: Record<string, string[]>; parents: { id: string; name: string; parentId: string | null }[]; editingId: string | null; full: boolean }) {
  const err = (k: string) => errors[k]?.[0];
  return (
    <div className="space-y-4">
      <Field label="Name" htmlFor="t-name" error={err("name")} hint="The name is how it appears on your site." required>
        <Input id="t-name" value={draft.name} onChange={(e) => set("name", e.target.value)} maxLength={100} />
      </Field>
      <Field label="Slug" htmlFor="t-slug" error={err("slug")} hint={`The URL-friendly version of the name: /${def.path}/${draft.slug || slugifyTerm(draft.name || "name")}`}>
        <Input id="t-slug" value={draft.slug} onChange={(e) => set("slug", e.target.value.toLowerCase())} placeholder={draft.name ? slugifyTerm(draft.name) : ""} maxLength={80} />
      </Field>
      {def.hierarchical && (
        <Field label={`Parent ${def.singular.toLowerCase()}`} htmlFor="t-parent" error={err("parentId")} hint="Products in a child also appear on the parent's page.">
          <Select id="t-parent" value={draft.parentId ?? ""} onChange={(e) => set("parentId", e.target.value || null)}>
            <option value="">None</option>
            {parentOptions(parents, editingId ?? undefined).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Description" htmlFor="t-desc" error={err("description")} hint="Shown under the page heading.">
        <Textarea id="t-desc" rows={3} value={draft.description} onChange={(e) => set("description", e.target.value)} maxLength={600} />
      </Field>

      <div className="space-y-4 rounded-xl p-4 ring-1 ring-line">
        <div>
          <p className="text-sm font-semibold text-ink">Page presentation</p>
          <p className="text-xs text-muted">Customise the public page without changing the internal name.</p>
        </div>
        <Field label="Page heading" htmlFor="t-headline" hint={`Leave blank for “${def.headline.replace("{name}", draft.name || "…")}”.`}>
          <Input id="t-headline" value={draft.headline} onChange={(e) => set("headline", e.target.value)} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Field label="Promoted product" hint="Shown prominently on the right of the hero. Only published products tagged with this term appear.">
            <RelationPicker type="software" value={draft.promotedSoftwareId ? [draft.promotedSoftwareId] : []} onChange={(ids) => set("promotedSoftwareId", ids[0] ?? null)} placeholder="Search products…" />
          </Field>
          <Field label="Promoted badge" htmlFor="t-badge" hint="e.g. Editor's pick">
            <Input id="t-badge" value={draft.promotedBadge} onChange={(e) => set("promotedBadge", e.target.value)} maxLength={40} placeholder="Editor's pick" />
          </Field>
        </div>
      </div>

      {full && (
        <>
          <Field label="Page content" hint="Buying guide shown below the product list.">
            <RichTextEditor value={draft.content} onChange={(v) => set("content", v)} minHeight="8rem" />
          </Field>
          <div className="space-y-3 rounded-xl p-4 ring-1 ring-line">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Buyer FAQs</p>
              <Button size="sm" variant="secondary" onClick={() => set("faqs", [...draft.faqs, { question: "", answer: "" }])}><Plus className="h-3.5 w-3.5" aria-hidden /> Add FAQ</Button>
            </div>
            {draft.faqs.length === 0 && <p className="text-xs text-muted">No FAQs. They appear at the bottom of the page and in Google results.</p>}
            {draft.faqs.map((f, i) => (
              <div key={i} className="grid gap-2 rounded-lg bg-bg p-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Input value={f.question} onChange={(e) => set("faqs", draft.faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))} placeholder="Question" aria-label={`FAQ ${i + 1} question`} />
                  <Textarea rows={2} value={f.answer} onChange={(e) => set("faqs", draft.faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))} placeholder="Answer" aria-label={`FAQ ${i + 1} answer`} />
                </div>
                <button type="button" onClick={() => set("faqs", draft.faqs.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Remove FAQ ${i + 1}`}><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SEO title" htmlFor="t-seot" hint="Leave blank to use the page heading."><Input id="t-seot" value={draft.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} maxLength={120} /></Field>
            <Field label="Order" htmlFor="t-order" hint="Lower shows first in lists."><Input id="t-order" type="number" min={0} value={draft.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></Field>
          </div>
          <Field label="SEO description" htmlFor="t-seod"><Textarea id="t-seod" rows={2} value={draft.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} maxLength={300} /></Field>
          <div className="grid gap-3 rounded-xl p-3 ring-1 ring-line sm:grid-cols-2">
            <Switch label="Visible on the website" checked={draft.isActive} onChange={(e) => set("isActive", e.target.checked)} />
            <Switch label="Hide from search engines" checked={draft.noIndex} onChange={(e) => set("noIndex", e.target.checked)} />
          </div>
        </>
      )}
    </div>
  );
}

const ADD_EVENT = "terms:add";

/** Page-header buttons (top right, like Brands and Vendors): starter terms + add. */
export function TermsHeaderActions({ kind, singular }: { kind: TaxonomyDef["kind"]; singular: string }) {
  const starter = useServerAction(installStarterTermsAction);
  return (
    <>
      <Button size="sm" variant="secondary" loading={starter.pending} onClick={() => void starter.run({ kind })} title="Adds the common terms that are missing"><Sparkles className="h-4 w-4" aria-hidden /> Add starter terms</Button>
      <Button size="sm" onClick={() => window.dispatchEvent(new Event(ADD_EVENT))}><Plus className="h-4 w-4" aria-hidden /> Add {singular.toLowerCase()}</Button>
    </>
  );
}

export function TermsManager({ def, rows, parents, search, page, pages, total }: { def: TaxonomyDef; rows: TermRow[]; parents: { id: string; name: string; parentId: string | null }[]; search: string; page: number; pages: number; total: number }) {
  const router = useRouter();
  const [edit, setEdit] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [q, setQ] = useState(search);
  const update = useServerAction(saveTermAction, { onSuccess: () => setEdit(null) });
  const del = useServerAction(deleteTermsAction, { onSuccess: () => { setConfirm(null); setPicked([]); } });

  const go = (params: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", String(params.q));
    if (params.page && Number(params.page) > 1) sp.set("page", String(params.page));
    router.push(`/admin/taxonomies/${def.key}${sp.size ? `?${sp}` : ""}`);
  };
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => { if (q.trim() !== search.trim()) go({ q: q.trim() }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search as you type
  }, [q]);
  useEffect(() => {
    const onAdd = () => { update.setFieldErrors({}); setEdit({ id: null, draft: EMPTY }); };
    window.addEventListener(ADD_EVENT, onAdd);
    return () => window.removeEventListener(ADD_EVENT, onAdd);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resets local state
  }, []);
  const toPayload = (d: Draft) => ({ ...d, faqs: d.faqs.filter((f) => f.question.trim() && f.answer.trim()) });
  const allPicked = rows.length > 0 && rows.every((r) => picked.includes(r.id));

  return (
    <div>
      <div className="min-w-0 space-y-3">
        <SelectionBar count={picked.length} onClear={() => setPicked([])}>
          <Button size="sm" variant="danger" onClick={() => setConfirm(picked)}>Delete</Button>
        </SelectionBar>
        <ListPanel
          title={`All ${def.plural.toLowerCase()}`}
          meta={showing(page, 25, total)}
          actions={
            <>
              <label className="relative w-full sm:w-72">
                <span className="sr-only">Search {def.plural}</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") go({ q: q.trim() }); if (e.key === "Escape") setQ(""); }}
                  placeholder={`Search ${def.plural.toLowerCase()}…`}
                  autoComplete="off"
                  className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft"
                />
                {q && (
                  <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear search">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </label>
            </>
          }
          footer={
            pages > 1 && (
              <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm sm:px-5">
                <span className="text-xs text-muted">Page {page} of {pages}</span>
                <span className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => go({ q: search, page: page - 1 })}>Previous</Button>
                  <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => go({ q: search, page: page + 1 })}>Next</Button>
                </span>
              </div>
            )
          }
        >
        {rows.length === 0 ? (
          <PanelEmpty icon={<Tags className="h-5 w-5" />} title={search ? "Nothing matches your search" : `No ${def.plural.toLowerCase()} yet`}>{search ? "Try another word." : `Click “Add ${def.singular.toLowerCase()}”, or “Add starter terms” for the common ones.`}</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={48}>
            <thead>
              <tr>
                <th className="w-10"><input type="checkbox" className="h-4 w-4 rounded border-line" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? rows.map((r) => r.id) : [])} aria-label="Select all" /></th>
                <th>Name</th><th>Description</th><th>Slug</th><th className="text-right">Count</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn(!r.isActive && "opacity-60")}>
                  <td><input type="checkbox" className="h-4 w-4 rounded border-line" checked={picked.includes(r.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} aria-label={`Select ${r.name}`} /></td>
                  <td>
                    <button type="button" className="text-left font-semibold text-ink hover:text-mint-ink" onClick={() => { update.setFieldErrors({}); setEdit({ id: r.id, draft: { ...r } }); }}>{r.name}</button>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      {r.parentName && <span className="text-xs text-muted">in {r.parentName}</span>}
                      {!r.isActive && <Badge>Hidden</Badge>}
                      {r.promotedName && <Badge tone="accent">Promotes {r.promotedName}</Badge>}
                    </span>
                  </td>
                  <td className="max-w-[16rem] truncate text-muted">{r.description || "—"}</td>
                  <td className="font-mono text-xs text-muted">{r.slug}</td>
                  <td className="text-right tabular-nums">{r.count}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <a href={`/${def.path}/${r.slug}`} target="_blank" rel="noreferrer" className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink" aria-label={`View ${r.name} page`}><ExternalLink className="h-4 w-4" /></a>
                      <Button size="icon" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => { update.setFieldErrors({}); setEdit({ id: r.id, draft: { ...r } }); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => setConfirm([r.id])}><Trash2 className="h-4 w-4 text-danger" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
        </ListPanel>
        <p className="px-1 text-xs text-muted">Assign {def.plural.toLowerCase()} to products in the product editor → Classifications. <Link href={`/${def.path}`} target="_blank" className="underline">See all on the website</Link>.</p>
      </div>

      <Dialog open={edit !== null} onClose={() => setEdit(null)} size="lg" title={edit?.id ? `Edit “${edit.draft.name || "term"}”` : `Add ${def.singular.toLowerCase()}`}>
        {edit && (
          <form onSubmit={(e) => { e.preventDefault(); void update.run({ ...toPayload(edit.draft), kind: def.kind, id: edit.id }); }} className="space-y-4">
            <TermFields def={def} draft={edit.draft} set={(k, v) => setEdit((x) => (x ? { ...x, draft: { ...x.draft, [k]: v } } : x))} errors={update.fieldErrors} parents={parents} editingId={edit.id} full />
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={update.pending}>{edit.id ? "Save" : `Add ${def.singular.toLowerCase()}`}</Button>
            </div>
          </form>
        )}
      </Dialog>

      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => confirm && void del.run({ kind: def.kind, ids: confirm })} busy={del.pending} title={`Delete ${confirm?.length === 1 ? "this term" : `${confirm?.length ?? 0} terms`}?`} confirmLabel="Delete" recycleBin>
        Products keep everything else; they just lose this {def.singular.toLowerCase()}. Child terms move up a level. The public page stops working.
      </ConfirmDialog>
    </div>
  );
}
