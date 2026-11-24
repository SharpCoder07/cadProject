"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, MapPin, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge, type BadgeTone } from "@/components/ui/misc";
import { ListPanel, PanelEmpty, showingAll } from "@/components/admin/list-panel";
import { useBulkAction, useServerAction } from "@/components/admin/use-action";
import { SelectionBar } from "@/components/admin/bulk-table";
import { deleteLocationAction, installLocationsAction, saveLocationAction, setLocationPublishedAction } from "../actions";

type Level = "COUNTRY" | "STATE" | "CITY" | "AREA";
export interface LocationRow {
  id: string;
  name: string;
  slug: string;
  level: Level;
  parentId: string | null;
  path: string;
  isPublished: boolean;
  priority: number;
  latitude: number | null;
  longitude: number | null;
  pinCodes: string[];
  businessZones: string[];
  children: number;
  pages: number;
}

const PARENT: Record<Level, Level | null> = { COUNTRY: null, STATE: "COUNTRY", CITY: "STATE", AREA: "CITY" };
const TONE: Record<Level, BadgeTone> = { COUNTRY: "primary", STATE: "neutral", CITY: "success", AREA: "accent" };
const label = (l: Level) => l.charAt(0) + l.slice(1).toLowerCase();

interface Draft {
  name: string;
  slug: string;
  level: Level;
  parentId: string | null;
  isPublished: boolean;
  priority: number;
  latitude: string;
  longitude: string;
  pinCodes: string;
  businessZones: string;
}
const EMPTY: Draft = { name: "", slug: "", level: "CITY", parentId: null, isPublished: true, priority: 0, latitude: "", longitude: "", pinCodes: "", businessZones: "" };
const toPayload = (d: Draft) => ({ ...d, latitude: d.latitude, longitude: d.longitude });

function LocationFields({ draft, set, rows, errors, editingId }: { draft: Draft; set: (d: Partial<Draft>) => void; rows: LocationRow[]; errors: Record<string, string[]>; editingId: string | null }) {
  const parentLevel = PARENT[draft.level];
  const parents = parentLevel ? rows.filter((r) => r.level === parentLevel && r.id !== editingId) : [];
  const err = (k: string) => errors[k]?.[0];
  return (
    <div className="space-y-4">
      <Field label="Name" htmlFor="l-name" error={err("name")} required><Input id="l-name" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Bengaluru" /></Field>
      <Field label="Slug" htmlFor="l-slug" error={err("slug")} hint="Used in URLs, e.g. /bengaluru/autodesk. Must be unique."><Input id="l-slug" value={draft.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} placeholder="auto from name" /></Field>
      <Field label="Level" htmlFor="l-level">
        <Select id="l-level" value={draft.level} onChange={(e) => set({ level: e.target.value as Level, parentId: null })}>
          {(["COUNTRY", "STATE", "CITY", "AREA"] as Level[]).map((l) => <option key={l} value={l}>{label(l)}</option>)}
        </Select>
      </Field>
      <Field label="Parent location" htmlFor="l-parent" error={err("parentId")} hint="Only valid parents are shown for the selected level.">
        <Select id="l-parent" value={draft.parentId ?? ""} onChange={(e) => set({ parentId: e.target.value || null })} disabled={!parentLevel}>
          <option value="">{parentLevel ? `Choose a ${parentLevel.toLowerCase()}…` : "No parent (country only)"}</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.path}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status" htmlFor="l-status">
          <Select id="l-status" value={draft.isPublished ? "1" : "0"} onChange={(e) => set({ isPublished: e.target.value === "1" })}><option value="1">Published</option><option value="0">Draft</option></Select>
        </Field>
        <Field label="Priority" htmlFor="l-priority" hint="Higher shows first"><Input id="l-priority" type="number" value={draft.priority} onChange={(e) => set({ priority: Number(e.target.value) })} /></Field>
        <Field label="Latitude" htmlFor="l-lat" error={err("latitude")}><Input id="l-lat" inputMode="decimal" value={draft.latitude} onChange={(e) => set({ latitude: e.target.value })} /></Field>
        <Field label="Longitude" htmlFor="l-lng" error={err("longitude")}><Input id="l-lng" inputMode="decimal" value={draft.longitude} onChange={(e) => set({ longitude: e.target.value })} /></Field>
      </div>
      <Field label="PIN codes" htmlFor="l-pins" error={err("pinCodes")} hint="Comma separated, 6 digits each."><Textarea id="l-pins" rows={2} value={draft.pinCodes} onChange={(e) => set({ pinCodes: e.target.value })} placeholder="560066, 560037" /></Field>
      <Field label="Business zones" htmlFor="l-zones" error={err("businessZones")} hint="Comma separated, shown on geo pages."><Textarea id="l-zones" rows={2} value={draft.businessZones} onChange={(e) => set({ businessZones: e.target.value })} placeholder="ITPL, Brookefield" /></Field>
    </div>
  );
}

