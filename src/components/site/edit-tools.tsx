"use client";

import { useEffect, useState } from "react";
import { ClipboardPaste, LayoutTemplate, PanelLeft, PanelTop, X } from "lucide-react";
import { BLOCK_META, defaultBlockData, type BlockType } from "@/lib/blocks/schemas";
import { BLOCK_FIELDS } from "@/components/admin/blocks/block-fields";

/** Fields of a block that belong to a part of it with its own edit outline (e.g. the hero's logo strip). */
const SPLIT_OUT: Partial<Record<string, string[]>> = { HERO: ["logoBrandIds"] };
import { BlockForm, MediaPreviews, SingleColumn } from "@/components/admin/blocks/block-form";
import { discoverFields, liveSection, type LiveTarget } from "@/lib/live-edit";
import type { UndoEntry } from "@/lib/live-edit-target";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { ToastProvider } from "@/components/ui/toast";
import { sectionName, useClearClipboard, useEditClipboard, useEditDock, type EditSection } from "./edit-mode";
import { clipToContent, newRow } from "@/lib/blocks/free-layout";

/** Switches the editors between "in the page" (in place of the section) and "docked on the left"; remembered. */
function DockButton() {
  const { docked, toggle } = useEditDock();
  const Icon = docked ? PanelTop : PanelLeft;
  return (
    <button type="button" onClick={toggle} title={docked ? "Show the editor in the page" : "Dock the editor on the left"} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted hover:bg-bg hover:text-ink">
      <Icon className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{docked ? "In page" : "Dock left"}</span>
    </button>
  );
}

type Apply = (next: EditSection[], message: string, openAfter?: number, reveal?: number) => Promise<boolean>;
interface Props {
  info: { page: { id: string; title: string }; sections: EditSection[]; reusable: { id: string; name: string; type: string }[]; canDeleteSections?: boolean };
  busy: boolean;
  editingKey: string | null;
  addingAt: number | null;
  onClose: () => void;
  apply: Apply;
  /** Tells edit mode whether the open panel has unsaved changes (so another section doesn't replace it). */
  onDirty?: (dirty: boolean) => void;
}

/** Edit mode tools loaded only for editors: the section side panel, "Add a section" and delete confirmation. */
export function EditTools(props: Props) {
  return (
    <ToastProvider>
      <Tools {...props} />
    </ToastProvider>
  );
}

function Tools({ info, busy, editingKey, addingAt, onClose, apply, onDirty }: Props) {
  if (editingKey?.startsWith("delete:")) {
    const key = editingKey.slice(7);
    const s = info.sections.find((x) => x.key === key);
    return (
      <ConfirmDialog
        open
        onClose={onClose}
        busy={busy}
        title="Delete this section?"
        confirmLabel="Delete"
        onConfirm={async () => { if (await apply(info.sections.filter((x) => x.key !== key), `Deleted “${s ? sectionName(s) : "section"}” (edit mode)`)) onClose(); }}
      >
        It disappears from the page now. To bring it back, restore an earlier version in Admin › Pages › {info.page.title}, or use Hide instead to keep it.
      </ConfirmDialog>
    );
  }
  if (addingAt !== null) return <AddSection info={info} at={addingAt} busy={busy} onClose={onClose} apply={apply} />;
  if (editingKey?.startsWith("copy:")) {
    // Duplicate: an unsaved copy to check / change first; it's only added to the page on Save.
    const from = info.sections.find((x) => x.key === editingKey.slice(5));
    if (!from) return null;
    const copy: EditSection = { ...from, key: `copy-of-${from.key}`, id: undefined, label: from.label ? `${from.label} (copy)` : null, data: structuredClone(from.data) };
    return <SectionPanel key={copy.key} section={copy} copyOf={from} info={info} busy={busy} onClose={onClose} apply={apply} onDirty={onDirty} />;
  }
  const s = info.sections.find((x) => x.key === editingKey);
  return s ? <SectionPanel key={s.key} section={s} info={info} busy={busy} onClose={onClose} apply={apply} onDirty={onDirty} /> : null;
}

