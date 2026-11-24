"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Columns3, FileStack, LayoutTemplate, Pencil, Search, Trash2, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, type AdminNavLink } from "@/components/admin/nav";

/**
 * Website edit mode, stage 4: the Templates panel (sections, rows and pages saved to reuse), the
 * "Save as template" dialog, and the Finder (Ctrl+K) to jump to any page, template or admin screen.
 */

export type TemplateKind = "section" | "row" | "page";
export interface TemplateInfo { id: string; name: string; kind: TemplateKind; updatedAt: string }
const KIND_LABEL: Record<TemplateKind, string> = { section: "Sections", row: "Rows", page: "Pages" };
const KIND_ICON = { section: LayoutTemplate, row: Columns3, page: FileStack } as const;
const BLUE = "#2563eb";

async function json<T>(res: Response): Promise<T & { error?: string }> {
  return (await res.json().catch(() => ({}))) as T & { error?: string };
}

/** Name a template and save it. */
export function SaveTemplateDialog({ kind, data, defaultName, onClose, onSaved }: { kind: TemplateKind; data: unknown; defaultName: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/edit/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, kind, data }) });
    const d = await json<{ template?: { name: string } }>(res);
    setBusy(false);
    if (!res.ok) return setError(d.error ?? "Couldn't save the template.");
    onSaved(`Saved “${d.template?.name ?? name}” in Templates`);
  };
  return (
    <Dialog open onClose={onClose} title={`Save ${kind === "page" ? "this page" : `this ${kind}`} as a template`} description="Saved in Templates (edit bar) to insert on any page later, as a copy you can change." size="sm">
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-3">
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">Template name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus placeholder="e.g. Pricing call-to-action" />
        </label>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-xl border border-line px-3.5 text-sm font-medium hover:bg-bg">Cancel</button>
          <button type="submit" disabled={busy || !name.trim()} className="h-9 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50" style={{ background: BLUE }}>{busy ? "Saving…" : "Save template"}</button>
        </div>
      </form>
    </Dialog>
  );
}