const ADD_EVENT = "geo-locations:add";

/** Page-header buttons (top right): starter locations + add. */
export function LocationsHeaderActions() {
  const install = useServerAction(installLocationsAction);
  return (
    <>
      <Button size="sm" variant="secondary" loading={install.pending} onClick={() => void install.run({})}><Download className="h-4 w-4" aria-hidden /> Install / repair starter locations</Button>
      <Button size="sm" onClick={() => window.dispatchEvent(new Event(ADD_EVENT))}><Plus className="h-4 w-4" aria-hidden /> Add location</Button>
    </>
  );
}

export function LocationsManager({ rows }: { rows: LocationRow[] }) {
  const [edit, setEdit] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [remove, setRemove] = useState<LocationRow | null>(null);
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<"" | Level>("");
  const update = useServerAction(saveLocationAction, { onSuccess: () => setEdit(null) });
  const del = useServerAction(deleteLocationAction, { onSuccess: () => setRemove(null) });

  useEffect(() => {
    const onAdd = () => { update.setFieldErrors({}); setEdit({ id: null, draft: EMPTY }); };
    window.addEventListener(ADD_EVENT, onAdd);
    return () => window.removeEventListener(ADD_EVENT, onAdd);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resets local state
  }, []);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => (!level || r.level === level) && (!n || r.path.toLowerCase().includes(n) || r.slug.includes(n) || r.pinCodes.some((p) => p.startsWith(n))));
  }, [rows, q, level]);

  // Bulk select: publish, unpublish or delete several locations at once (only the rows on screen).
  const [picked, setPicked] = useState<string[]>([]);
  const [bulkDelete, setBulkDelete] = useState(false);
  const bulk = useBulkAction();
  const done = () => { setPicked([]); setBulkDelete(false); };
  const onScreen = shown.slice(0, 400);
  const allOn = onScreen.length > 0 && onScreen.every((r) => picked.includes(r.id));

  const toDraft = (r: LocationRow): Draft => ({ name: r.name, slug: r.slug, level: r.level, parentId: r.parentId, isPublished: r.isPublished, priority: r.priority, latitude: r.latitude?.toString() ?? "", longitude: r.longitude?.toString() ?? "", pinCodes: r.pinCodes.join(", "), businessZones: r.businessZones.join(", ") });

  return (
    <div className="space-y-4">
      <div>
        <SelectionBar count={picked.length} onClear={() => setPicked([])}>
          <Button size="sm" variant="secondary" loading={bulk.pending} onClick={() => void bulk.run(picked, (id) => setLocationPublishedAction({ id, isPublished: true }), "Published", done)}>Publish</Button>
          <Button size="sm" variant="secondary" loading={bulk.pending} onClick={() => void bulk.run(picked, (id) => setLocationPublishedAction({ id, isPublished: false }), "Unpublished", done)}>Unpublish</Button>
          <Button size="sm" variant="danger" onClick={() => setBulkDelete(true)}>Delete</Button>
        </SelectionBar>
        <ListPanel
          className="min-w-0"
          title="All locations"
          meta={shown.length > 400 ? `Showing 1–400 of ${shown.length.toLocaleString("en-IN")}` : showingAll(shown.length)}
          actions={
            <>
              <Select value={level} onChange={(e) => setLevel(e.target.value as "" | Level)} aria-label="Filter by level" className="h-10 w-36 shrink-0">
                <option value="">All levels</option>
                {(["COUNTRY", "STATE", "CITY", "AREA"] as Level[]).map((l) => <option key={l} value={l}>{label(l)}</option>)}
              </Select>
              <label className="relative w-full sm:w-72">
                <span className="sr-only">Search locations</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} placeholder="Search locations or PIN…" autoComplete="off" className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft" />
                {q && (
                  <button type="button" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Clear search">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </label>
            </>
          }
        >
          {shown.length === 0 ? (
            <PanelEmpty icon={<MapPin className="h-5 w-5" />} title={rows.length ? "No locations match" : "No locations yet"}>{rows.length ? "Try another search." : "Click “Add location”, or “Install / repair starter locations” to load India, UAE and Saudi Arabia."}</PanelEmpty>
          ) : (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="sticky top-0 bg-bg text-xs font-semibold uppercase tracking-[0.05em] text-muted">
                  <tr className="border-b border-line"><th className="w-10 py-2.5 pl-4"><input type="checkbox" checked={allOn} onChange={(e) => setPicked(e.target.checked ? [...new Set([...picked, ...onScreen.map((r) => r.id)])] : picked.filter((id) => !onScreen.some((r) => r.id === id)))} aria-label="Select all" className="h-4 w-4 rounded border-line text-primary" /></th><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Level</th><th className="px-4 py-2.5">Full path</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Pages</th><th /></tr>
                </thead>
                <tbody className="divide-y divide-line [&_tr]:transition-colors [&_tr:hover]:bg-bg/60">
                  {shown.slice(0, 400).map((r) => (
                    <tr key={r.id} className={cn(!r.isPublished && "opacity-60")}>
                      <td className="py-2.5 pl-4"><input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked((x) => (e.target.checked ? [...x, r.id] : x.filter((i) => i !== r.id)))} aria-label={`Select ${r.name}`} className="h-4 w-4 rounded border-line text-primary" /></td>
                      <td className="px-4 py-2.5"><button type="button" className="font-semibold text-ink hover:text-mint-ink" onClick={() => { update.setFieldErrors({}); setEdit({ id: r.id, draft: toDraft(r) }); }}>{r.name}</button><span className="block font-mono text-[11px] text-muted">{r.slug}</span></td>
                      <td className="px-4 py-2.5"><Badge tone={TONE[r.level]}>{label(r.level)}</Badge></td>
                      <td className="px-4 py-2.5 text-muted">{r.path}</td>
                      <td className="px-4 py-2.5"><Badge tone={r.isPublished ? "success" : "neutral"}>{r.isPublished ? "Published" : "Draft"}</Badge></td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{r.pages}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" aria-label={`Edit ${r.name}`} onClick={() => { update.setFieldErrors({}); setEdit({ id: r.id, draft: toDraft(r) }); }}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" aria-label={`Delete ${r.name}`} onClick={() => setRemove(r)}><Trash2 className="h-4 w-4 text-danger" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {shown.length > 400 && <p className="p-3 text-center text-xs text-muted">Showing the first 400. Search to narrow down.</p>}
            </div>
          )}
        </ListPanel>
      </div>

      <Dialog open={edit !== null} onClose={() => setEdit(null)} title={edit?.id ? `Edit ${edit.draft.name}` : "Add a location"}>
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void update.run({ ...toPayload(edit.draft), id: edit.id }); }}>
            <LocationFields draft={edit.draft} set={(d) => setEdit((x) => (x ? { ...x, draft: { ...x.draft, ...d } } : x))} rows={rows} errors={update.fieldErrors} editingId={edit.id} />
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={update.pending}>{edit.id ? "Save" : "Add location"}</Button>
            </div>
          </form>
        )}
      </Dialog>
      <ConfirmDialog
        open={bulkDelete}
        onClose={() => setBulkDelete(false)}
        onConfirm={() => void bulk.run(picked, (id) => deleteLocationAction({ id }), "Deleted", done)}
        busy={bulk.pending}
        title={`Delete ${picked.length} ${picked.length === 1 ? "location" : "locations"}?`}
        confirmLabel="Delete"
        recycleBin
      >
        Locations that still have locations or city pages inside them are skipped. Unpublish those instead.
      </ConfirmDialog>
      <ConfirmDialog open={remove !== null} onClose={() => setRemove(null)} onConfirm={() => remove && void del.run({ id: remove.id })} busy={del.pending} title={`Delete ${remove?.name ?? ""}?`} confirmLabel="Delete" recycleBin={!(remove && (remove.children || remove.pages))}>
        {remove && (remove.children || remove.pages) ? `It has ${remove.children} locations inside it and ${remove.pages} geo pages — those must be removed first.` : "Its geo pages’ addresses for this location stop working."}
      </ConfirmDialog>
    </div>
  );
}