function SectionPanel({ section, copyOf, info, busy, onClose, apply, onDirty }: { section: EditSection; /** Set for a duplicate that isn't saved yet: Save adds it below this section. */ copyOf?: EditSection; info: Props["info"]; busy: boolean; onClose: () => void; apply: Apply; onDirty?: (d: boolean) => void }) {
  const [draft, setDraft] = useState(section);
  const dirty = Boolean(copyOf) || JSON.stringify(draft) !== JSON.stringify(section);
  useEffect(() => { onDirty?.(dirty); }, [dirty, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);
  const type = section.type as BlockType;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !dirty && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [dirty, onClose]);
  const save = async () => {
    if (copyOf) {
      const at = info.sections.findIndex((x) => x.key === copyOf.key) + 1;
      if (await apply([...info.sections.slice(0, at), draft, ...info.sections.slice(at)], `Duplicated “${sectionName(copyOf)}” (edit mode)`)) onClose();
      return;
    }
    if (await apply(info.sections.map((x) => (x.key === section.key ? draft : x)), `Edited “${sectionName(draft)}” (edit mode)`)) onClose();
  };
  return (
    <aside className="relative z-[1] mx-auto flex w-full max-w-4xl flex-col rounded-2xl border border-line bg-surface text-left text-ink shadow-[0_24px_60px_-30px_rgb(0_0_0/0.45)]" aria-label="Edit section">
      <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">{copyOf ? "Copy of this section — not saved yet" : "Edit section"}</p>
          <h2 className="truncate text-lg font-bold text-ink">{BLOCK_META[type]?.label ?? section.type}</h2>
          <p className="text-xs text-muted">{BLOCK_META[type]?.description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <DockButton />
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium text-ink">Internal label <span className="font-normal text-muted">(optional, only staff see it)</span></span>
          <Input value={draft.label ?? ""} onChange={(e) => setDraft({ ...draft, label: e.target.value || null })} placeholder="e.g. Spring offer banner" />
        </label>
        {section.reusableBlockId ? (
          <p className="rounded-xl border border-line bg-bg p-4 text-sm text-muted">
            This section shows the reusable block “{section.reusableName}”. Edit it in{" "}
            <a href="/admin/cms/blocks" className="font-semibold text-primary hover:underline">Admin › Reusable blocks</a>; changes apply on every page that uses it.
          </p>
        ) : (
          <SingleColumn.Provider value>
            <BlockForm fields={(BLOCK_FIELDS[type] ?? []).filter((f) => !SPLIT_OUT[type]?.includes(f.name))} value={draft.data} idPrefix={`edit-${section.key}`} onChange={(data) => setDraft({ ...draft, data })} />
          </SingleColumn.Provider>
        )}
      </div>
      <footer className="sticky bottom-0 z-[1] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-b-2xl border-t border-line bg-surface px-5 py-3">
        <span className="min-w-0 flex-1 basis-48 text-xs text-muted">{copyOf ? "Not on the page yet — Save copy adds it below the original" : dirty ? "Unsaved changes" : "No changes yet"}</span>
        <div className="ml-auto flex shrink-0 gap-2 whitespace-nowrap">
          <button type="button" onClick={onClose} className="h-9 rounded-xl border border-line px-3.5 text-sm font-medium text-ink hover:bg-bg">Cancel</button>
          <button type="button" disabled={!dirty || busy} onClick={() => void save()} className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary/90 disabled:opacity-50">
            {busy ? "Saving…" : copyOf ? "Save copy" : "Save & update page"}
          </button>
        </div>
      </footer>
    </aside>
  );
}

function AddSection({ info, at, busy, onClose, apply }: { info: Props["info"]; at: number; busy: boolean; onClose: () => void; apply: Apply }) {
  const clip = useEditClipboard();
  const clearClip = useClearClipboard();
  // New sections are always Free layouts (built on the page). A copied section can come in too:
  // as a new Free layout holding it, ready to edit there.
  const insert = (data: Record<string, unknown>, label: string) => {
    onClose();
    void apply([...info.sections.slice(0, at), { key: `new-${Date.now()}`, type: "LAYOUT", label: null, isEnabled: true, data, reusableBlockId: null }, ...info.sections.slice(at)], `Added “${label}” (edit mode)`, undefined, at);
  };
  const empty = defaultBlockData("LAYOUT") as unknown as Record<string, unknown>;
  const fromClip = () => {
    if (!clip) return;
    const content = clipToContent(clip);
    const rows = "rows" in content ? content.rows : [{ ...newRow([12]), columns: [{ ...newRow([12]).columns[0]!, widgets: content.widgets }] }];
    insert({ rows }, clip.label);
  };
  const where = at >= info.sections.length ? "at the end of the page" : `as section ${at + 1}`;
  return (
    <Dialog open onClose={onClose} title="Add a section" description={`It's added ${where} as a draft (Publish puts it live).`} size="md">
      <div className="grid gap-3">
        <button type="button" disabled={busy} onClick={() => insert(empty, "Free layout")} className="flex items-start gap-3 rounded-panel border border-line p-4 text-left hover:border-mint hover:bg-mint-soft disabled:opacity-50">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><LayoutTemplate className="h-5 w-5" aria-hidden /></span>
          <span>
            <span className="block text-sm font-semibold">{BLOCK_META.LAYOUT.label}</span>
            <span className="mt-0.5 block text-xs text-muted">Rows and columns you fill with headings, text, images, buttons, videos… from the Widgets panel.</span>
          </span>
        </button>
        {clip ? (
          <div className="relative">
            <button type="button" disabled={busy} onClick={fromClip} className="flex w-full items-start gap-3 rounded-panel border border-dashed border-primary p-4 pr-12 text-left hover:bg-mint-soft disabled:opacity-50">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><ClipboardPaste className="h-5 w-5" aria-hidden /></span>
              <span>
                <span className="block text-sm font-semibold">Paste “{clip.label}”</span>
                <span className="mt-0.5 block text-xs text-muted">You copied this section earlier. Adds a new Free layout holding it, ready to edit.</span>
              </span>
            </button>
            <button type="button" onClick={clearClip} title="Clear the copied section" aria-label="Clear the copied section" className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <p className="rounded-panel bg-bg px-4 py-3 text-xs text-muted">Want an existing section here? Click <b>Copy</b> on its tab (on this or any page), then come back to paste it.</p>
        )}
      </div>
    </Dialog>
  );
}

/**
 * An admin screen shown in place of the part of the page it edits (edit mode). Saving there refreshes the page
 * behind it; links to website pages open in the main window.
 */
export function AdminPanel({ title, href, onClose }: { title: string; href: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const src = `${href}${href.includes("?") ? "&" : "?"}embed=1`;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);
  return (
    <>
      <aside className="relative z-[1] mx-auto flex w-full max-w-4xl flex-col rounded-2xl border border-line bg-surface text-left text-ink shadow-[0_24px_60px_-30px_rgb(0_0_0/0.45)]" aria-label={title}>
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Edit mode</p>
            <h2 className="truncate text-base font-bold text-ink">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href={href} target="_blank" rel="noopener" className="text-xs font-semibold text-primary hover:underline">Open in admin</a>
            <DockButton />
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="relative h-[75vh]">
          {loading && <p className="absolute inset-x-0 top-10 text-center text-sm text-muted">Loading…</p>}
          <iframe src={src} title={title} onLoad={() => setLoading(false)} className="h-full w-full rounded-b-2xl border-0 bg-bg" />
        </div>
        <p className="rounded-b-2xl border-t border-line bg-bg px-5 py-2 text-xs text-muted">Changes you save here go live straight away, and the page updates.</p>
      </aside>
    </>
  );
}

/**
 * Editing in place: everything in one part of the page, in a side panel with a tab per kind of
 * content (e.g. the product's fields, the wording on product pages, buttons & labels). Save updates
 * the live page.
 */
export function LivePanel({ targets, onClose, onSaved, onDirty }: { targets: LiveTarget[]; onClose: () => void; onSaved: (undo: UndoEntry[]) => void; onDirty?: (d: boolean) => void }) {
  return (
    <ToastProvider>
      <LivePanelInner targets={targets} onClose={onClose} onSaved={onSaved} onDirty={onDirty} />
    </ToastProvider>
  );
}

interface TabState { base: Record<string, unknown> | null; values: Record<string, unknown>; media: Record<string, string>; error: string | null; fieldErrors: Record<string, string[]>; /** Fields found in the part of the page (targets with `discover`). */ found: string[] }
const EMPTY: TabState = { base: null, values: {}, media: {}, error: null, fieldErrors: {}, found: [] };
/** A target with the fields found on the page added to its list. */
const effective = (t: LiveTarget, st: TabState | undefined): LiveTarget => (t.discover ? { ...t, only: [...(t.only ?? []), ...(st?.found ?? [])] } : t);

function LivePanelInner({ targets, onClose, onSaved, onDirty }: { targets: LiveTarget[]; onClose: () => void; onSaved: (undo: UndoEntry[]) => void; onDirty?: (d: boolean) => void }) {
  const [tab, setTab] = useState(0);
  const [tabs, setTabs] = useState<TabState[]>(() => targets.map(() => EMPTY));
  const [saving, setSaving] = useState(false);
  const defs = targets.map((t, i) => liveSection(effective(t, tabs[i])));
  const patchTab = (i: number, p: Partial<TabState>) => setTabs((all) => all.map((x, n) => (n === i ? { ...x, ...p } : x)));

  useEffect(() => {
    let alive = true;
    targets.forEach((t, i) => {
      fetch(`/api/edit/live?kind=${t.kind}&id=${encodeURIComponent(t.id)}`, { cache: "no-store" })
        .then(async (r) => {
          const data = (await r.json()) as { values?: Record<string, unknown>; media?: Record<string, string>; error?: string };
          if (!alive) return;
          if (!r.ok || !data.values) return patchTab(i, { error: data.error ?? "Couldn't load this content." });
          patchTab(i, { base: data.values, values: data.values, media: data.media ?? {}, found: t.discover ? discoverFields(t, data.values, t.discover) : [] });
        })
        .catch(() => alive && patchTab(i, { error: "Couldn't load this content. Check your connection." }));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per opened panel
  }, []);

  const changedIn = (i: number) => {
    const st = tabs[i]!;
    if (!st.base) return [];
    return (defs[i]?.fields ?? []).map((f) => f.name).filter((n) => JSON.stringify(st.values[n] ?? null) !== JSON.stringify(st.base![n] ?? null));
  };
  const totalChanges = targets.reduce((n, _t, i) => n + changedIn(i).length, 0);
  useEffect(() => { onDirty?.(totalChanges > 0); }, [totalChanges, onDirty]);
  useEffect(() => () => onDirty?.(false), [onDirty]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !totalChanges && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [totalChanges, onClose]);

  const save = async () => {
    setSaving(true);
    let failed = -1;
    const undo: UndoEntry[] = [];
    for (const [i, t] of targets.entries()) {
      const changed = changedIn(i);
      if (!changed.length) continue;
      patchTab(i, { error: null, fieldErrors: {} });
      try {
        const res = await fetch("/api/edit/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: t.kind, id: t.id, values: Object.fromEntries(changed.map((n) => [n, tabs[i]!.values[n] ?? null])) }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; fieldErrors?: Record<string, string[]>; undo?: UndoEntry[]; queued?: boolean; message?: string };
        undo.push(...(data.undo ?? []));
        // Removes something this role can't delete: sent to the Super Admin, nothing saved yet.
        if (!res.ok || data.queued) {
          patchTab(i, { error: data.queued ? data.message ?? "Sent to the Super Admin for approval." : data.error ?? "Couldn't save.", fieldErrors: data.fieldErrors ?? {} });
          if (failed < 0) failed = i;
          continue;
        }
        patchTab(i, { base: tabs[i]!.values });
      } catch {
        patchTab(i, { error: "Couldn't save. Check your connection and try again." });
        if (failed < 0) failed = i;
      }
    }
    setSaving(false);
    onSaved(undo);
    if (failed < 0) onClose();
    else setTab(failed);
  };

  // Tabs with nothing from this part of the page (once loaded) aren't shown.
  const shown = targets.map((_t, i) => !(tabs[i]?.base && defs[i] && defs[i]!.fields.length === 0));
  if (!shown[tab] && shown.some(Boolean)) setTimeout(() => setTab(shown.findIndex(Boolean)), 0);
  const st = tabs[tab] ?? EMPTY;
  const def = defs[tab];
  const t = targets[tab]!;
  const errorList = Object.entries(st.fieldErrors).flatMap(([k, v]) => (v?.[0] ? [`${k.split(".")[0]}: ${v[0]}`] : []));
  return (
    <aside className="relative z-[1] mx-auto flex w-full max-w-4xl flex-col rounded-2xl border border-line bg-surface text-left text-ink shadow-[0_24px_60px_-30px_rgb(0_0_0/0.45)]" aria-label="Edit">
      <header className="border-b border-line px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-primary">Edit on the page</p>
            <h2 className="truncate text-lg font-bold text-ink">{targets[0]?.title ?? defs[0]?.title ?? "Edit"}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <DockButton />
            <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
          </div>
        </div>
        {targets.length > 1 ? (
          <div className="-mb-px mt-3 flex gap-1 overflow-x-auto" role="tablist">
            {targets.map((x, i) => {
              if (!shown[i]) return null;
              const n = changedIn(i).length;
              return (
                <button key={`${x.kind}-${x.id}-${x.section}`} type="button" role="tab" aria-selected={tab === i} onClick={() => setTab(i)} className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${tab === i ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"}`}>
                  {i === 0 ? defs[i]?.title ?? x.title : x.title ?? defs[i]?.title}
                  {n > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 text-primary-fg">{n}</span>}
                  {tabs[i]?.error && <span className="h-2 w-2 rounded-full bg-danger" aria-label="has an error" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="h-3" />
        )}
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {!def ? (
          <p className="text-sm text-muted">This part can't be edited here.</p>
        ) : !st.base && !st.error ? (
          <p className="py-10 text-center text-sm text-muted">Loading…</p>
        ) : st.base ? (
          <MediaPreviews.Provider value={st.media}>
            <SingleColumn.Provider value>
              <BlockForm key={tab} fields={def.fields} value={st.values} idPrefix={`live-${t.kind}-${t.section}-${tab}`} onChange={(v) => patchTab(tab, { values: v })} />
            </SingleColumn.Provider>
          </MediaPreviews.Provider>
        ) : null}
        {st.error && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger" role="alert">
            {st.error}
            {errorList.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{errorList.map((e) => <li key={e}>{e}</li>)}</ul>}
          </div>
        )}
      </div>
      <footer className="sticky bottom-0 z-[1] flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-b-2xl border-t border-line bg-surface px-5 py-3">
        <span className="min-w-0 flex-1 basis-48 text-xs text-muted">{totalChanges ? `${totalChanges} change${totalChanges === 1 ? "" : "s"} — saved straight to the live page` : "No changes yet"}</span>
        <div className="ml-auto flex shrink-0 gap-2 whitespace-nowrap">
          <button type="button" onClick={onClose} className="h-9 rounded-xl border border-line px-3.5 text-sm font-medium text-ink hover:bg-bg">Cancel</button>
          <button type="button" disabled={!totalChanges || saving} onClick={() => void save()} className="h-9 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary/90 disabled:opacity-50">
            {saving ? "Saving…" : "Save & update page"}
          </button>
        </div>
      </footer>
    </aside>
  );
}