function useTemplates() {
  const [list, setList] = useState<TemplateInfo[] | null>(null);
  const reload = useCallback(async () => {
    const res = await fetch("/api/edit/templates", { cache: "no-store" });
    const d = await json<{ templates?: TemplateInfo[] }>(res);
    setList(res.ok ? d.templates ?? [] : []);
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { list, reload };
}

/** Edit bar › Templates. */
export function TemplatesPanel({ onClose, onInsert, onSavePage, canSavePage }: { onClose: () => void; onInsert: (t: TemplateInfo, mode?: "append" | "replace") => void; onSavePage: () => void; canSavePage: boolean }) {
  const { list, reload } = useTemplates();
  const [tab, setTab] = useState<TemplateKind>("section");
  const [q, setQ] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; what: "delete" | "replace" } | null>(null);
  const shown = (list ?? []).filter((t) => t.kind === tab && t.name.toLowerCase().includes(q.trim().toLowerCase()));
  const rename = async () => {
    if (!renaming) return;
    await fetch(`/api/edit/templates/${renaming.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: renaming.name }) });
    setRenaming(null);
    void reload();
  };
  const remove = async (id: string) => {
    await fetch(`/api/edit/templates/${id}`, { method: "DELETE" });
    setConfirm(null);
    void reload();
  };
  return (
    <aside data-cg-ui className="fixed left-[calc(var(--cg-side,0px)+1rem)] top-24 z-[62] flex max-h-[calc(100vh-12rem)] w-80 flex-col rounded-2xl border border-line bg-surface text-sm text-ink shadow-[0_18px_48px_-18px_rgb(0_0_0/0.45)]" aria-label="Templates">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="inline-flex items-center gap-1.5 font-semibold"><Bookmark className="h-4 w-4" aria-hidden /> Templates</span>
        <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-bg" aria-label="Close templates"><X className="h-4 w-4" /></button>
      </header>
      <div className="flex border-b border-line px-2" role="tablist">
        {(Object.keys(KIND_LABEL) as TemplateKind[]).map((k) => {
          const n = (list ?? []).filter((t) => t.kind === k).length;
          return (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("flex-1 border-b-2 py-2 text-xs font-semibold", tab === k ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-muted hover:text-ink")}>
              {KIND_LABEL[k]} {n > 0 && <span className="text-muted">({n})</span>}
            </button>
          );
        })}
      </div>
      <div className="border-b border-line p-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" className="h-9" aria-label="Search templates" />
      </div>
      <ul className="flex-1 overflow-y-auto p-1.5">
        {list === null && <li className="px-2 py-6 text-center text-xs text-muted">Loading…</li>}
        {list && !shown.length && (
          <li className="px-3 py-6 text-center text-xs text-muted">
            {q ? "No templates match." : tab === "section" ? "None yet. Use “Save as template” (bookmark) on a section’s tab." : tab === "row" ? "None yet. Use the bookmark in a Free layout row’s toolbar." : "None yet. Save this page below."}
          </li>
        )}
        {shown.map((t) => {
          const I = KIND_ICON[t.kind];
          return (
            <li key={t.id} className="group rounded-lg px-2 py-1.5 hover:bg-bg">
              {renaming?.id === t.id ? (
                <form onSubmit={(e) => { e.preventDefault(); void rename(); }} className="flex gap-1">
                  <Input value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} className="h-8" autoFocus aria-label="New name" />
                  <button type="submit" className="h-8 rounded-lg px-2 text-xs font-semibold text-white" style={{ background: BLUE }}>Save</button>
                </form>
              ) : confirm?.id === t.id ? (
                <div className="flex items-center gap-1 text-xs">
                  <span className="min-w-0 flex-1 truncate">{confirm.what === "delete" ? `Delete “${t.name}”?` : "Replace all sections of this page?"}</span>
                  <button type="button" onClick={() => (confirm.what === "delete" ? void remove(t.id) : (onInsert(t, "replace"), setConfirm(null)))} className="h-7 rounded-lg bg-danger px-2 font-semibold text-white">{confirm.what === "delete" ? "Delete" : "Replace"}</button>
                  <button type="button" onClick={() => setConfirm(null)} className="h-7 rounded-lg px-2 hover:bg-surface">Cancel</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <I className="h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate" title={t.name}>{t.name}</span>
                  <button type="button" onClick={() => setRenaming({ id: t.id, name: t.name })} className="hidden h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface hover:text-ink group-hover:grid" title="Rename" aria-label={`Rename ${t.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => setConfirm({ id: t.id, what: "delete" })} className="hidden h-7 w-7 place-items-center rounded-lg text-muted hover:bg-surface hover:text-danger group-hover:grid" title="Delete" aria-label={`Delete ${t.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  {t.kind === "page" && <button type="button" onClick={() => setConfirm({ id: t.id, what: "replace" })} className="h-7 rounded-lg border border-line px-2 text-xs font-medium hover:bg-surface" title="Replace this page's sections with the template's">Replace</button>}
                  <button type="button" onClick={() => onInsert(t, "append")} className="h-7 rounded-lg px-2.5 text-xs font-semibold text-white" style={{ background: BLUE }} title={t.kind === "row" ? "Into the Free layout you worked on last (or a new one)" : "At the end of this page"}>Insert</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <footer className="border-t border-line px-3 py-2.5 text-[11px] text-muted">
        {canSavePage ? (
          <button type="button" onClick={onSavePage} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-ink hover:bg-bg"><FileStack className="h-3.5 w-3.5" aria-hidden /> Save this page as a template</button>
        ) : (
          "Templates are inserted as copies: changing one later doesn't change the pages that used it."
        )}
      </footer>
    </aside>
  );
}

// ── Finder ───────────────────────────────────────────────────────────────────────────────────
interface Hit { group: string; label: string; meta: string | null; run: () => void }

const ADMIN_LINKS: { label: string; href: string; permission: string }[] = ADMIN_NAV.flatMap((g) =>
  g.items.flatMap((i) => [...(i.href && i.permission ? [{ label: i.label, href: i.href, permission: i.permission as string }] : []), ...((i.children ?? []) as AdminNavLink[]).map((c) => ({ label: `${i.label} › ${c.label}`, href: c.href, permission: c.permission as string }))]),
);

/** Ctrl+K: find a page, product, category, article, template or admin screen. */
export function Finder({ onClose, go, openAdmin, insertTemplate, canHref, extra }: { onClose: () => void; go: (href: string) => void; openAdmin: (label: string, href: string) => void; insertTemplate: (t: TemplateInfo) => void; canHref: (href: string) => boolean; extra: { label: string; run: () => void }[] }) {
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<{ group: string; label: string; meta: string | null; href: string }[]>([]);
  const [active, setActive] = useState(0);
  const { list: templates } = useTemplates();
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setRemote([]);
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/edit/find?q=${encodeURIComponent(term)}`, { signal: ctl.signal, cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { hits: [] }))
        .then((d: { hits: typeof remote }) => setRemote(d.hits))
        .catch(() => undefined);
    }, 180);
    return () => { ctl.abort(); window.clearTimeout(t); };
  }, [q]);
  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    const match = (s: string) => !term || s.toLowerCase().includes(term);
    return [
      ...extra.filter((e) => match(e.label)).map((e) => ({ group: "Edit mode", label: e.label, meta: null, run: e.run })),
      ...remote.map((h) => ({ group: h.group, label: h.label, meta: h.meta, run: () => go(h.href) })),
      ...(term ? (templates ?? []).filter((t) => match(t.name)).slice(0, 6).map((t) => ({ group: "Templates", label: t.name, meta: `Insert ${t.kind}`, run: () => insertTemplate(t) })) : []),
      ...(term ? ADMIN_LINKS.filter((l) => match(l.label) && canHref(l.href)).slice(0, 6).map((l) => ({ group: "Admin screens", label: l.label, meta: null, run: () => openAdmin(l.label, l.href) })) : []),
    ];
  }, [q, remote, templates, extra, go, insertTemplate, openAdmin, canHref]);
  useEffect(() => setActive(0), [q, remote.length]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const choose = (h: Hit | undefined) => { if (!h) return; onClose(); h.run(); };
  let lastGroup = "";
  return (
    <div data-cg-ui className="fixed inset-0 z-[72] flex items-start justify-center bg-ink/40 p-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface text-ink shadow-2xl" role="dialog" aria-label="Finder">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") { e.preventDefault(); choose(hits[active]); }
            }}
            placeholder="Find a page, product, category, article, template or admin screen…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted"
            aria-label="Find"
          />
          <kbd className="rounded border border-line px-1.5 text-[10px] text-muted">Esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
          {hits.map((h, i) => {
            const head = h.group !== lastGroup ? h.group : null;
            lastGroup = h.group;
            return (
              <li key={`${h.group}-${h.label}-${i}`}>
                {head && <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{head}</p>}
                <button type="button" data-i={i} onMouseEnter={() => setActive(i)} onClick={() => choose(h)} className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm", i === active ? "bg-[#2563eb] text-white" : "hover:bg-bg")}>
                  <span className="min-w-0 flex-1 truncate">{h.label}</span>
                  {h.meta && <span className={cn("shrink-0 truncate text-xs", i === active ? "text-white/80" : "text-muted")}>{h.meta}</span>}
                </button>
              </li>
            );
          })}
          {!hits.length && <li className="px-3 py-8 text-center text-sm text-muted">{q.trim().length < 2 ? "Type at least 2 letters." : "Nothing found."}</li>}
        </ul>
        <p className="border-t border-line px-4 py-2 text-[11px] text-muted">↑ ↓ to move · Enter to open · Ctrl+K anytime in edit mode</p>
      </div>
    </div>
  );
}
