"use client";

import { SelectionBar } from "@/components/admin/bulk-table";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Layers, MapPinned, Plus, Search, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Alert, Badge } from "@/components/ui/misc";
import { ListPanel, PanelEmpty, showingAll } from "@/components/admin/list-panel";
import { AdminTable } from "@/components/admin/page-header";
import { RelationPicker } from "@/components/admin/relation-picker";
import { useServerAction } from "@/components/admin/use-action";
import { bulkCreateGeoPagesAction, deleteGeoPagesAction, publishGeoPagesAction, saveGeoPageAction } from "../actions";

type Section = "hero" | "introduction" | "guide" | "faqs";
type Faq = { question: string; answer: string };
export interface GeoPageRow {
  id: string;
  locationId: string;
  location: string;
  locationSlug: string;
  targetType: "software" | "vendor";
  targetId: string;
  targetName: string;
  targetSlug: string;
  targetLive: boolean;
  isPublished: boolean;
  noIndex: boolean;
  hero: string;
  introduction: string;
  guide: string;
  faqs: Faq[];
  inherit: string[];
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
}
interface Loc { id: string; name: string; slug: string; level: string; path: string; isPublished: boolean }
interface Template { hero: string; introduction: string; guide: string; faqs: Faq[] }

type Draft = Omit<GeoPageRow, "id" | "location" | "locationSlug" | "targetName" | "targetSlug" | "targetLive" | "updatedAt">;
const ALL: Section[] = ["hero", "introduction", "guide", "faqs"];
const EMPTY: Draft = { locationId: "", targetType: "software", targetId: "", isPublished: false, noIndex: false, hero: "", introduction: "", guide: "", faqs: [], inherit: ALL, seoTitle: "", seoDescription: "" };

function SectionBox({ title, name, draft, setDraft, placeholder, rows = 3, max }: { title: string; name: "hero" | "introduction" | "guide"; draft: Draft; setDraft: (d: Draft) => void; placeholder: string; rows?: number; max: number }) {
  const inherits = draft.inherit.includes(name);
  return (
    <details open className="rounded-xl ring-1 ring-line">
      <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">{title}</summary>
      <div className="space-y-2 px-4 pb-4">
        <Textarea rows={rows} value={draft[name]} maxLength={max} onChange={(e) => setDraft({ ...draft, [name]: e.target.value })} placeholder={inherits ? placeholder : "Leave empty to hide this section"} aria-label={title} />
        <Checkbox label="Inherit when empty" hint="Uses the template text from Geo settings." checked={inherits} onChange={(e) => setDraft({ ...draft, inherit: e.target.checked ? [...draft.inherit, name] : draft.inherit.filter((x) => x !== name) })} />
      </div>
    </details>
  );
}

const ADD_EVENT = "geo-pages:add";
const BULK_EVENT = "geo-pages:bulk";

/** Page-header buttons (top right): bulk create + new. */
export function GeoPagesHeaderActions() {
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => window.dispatchEvent(new Event(BULK_EVENT))}><Layers className="h-4 w-4" aria-hidden /> Create for many cities</Button>
      <Button size="sm" onClick={() => window.dispatchEvent(new Event(ADD_EVENT))}><Plus className="h-4 w-4" aria-hidden /> New geo page</Button>
    </>
  );
}

export function GeoPagesManager({ pages, locations, template, base, enabled, search, status }: { pages: GeoPageRow[]; locations: Loc[]; template: Template; base: string; enabled: boolean; search: string; status: string }) {
  const router = useRouter();
  const [edit, setEdit] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [bulk, setBulk] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [q, setQ] = useState(search);
  const save = useServerAction(saveGeoPageAction, { onSuccess: () => setEdit(null) });
  const del = useServerAction(deleteGeoPagesAction, { onSuccess: () => { setConfirm(null); setPicked([]); } });
  const pub = useServerAction(publishGeoPagesAction, { onSuccess: () => setPicked([]) });
  const err = (k: string) => save.fieldErrors[k]?.[0];

  const go = (next: { q?: string; status?: string }) => {
    const sp = new URLSearchParams();
    if (next.q) sp.set("q", next.q);
    if (next.status) sp.set("status", next.status);
    router.push(`/admin/geo/pages${sp.size ? `?${sp}` : ""}`);
  };
  useEffect(() => {
    const onAdd = () => { save.setFieldErrors({}); setEdit({ id: null, draft: EMPTY }); };
    const onBulk = () => setBulk(true);
    window.addEventListener(ADD_EVENT, onAdd);
    window.addEventListener(BULK_EVENT, onBulk);
    return () => { window.removeEventListener(ADD_EVENT, onAdd); window.removeEventListener(BULK_EVENT, onBulk); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resets local state
  }, []);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => { if (q.trim() !== search.trim()) go({ q: q.trim(), status }); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- search as you type
  }, [q]);
  const urlOf = (r: { locationSlug: string; targetType: string; targetSlug: string }) => (r.targetType === "software" ? `/${r.locationSlug}/${base}/${r.targetSlug}` : `/${r.locationSlug}/${r.targetSlug}`);
  const draft = edit?.draft;
  const setDraft = (d: Draft) => setEdit((x) => (x ? { ...x, draft: d } : x));
  const loc = locations.find((l) => l.id === draft?.locationId);

  return (
    <div className="space-y-4">
      {!enabled && <Alert tone="warning" title="Geo routes are switched off">Pages won&apos;t be reachable until you turn them on in <Link href="/admin/geo/settings" className="underline">Geo settings</Link>.</Alert>}
      <SelectionBar count={picked.length} onClear={() => setPicked([])}>
        <Button size="sm" variant="secondary" loading={pub.pending} onClick={() => void pub.run({ ids: picked, isPublished: true })}>Publish</Button>
        <Button size="sm" variant="secondary" loading={pub.pending} onClick={() => void pub.run({ ids: picked, isPublished: false })}>Unpublish</Button>
        <Button size="sm" variant="danger" onClick={() => setConfirm(picked)}>Delete</Button>
      </SelectionBar>
      <ListPanel
        title="All geo pages"
        meta={showingAll(pages.length)}
        actions={
          <>
            <Select value={status} onChange={(e) => go({ q, status: e.target.value })} className="h-10 w-36 shrink-0" aria-label="Filter by status">
              <option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option>
            </Select>
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search geo pages</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") go({ q: q.trim(), status }); if (e.key === "Escape") setQ(""); }} placeholder="Search city, product or brand…" autoComplete="off" className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft" />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear search">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </label>
          </>
        }
      >
      {pages.length === 0 ? (
        <PanelEmpty icon={<MapPinned className="h-5 w-5" />} title={search || status ? "No matching geo pages" : "No geo pages yet"}>{search || status ? "Try a different search or status." : "Create one for a product or brand in a city — or many at once."}</PanelEmpty>
      ) : (
        <AdminTable bare minWidth={56}>
          <thead><tr><th className="w-10"><input type="checkbox" className="h-4 w-4 rounded border-line" checked={pages.length > 0 && pages.every((p) => picked.includes(p.id))} onChange={(e) => setPicked(e.target.checked ? pages.map((p) => p.id) : [])} aria-label="Select all" /></th><th>Product or brand</th><th>Location</th><th>URL</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <td><input type="checkbox" className="h-4 w-4 rounded border-line" checked={picked.includes(p.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p.id] : x.filter((i) => i !== p.id)))} aria-label={`Select ${p.targetName} in ${p.location}`} /></td>
                <td>
                  <button type="button" className="font-semibold text-ink hover:text-mint-ink" onClick={() => { save.setFieldErrors({}); setEdit({ id: p.id, draft: { ...p } }); }}>{p.targetName}</button>
                  <span className="block text-xs text-muted">{p.targetType === "software" ? "Product" : "Brand"}{!p.targetLive && " · product not published"}</span>
                </td>
                <td>{p.location}</td>
                <td><a href={urlOf(p)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink">{urlOf(p)}<ExternalLink className="h-3 w-3" aria-hidden /></a></td>
                <td className="whitespace-nowrap"><Badge tone={p.isPublished ? "success" : "neutral"}>{p.isPublished ? "Published" : "Draft"}</Badge>{p.noIndex && <Badge className="ml-1">Noindex</Badge>}</td>
                <td className="whitespace-nowrap text-muted">{formatDateTime(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
      </ListPanel>

      <Dialog open={edit !== null} onClose={() => setEdit(null)} size="xl" title={edit?.id ? "Edit geo page" : "New geo page"} description="Empty sections that inherit use the template from Geo settings, with the product/brand and city filled in.">
        {draft && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save.run({ ...draft, template: "generic", id: edit!.id }); }}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Product or brand" error={err("targetId")} required>
                <div className="space-y-2">
                  <div className="flex gap-2 text-sm">
                    {(["software", "vendor"] as const).map((t) => (
                      <label key={t} className="inline-flex items-center gap-1.5"><input type="radio" name="geo-target" checked={draft.targetType === t} onChange={() => setDraft({ ...draft, targetType: t, targetId: "" })} />{t === "software" ? "Product" : "Brand"}</label>
                    ))}
                  </div>
                  <RelationPicker key={draft.targetType} type={draft.targetType} value={draft.targetId ? [draft.targetId] : []} onChange={(ids) => setDraft({ ...draft, targetId: ids[0] ?? "" })} placeholder={draft.targetType === "software" ? "Search products…" : "Search brands…"} />
                </div>
              </Field>
              <Field label="Location" htmlFor="g-loc" error={err("locationId")} hint="Cities and areas only." required>
                <Select id="g-loc" value={draft.locationId} onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}>
                  <option value="">Select city or area…</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.path}{l.isPublished ? "" : " (draft)"}</option>)}
                </Select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Template" htmlFor="g-tpl"><Select id="g-tpl" value="generic" disabled><option value="generic">Generic</option></Select></Field>
              <Field label="Status" htmlFor="g-status"><Select id="g-status" value={draft.isPublished ? "1" : "0"} onChange={(e) => setDraft({ ...draft, isPublished: e.target.value === "1" })}><option value="0">Draft</option><option value="1">Published</option></Select></Field>
              <Field label="SEO" htmlFor="g-seo"><Select id="g-seo" value={draft.noIndex ? "1" : "0"} onChange={(e) => setDraft({ ...draft, noIndex: e.target.value === "1" })}><option value="0">Index</option><option value="1">Noindex</option></Select></Field>
            </div>
            <SectionBox title="Top banner" name="hero" draft={draft} setDraft={setDraft} placeholder={template.hero} rows={2} max={400} />
            <SectionBox title="Introduction" name="introduction" draft={draft} setDraft={setDraft} placeholder={template.introduction} rows={4} max={4000} />
            <SectionBox title="Buying guide" name="guide" draft={draft} setDraft={setDraft} placeholder={template.guide} rows={4} max={6000} />
            <details open className="rounded-xl ring-1 ring-line">
              <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold">FAQs</summary>
              <div className="space-y-2 px-4 pb-4">
                {draft.faqs.map((f, i) => (
                  <div key={i} className="grid gap-2 rounded-lg bg-bg p-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Input value={f.question} onChange={(e) => setDraft({ ...draft, faqs: draft.faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} placeholder="Question" aria-label={`FAQ ${i + 1} question`} />
                      <Textarea rows={2} value={f.answer} onChange={(e) => setDraft({ ...draft, faqs: draft.faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })} placeholder="Answer" aria-label={`FAQ ${i + 1} answer`} />
                    </div>
                    <button type="button" onClick={() => setDraft({ ...draft, faqs: draft.faqs.filter((_, j) => j !== i) })} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Remove FAQ ${i + 1}`}><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Checkbox label="Inherit when empty" hint={`${template.faqs.length} template FAQs`} checked={draft.inherit.includes("faqs")} onChange={(e) => setDraft({ ...draft, inherit: e.target.checked ? [...draft.inherit, "faqs"] : draft.inherit.filter((x) => x !== "faqs") })} />
                  <Button size="sm" variant="secondary" onClick={() => setDraft({ ...draft, faqs: [...draft.faqs, { question: "", answer: "" }] })}><Plus className="h-3.5 w-3.5" aria-hidden /> Add FAQ</Button>
                </div>
              </div>
            </details>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SEO title" htmlFor="g-st" hint="Default: “{name} in {city} — Price, Demo & Dealers”"><Input id="g-st" value={draft.seoTitle} onChange={(e) => setDraft({ ...draft, seoTitle: e.target.value })} maxLength={120} /></Field>
              <Field label="SEO description" htmlFor="g-sd" hint="Default: the hero text"><Input id="g-sd" value={draft.seoDescription} onChange={(e) => setDraft({ ...draft, seoDescription: e.target.value })} maxLength={300} /></Field>
            </div>
            {loc && <p className="text-xs text-muted">Address: <span className="font-mono">{draft.targetType === "software" ? `/${loc.slug}/${base}/…` : `/${loc.slug}/…`}</span></p>}
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={save.pending}>Save geo page</Button>
            </div>
          </form>
        )}
      </Dialog>

      <BulkCreate open={bulk} onClose={() => setBulk(false)} locations={locations} />
      <ConfirmDialog open={confirm !== null} onClose={() => setConfirm(null)} onConfirm={() => confirm && void del.run({ ids: confirm })} busy={del.pending} title={`Delete ${confirm?.length ?? 0} geo ${confirm?.length === 1 ? "page" : "pages"}?`} confirmLabel="Delete" recycleBin>
        The pages stop working straight away. Products, brands and locations aren&apos;t affected.
      </ConfirmDialog>
    </div>
  );
}

function BulkCreate({ open, onClose, locations }: { open: boolean; onClose: () => void; locations: Loc[] }) {
  const [targetType, setTargetType] = useState<"software" | "vendor">("software");
  const [targetId, setTargetId] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [publish, setPublish] = useState(false);
  const [filter, setFilter] = useState("");
  const run = useServerAction(bulkCreateGeoPagesAction, { onSuccess: () => { onClose(); setIds([]); } });
  const shown = useMemo(() => locations.filter((l) => !filter || l.path.toLowerCase().includes(filter.toLowerCase())), [locations, filter]);
  const cities = locations.filter((l) => l.level === "CITY" && l.isPublished).map((l) => l.id);
  return (
    <Dialog open={open} onClose={onClose} size="lg" title="Create geo pages for many cities" description="Pages start with the template text; edit any of them later.">
      <div className="space-y-4">
        <Field label="Product or brand" error={run.fieldErrors.targetId?.[0]} required>
          <div className="space-y-2">
            <div className="flex gap-3 text-sm">
              {(["software", "vendor"] as const).map((t) => <label key={t} className="inline-flex items-center gap-1.5"><input type="radio" name="bulk-target" checked={targetType === t} onChange={() => { setTargetType(t); setTargetId(""); }} />{t === "software" ? "Product" : "Brand"}</label>)}
            </div>
            <RelationPicker key={targetType} type={targetType} value={targetId ? [targetId] : []} onChange={(v) => setTargetId(v[0] ?? "")} placeholder="Search…" />
          </div>
        </Field>
        <Field label={`Locations (${ids.length} selected)`} error={run.fieldErrors.locationIds?.[0]}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter…" className="max-w-xs" aria-label="Filter locations" />
              <Button size="sm" variant="secondary" onClick={() => setIds(cities)}>All published cities ({cities.length})</Button>
              <Button size="sm" variant="ghost" onClick={() => setIds([])}>Clear</Button>
            </div>
            <div className="max-h-64 overflow-auto rounded-xl p-2 ring-1 ring-line">
              {shown.map((l) => (
                <label key={l.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-bg">
                  <input type="checkbox" checked={ids.includes(l.id)} onChange={(e) => setIds((x) => (e.target.checked ? [...x, l.id] : x.filter((i) => i !== l.id)))} />
                  <span>{l.path}</span>{l.level === "AREA" && <Badge tone="accent">Area</Badge>}
                </label>
              ))}
            </div>
          </div>
        </Field>
        <Switch label="Publish them straight away" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" loading={run.pending} disabled={!targetId || !ids.length} onClick={() => void run.run({ targetType, targetId, locationIds: ids, isPublished: publish })}>Create {ids.length || ""} pages</Button>
        </div>
      </div>
    </Dialog>
  );
}
