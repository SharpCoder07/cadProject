"use client";

import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, BookmarkPlus, Boxes, ClipboardPaste, Columns3, Copy, GripVertical, Heading, Image as ImageIcon, LayoutTemplate, List, Minus, Monitor, MousePointerClick, MoveVertical, Pencil, Plus, Settings2, Shapes, Smartphone, Tablet, Trash2, Type, Video, X } from "lucide-react";
import { BlockForm, SingleColumn } from "@/components/admin/blocks/block-form";
import { cn } from "@/lib/utils";
import { ROW_PRESETS, WIDGETS, clipToContent, cloneRow, cloneWidget, newRow, newWidget, type ClipSection, type LayoutData, type LayoutRow, type Widget, type WidgetType } from "@/lib/blocks/free-layout";
import { BLOCK_FIELDS } from "@/components/admin/blocks/block-fields";
import { ToastProvider } from "@/components/ui/toast";
import type { BlockType } from "@/lib/blocks/schemas";
import { useClearClipboard, useEditClipboard, useSaveTemplate, type SectionEditor } from "@/components/site/edit-mode";
import { LayoutStyle, RowShell, WidgetBox, columnClass, rowClass, type Slots } from "./view";
import { hasStyle, type Advanced, type Device, type ResponsiveStyle, type StyleSet } from "@/lib/blocks/free-layout-style";
import { ADVANCED_FIELDS, ROW_FIELDS, STYLE_GROUPS, WIDGET_FIELDS } from "./fields";

/**
 * Free layout editor (website edit mode): rows of columns holding widgets. Drag widgets in from the
 * Widgets panel or move them by their handle; click one to change its settings (panel on the right).
 * Changes are saved as the page's draft shortly after you stop (Undo / Publish from the edit bar).
 */

const DND_NEW = "application/x-cg-widget";
const DND_MOVE = "application/x-cg-move";
const BLUE = "#2563eb";

export const WIDGET_ICONS: Record<WidgetType, React.ComponentType<{ className?: string }>> = {
  heading: Heading, text: Type, image: ImageIcon, button: MousePointerClick, list: List, iconBox: Shapes, spacer: MoveVertical, divider: Minus, video: Video, section: Boxes,
};

// ── Which free layout the Widgets panel adds to when you click (instead of dragging) ──────────
interface Handle { add: (type: WidgetType) => void; paste: (clip: ClipSection) => void }
const registry = { editors: [] as Handle[], active: null as Handle | null, listeners: new Set<() => void>() };
const notify = () => registry.listeners.forEach((l) => l());
const subscribe = (l: () => void) => { registry.listeners.add(l); return () => registry.listeners.delete(l); };
const editorCount = () => registry.editors.length;
/** Pastes into the Free layout worked on last (Templates › Insert a row). false when there's none. */
export function pasteIntoActive(clip: ClipSection): boolean {
  const h = registry.active ?? registry.editors[registry.editors.length - 1];
  if (!h) return false;
  h.paste(clip);
  return true;
}

type Sel = { kind: "widget"; id: string } | { kind: "row"; id: string } | null;

// ── Pure helpers ───────────────────────────────────────────────────────────────────────────────
const mapWidgets = (rows: LayoutRow[], fn: (w: Widget[], colId: string) => Widget[]) =>
  rows.map((r) => ({ ...r, columns: r.columns.map((c) => ({ ...c, widgets: fn(c.widgets, c.id) })) }));
function findWidget(rows: LayoutRow[], id: string) {
  for (const r of rows) for (const c of r.columns) { const i = c.widgets.findIndex((w) => w.id === id); if (i >= 0) return { row: r, col: c, index: i, widget: c.widgets[i]! }; }
  return null;
}
function insertAt(rows: LayoutRow[], colId: string, index: number, w: Widget) {
  return mapWidgets(rows, (ws, cid) => (cid === colId ? [...ws.slice(0, index), w, ...ws.slice(index)] : ws));
}
function withColumns(r: LayoutRow, widths: number[]): LayoutRow {
  // Fewer columns: widgets of the removed ones move into the last column that stays.
  const cols = widths.map((w, i) => ({ id: r.columns[i]?.id ?? `c${Math.random().toString(36).slice(2, 9)}`, width: w, widgets: r.columns[i]?.widgets ?? [] }));
  const extra = r.columns.slice(widths.length).flatMap((c) => c.widgets);
  cols[cols.length - 1]!.widgets = [...cols[cols.length - 1]!.widgets, ...extra];
  return { ...r, columns: cols };
}

/** The image picker and rich-text tools in the settings panel show messages (toasts). */
export function FreeLayoutEditor(props: { data: LayoutData; editor: SectionEditor; slots?: Slots }) {
  return (
    <ToastProvider>
      <Editor {...props} />
    </ToastProvider>
  );
}

function Editor({ data, editor, slots }: { data: LayoutData; editor: SectionEditor; slots?: Slots }) {
  const clip = useEditClipboard();
  const saveTemplate = useSaveTemplate();
  const [rows, setRows] = useState<LayoutRow[]>(data.rows);
  const [sel, setSel] = useState<Sel>(null);
  const [drop, setDrop] = useState<{ col: string; index: number } | null>(null);
  const [menu, setMenu] = useState<string | null>(null); // open "columns" / "add" menu id
  const [tab, setTab] = useState<"content" | "style" | "advanced">("content");
  const [device, setDevice] = useState<Device>("desktop");
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const pending = useRef<number | null>(null);
  const editorRef = useRef(editor);
  editorRef.current = editor;

  // After a save the page refreshes: take the saved data unless there are newer changes here.
  const incoming = JSON.stringify(data.rows);
  useEffect(() => {
    if (pending.current === null) setRows(data.rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by content
  }, [incoming]);

  const flush = useCallback(() => {
    if (pending.current === null) return;
    window.clearTimeout(pending.current);
    pending.current = null;
    void editorRef.current.save({ rows: rowsRef.current });
  }, []);
  const commit = useCallback((next: LayoutRow[]) => {
    rowsRef.current = next;
    setRows(next);
    if (pending.current !== null) window.clearTimeout(pending.current);
    pending.current = window.setTimeout(() => {
      pending.current = null;
      void editorRef.current.save({ rows: rowsRef.current });
    }, 700);
  }, []);
  useEffect(() => () => flush(), [flush]);

  // Clicking a widget in the Widgets panel adds it here (last column of the selected or last row).
  const add = useCallback((type: WidgetType) => {
    const cur = rowsRef.current;
    const found = sel?.kind === "widget" ? findWidget(cur, sel.id) : null;
    const w = newWidget(type);
    if (found) commit(insertAt(cur, found.col.id, found.index + 1, w));
    else {
      const row = (sel?.kind === "row" && cur.find((r) => r.id === sel.id)) || cur[cur.length - 1];
      if (!row) commit([{ ...newRow(), columns: [{ ...newRow().columns[0]!, widgets: [w] }] }]);
      else { const col = row.columns[row.columns.length - 1]!; commit(insertAt(cur, col.id, col.widgets.length, w)); }
    }
    setSel({ kind: "widget", id: w.id });
  }, [sel, commit]);
  // Paste a copied section into a column (at `index`), or after the selected / last widget.
  const paste = useCallback((c: ClipSection, colId?: string, index?: number) => {
    const cur = rowsRef.current;
    const content = clipToContent(c);
    let at = colId ? { col: colId, index: index ?? 0 } : null;
    if (!at) {
      const f = sel?.kind === "widget" ? findWidget(cur, sel.id) : null;
      const row = f?.row ?? cur[cur.length - 1];
      const col = f?.col ?? row?.columns[row.columns.length - 1];
      at = col ? { col: col.id, index: f ? f.index + 1 : col.widgets.length } : null;
    }
    if ("rows" in content) {
      // A copied Free layout brings its rows, placed after the row you're pasting into.
      const ri = at ? cur.findIndex((r) => r.columns.some((x) => x.id === at!.col)) : cur.length - 1;
      commit([...cur.slice(0, ri + 1), ...content.rows, ...cur.slice(ri + 1)]);
      return;
    }
    if (!at) {
      commit([...cur, { ...newRow(), columns: [{ ...newRow().columns[0]!, widgets: content.widgets }] }]);
      return;
    }
    let next = cur;
    content.widgets.forEach((w, i) => { next = insertAt(next, at!.col, at!.index + i, w); });
    commit(next);
    if (content.widgets[0]) setSel({ kind: "widget", id: content.widgets[0].id });
  }, [sel, commit]);
  const handle = useRef<Handle>({ add, paste });
  handle.current.add = add;
  handle.current.paste = paste;
  useEffect(() => {
    const h = handle.current;
    registry.editors.push(h);
    notify();
    return () => {
      registry.editors = registry.editors.filter((x) => x !== h);
      if (registry.active === h) registry.active = null;
      notify();
    };
  }, []);
  const activate = () => { registry.active = handle.current; };

  // Esc closes the settings panel; dragging ends → no drop marker.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    const end = () => setDrop(null);
    window.addEventListener("keydown", esc);
    document.addEventListener("dragend", end);
    return () => { window.removeEventListener("keydown", esc); document.removeEventListener("dragend", end); };
  }, []);

  // ── Changes ──
  const updateWidget = (id: string, props: Record<string, unknown>) => commit(mapWidgets(rowsRef.current, (ws) => ws.map((w) => (w.id === id ? { ...w, props } : w))));
  const removeWidget = (id: string) => { commit(mapWidgets(rowsRef.current, (ws) => ws.filter((w) => w.id !== id))); if (sel?.id === id) setSel(null); };
  const duplicateWidget = (id: string) => {
    const f = findWidget(rowsRef.current, id);
    if (f) commit(insertAt(rowsRef.current, f.col.id, f.index + 1, cloneWidget(f.widget)));
  };
  const updateRow = (id: string, patch: Partial<LayoutRow>) => commit(rowsRef.current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const moveRow = (i: number, d: -1 | 1) => {
    const next = [...rowsRef.current];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    commit(next);
  };

  // ── Drag and drop ──
  const accepts = (e: React.DragEvent) => e.dataTransfer.types.includes(DND_NEW) || e.dataTransfer.types.includes(DND_MOVE);
  const onDragOver = (e: React.DragEvent<HTMLDivElement>, colId: string) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes(DND_MOVE) ? "move" : "copy";
    const kids = [...e.currentTarget.querySelectorAll<HTMLElement>("[data-w]")];
    let index = kids.length;
    for (let i = 0; i < kids.length; i++) {
      const r = kids[i]!.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { index = i; break; }
    }
    if (drop?.col !== colId || drop.index !== index) setDrop({ col: colId, index });
  };
  const onDrop = (e: React.DragEvent, colId: string) => {
    if (!accepts(e)) return;
    e.preventDefault();
    e.stopPropagation();
    const index = drop?.col === colId ? drop.index : 0;
    setDrop(null);
    activate();
    const type = e.dataTransfer.getData(DND_NEW) as WidgetType;
    const moving = e.dataTransfer.getData(DND_MOVE);
    if (type && WIDGETS.some((w) => w.type === type)) {
      const w = newWidget(type);
      commit(insertAt(rowsRef.current, colId, index, w));
      setSel({ kind: "widget", id: w.id });
    } else if (moving) {
      const f = findWidget(rowsRef.current, moving);
      if (!f) return;
      const without = mapWidgets(rowsRef.current, (ws) => ws.filter((w) => w.id !== moving));
      const at = f.col.id === colId && f.index < index ? index - 1 : index;
      commit(insertAt(without, colId, at, f.widget));
    }
  };

  const selWidget = sel?.kind === "widget" ? findWidget(rows, sel.id)?.widget : undefined;
  const selRow = sel?.kind === "row" ? rows.find((r) => r.id === sel.id) : undefined;
  const selItem: { id: string; style?: ResponsiveStyle; adv?: Advanced } | undefined = selWidget ?? selRow;
  // Style / Advanced of the selected widget or row.
  const patchItem = (fn: <T extends { style?: ResponsiveStyle; adv?: Advanced }>(it: T) => T) => {
    if (!sel) return;
    if (sel.kind === "row") commit(rowsRef.current.map((r) => (r.id === sel.id ? fn(r) : r)));
    else commit(mapWidgets(rowsRef.current, (ws) => ws.map((w) => (w.id === sel.id ? fn(w) : w))));
  };
  const patchStyle = (d: Device, set: StyleSet | undefined) =>
    patchItem((it) => {
      const cur = it.style ?? { desktop: {} };
      const next = { ...cur, [d]: set } as NonNullable<ResponsiveStyle>;
      if (d === "desktop") next.desktop = set ?? {};
      return { ...it, style: next };
    });
  const iconBtn = "grid h-6 w-6 place-items-center rounded-full hover:bg-white/20";
  const marker = <div className="my-1 h-1 rounded-full" style={{ background: BLUE }} aria-hidden />;

  return (
    <section onMouseDown={activate}>
      <LayoutStyle rows={rows} editing />
      {rows.map((r, ri) => (
        <div key={r.id} className={cn("group/row relative outline-dashed outline-1 -outline-offset-1", sel?.id === r.id ? "outline-2 outline-[#2563eb]" : "outline-transparent hover:outline-[#2563eb]/50")}>
          {/* Row toolbar */}
          <div className={cn("absolute left-2 top-2 z-[22] items-center gap-0.5 rounded-full p-0.5 pl-2 text-xs text-white shadow", sel?.id === r.id || menu === `cols:${r.id}` ? "flex" : "hidden group-hover/row:flex")} style={{ background: "#0f172a" }}>
            <span className="pr-1 font-semibold">Row {ri + 1}</span>
            <div className="relative">
              <button type="button" className={iconBtn} title="Columns" aria-label="Change columns" onClick={() => setMenu(menu === `cols:${r.id}` ? null : `cols:${r.id}`)}><Columns3 className="h-3.5 w-3.5" /></button>
              {menu === `cols:${r.id}` && (
                <div className="absolute left-0 top-full z-[30] mt-1 w-44 rounded-xl border border-line bg-surface p-1 text-ink shadow-lg">
                  {ROW_PRESETS.map((p) => (
                    <button key={p.label} type="button" onClick={() => { updateRow(r.id, withColumns(r, p.widths)); setMenu(null); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-bg", r.columns.map((c) => c.width).join() === p.widths.join() && "font-bold text-primary")}>
                      <span className="flex h-3 w-14 gap-0.5">{p.widths.map((w, i) => <span key={i} className="rounded-sm bg-[#2563eb]/70" style={{ flex: w }} />)}</span>
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className={iconBtn} title="Row settings" aria-label="Row settings" onClick={() => setSel({ kind: "row", id: r.id })}><Settings2 className="h-3.5 w-3.5" /></button>
            <button type="button" className={cn(iconBtn, "disabled:opacity-30")} title="Move row up" aria-label="Move row up" disabled={ri === 0} onClick={() => moveRow(ri, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" className={cn(iconBtn, "disabled:opacity-30")} title="Move row down" aria-label="Move row down" disabled={ri === rows.length - 1} onClick={() => moveRow(ri, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" className={iconBtn} title="Save row as template" aria-label="Save row as template" onClick={() => saveTemplate("row", { rows: [r] }, `Row with ${r.columns.length} column${r.columns.length === 1 ? "" : "s"}`)}><BookmarkPlus className="h-3.5 w-3.5" /></button>
            <button type="button" className={iconBtn} title="Duplicate row" aria-label="Duplicate row" onClick={() => commit([...rows.slice(0, ri + 1), cloneRow(r), ...rows.slice(ri + 1)])}><Copy className="h-3.5 w-3.5" /></button>
            <button type="button" className={cn(iconBtn, "hover:bg-danger")} title="Delete row" aria-label="Delete row" onClick={() => { commit(rows.filter((x) => x.id !== r.id)); if (sel?.id === r.id) setSel(null); }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          <RowShell r={r}>
            <div className={rowClass(r)}>
              {r.columns.map((c) => (
                <div
                  key={c.id}
                  onDragOver={(e) => onDragOver(e, c.id)}
                  onDrop={(e) => onDrop(e, c.id)}
                  className={cn(columnClass(c), "min-h-[72px] rounded-md p-1.5 outline-dashed outline-1", drop?.col === c.id ? "bg-[#2563eb]/5 outline-[#2563eb]" : "outline-line")}
                >
                  {c.widgets.map((w, wi) => (
                    <Fragment key={w.id}>
                      {drop?.col === c.id && drop.index === wi && marker}
                      <div
                        data-w=""
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); activate(); setSel({ kind: "widget", id: w.id }); }}
                        className={cn("group/w relative cursor-pointer rounded-md outline-offset-4", sel?.id === w.id ? "outline outline-2 outline-[#2563eb]" : "hover:outline hover:outline-1 hover:outline-[#2563eb]/60")}
                      >
                        <div className={cn("absolute -top-3 right-1 z-[23] items-center gap-0.5 rounded-full p-0.5 text-white shadow", sel?.id === w.id ? "flex" : "hidden group-hover/w:flex")} style={{ background: BLUE }} onClick={(e) => e.stopPropagation()}>
                          <span
                            draggable
                            onDragStart={(e) => { e.dataTransfer.setData(DND_MOVE, w.id); e.dataTransfer.effectAllowed = "move"; }}
                            className={cn(iconBtn, "cursor-grab active:cursor-grabbing")}
                            title="Drag to move"
                            aria-label="Drag to move"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>
                          <button type="button" className={iconBtn} title="Edit" aria-label="Edit widget" onClick={() => setSel({ kind: "widget", id: w.id })}><Pencil className="h-3.5 w-3.5" /></button>
                          <button type="button" className={iconBtn} title="Duplicate" aria-label="Duplicate widget" onClick={() => duplicateWidget(w.id)}><Copy className="h-3.5 w-3.5" /></button>
                          <button type="button" className={cn(iconBtn, "hover:bg-danger")} title="Delete" aria-label="Delete widget" onClick={() => removeWidget(w.id)}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        {/* Links and buttons don't act while editing. */}
                        <div className="[&_*]:pointer-events-none"><WidgetBox w={w} slots={slots} /></div>
                      </div>
                    </Fragment>
                  ))}
                  {drop?.col === c.id && drop.index === c.widgets.length && marker}
                  <AddWidget clip={clip} onPaste={() => { if (clip) paste(clip, c.id, c.widgets.length); setMenu(null); }} open={menu === `add:${c.id}`} onToggle={() => setMenu(menu === `add:${c.id}` ? null : `add:${c.id}`)} empty={!c.widgets.length} onPick={(type) => { const w = newWidget(type); commit(insertAt(rows, c.id, c.widgets.length, w)); setSel({ kind: "widget", id: w.id }); setMenu(null); }} />
                </div>
              ))}
            </div>
          </RowShell>
        </div>
      ))}
      {/* Add a row */}
      <div className="container relative flex justify-center py-3">
        <button type="button" onClick={() => setMenu(menu === "addrow" ? null : "addrow")} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-[#2563eb] px-4 text-sm font-semibold text-[#2563eb] hover:bg-[#2563eb]/5">
          <Plus className="h-4 w-4" aria-hidden /> Add row
        </button>
        {menu === "addrow" && (
          <div className="absolute top-full z-[30] grid w-80 grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-2 shadow-lg">
            {ROW_PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => { commit([...rows, newRow(p.widths)]); setMenu(null); }} className="flex flex-col gap-1.5 rounded-lg p-2 text-left text-xs text-ink hover:bg-bg">
                <span className="flex h-6 gap-1">{p.widths.map((w, i) => <span key={i} className="rounded bg-[#2563eb]/25" style={{ flex: w }} />)}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Settings of the selected widget or row */}
      {(selWidget || selRow) && (
        <aside data-cg-ui className="fixed right-4 top-24 z-[66] flex max-h-[calc(100vh-8rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-line bg-surface text-ink shadow-[0_18px_48px_-18px_rgb(0_0_0/0.45)]" aria-label="Settings">
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: BLUE }}>{selRow ? "Row" : "Widget"}</p>
              <p className="truncate font-semibold">{selRow ? `${selRow.columns.length} column${selRow.columns.length === 1 ? "" : "s"}` : selWidget!.type === "section" ? String(selWidget!.props.label || "Section") : WIDGETS.find((w) => w.type === selWidget!.type)?.label}</p>
            </div>
            <button type="button" onClick={() => setSel(null)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" aria-label="Close settings"><X className="h-5 w-5" /></button>
          </header>
          <div className="flex border-b border-line px-2" role="tablist">
            {(["content", "style", "advanced"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("flex-1 border-b-2 py-2 text-xs font-semibold capitalize", tab === t ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-muted hover:text-ink")}>{t}</button>
            ))}
          </div>
          {tab === "style" && (
            <div className="flex items-center gap-2 border-b border-line bg-bg/60 px-4 py-2">
              <span className="text-xs text-muted">Editing for</span>
              <span className="flex rounded-lg border border-line bg-surface" role="group" aria-label="Device">
                {([["desktop", Monitor, "Desktop"], ["tablet", Tablet, "Tablet"], ["mobile", Smartphone, "Mobile"]] as const).map(([d, I, label]) => (
                  <button key={d} type="button" title={label} aria-label={label} aria-pressed={device === d} onClick={() => setDevice(d)} className={cn("relative grid h-7 w-8 place-items-center first:rounded-l-lg last:rounded-r-lg", device === d ? "bg-[#2563eb] text-white" : "text-muted hover:text-ink")}>
                    <I className="h-3.5 w-3.5" />
                    {d !== "desktop" && hasStyle(selItem?.style?.[d]) && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[#f59e0b]" aria-label="has its own settings" />}
                  </button>
                ))}
              </span>
              {device !== "desktop" && hasStyle(selItem?.style?.[device]) && (
                <button type="button" onClick={() => patchStyle(device, undefined)} className="ml-auto text-xs font-medium text-muted underline hover:text-ink">Reset {device}</button>
              )}
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <SingleColumn.Provider value>
              {tab === "style" ? (
                <>
                  {device !== "desktop" && <p className="mb-3 rounded-lg bg-[#2563eb]/5 px-3 py-2 text-xs text-ink">Only what you set here changes on {device === "tablet" ? "tablets (and phones)" : "phones"}; empty fields keep the {device === "tablet" ? "desktop" : "tablet / desktop"} look. Check it with the {device} preview in the edit bar.</p>}
                  {STYLE_GROUPS.map((g, gi) => (
                    <details key={g.title} open={gi < 2} className="mb-2 rounded-xl border border-line">
                      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold">{g.title}</summary>
                      <div className="border-t border-line px-3 py-3">
                        <BlockForm key={`${selItem!.id}-${device}-${g.title}`} fields={g.fields} value={(selItem!.style?.[device] ?? {}) as Record<string, unknown>} idPrefix={`fls-${selItem!.id}-${device}-${gi}`} onChange={(v) => patchStyle(device, v as StyleSet)} />
                      </div>
                    </details>
                  ))}
                </>
              ) : tab === "advanced" ? (
                <BlockForm key={`${selItem!.id}-adv`} fields={ADVANCED_FIELDS} value={(selItem!.adv ?? {}) as Record<string, unknown>} idPrefix={`fla-${selItem!.id}`} onChange={(v) => patchItem((it) => ({ ...it, adv: v as Advanced }))} />
              ) : selWidget?.type === "section" ? (
                <>
                  <p className="mb-3 text-xs text-muted">A copied section. Its settings below; after a change it reloads here in a moment (it shows live data).</p>
                  <BlockForm key={selWidget.id} fields={BLOCK_FIELDS[String(selWidget.props.blockType) as BlockType] ?? []} value={(selWidget.props.data as Record<string, unknown>) ?? {}} idPrefix={`fl-${selWidget.id}`} onChange={(v) => updateWidget(selWidget.id, { ...selWidget.props, data: v })} />
                </>
              ) : selWidget ? (
                <BlockForm key={selWidget.id} fields={WIDGET_FIELDS[selWidget.type]} value={selWidget.props} idPrefix={`fl-${selWidget.id}`} onChange={(v) => updateWidget(selWidget.id, v)} />
              ) : (
                <BlockForm key={selRow!.id} fields={ROW_FIELDS} value={selRow as unknown as Record<string, unknown>} idPrefix={`fl-${selRow!.id}`} onChange={(v) => updateRow(selRow!.id, v as Partial<LayoutRow>)} />
              )}
            </SingleColumn.Provider>
          </div>
          <footer className="flex items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span>Changes save as a draft automatically.</span>
            <button type="button" onClick={() => setSel(null)} className="h-8 rounded-lg px-3 text-sm font-semibold text-white" style={{ background: BLUE }}>Done</button>
          </footer>
        </aside>
      )}
    </section>
  );
}

/** "+" in a column: add a widget without dragging. */
function AddWidget({ open, empty, onToggle, onPick, clip, onPaste }: { open: boolean; empty: boolean; onToggle: () => void; onPick: (t: WidgetType) => void; clip: ClipSection | null; onPaste: () => void }) {
  return (
    <div className="relative">
      <button type="button" onClick={onToggle} className={cn("flex w-full items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted hover:text-[#2563eb]", empty ? "h-16 border border-dashed border-line" : "h-7 opacity-0 hover:opacity-100 focus:opacity-100")}>
        <Plus className="h-3.5 w-3.5" aria-hidden /> {empty ? "Drop a widget here, or click to add" : "Add widget"}
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-[30] mt-1 grid w-64 -translate-x-1/2 grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          {clip && (
            <button type="button" onClick={onPaste} className="col-span-3 mb-1 flex items-center gap-2 rounded-lg border border-dashed border-[#2563eb] px-2 py-2 text-left text-xs font-semibold text-[#2563eb] hover:bg-[#2563eb]/5">
              <ClipboardPaste className="h-4 w-4 shrink-0" aria-hidden /> <span className="truncate">Paste “{clip.label}”</span>
            </button>
          )}
          {WIDGETS.map((w) => { const I = WIDGET_ICONS[w.type]; return (
            <button key={w.type} type="button" onClick={() => onPick(w.type)} className="flex flex-col items-center gap-1 rounded-lg p-2 text-[11px] text-ink hover:bg-bg"><I className="h-4 w-4 text-[#2563eb]" />{w.label}</button>
          ); })}
        </div>
      )}
    </div>
  );
}

/**
 * Widgets panel (edit bar › Widgets): drag a widget into a Free layout section, or click it to add
 * it to the one you worked on last.
 */
export function WidgetsPanel({ onClose, onAddLayout }: { onClose: () => void; onAddLayout: () => void }) {
  const count = useSyncExternalStore(subscribe, editorCount, () => 0);
  const clip = useEditClipboard();
  const clearClip = useClearClipboard();
  return (
    <aside data-cg-ui className="fixed left-[calc(var(--cg-side,0px)+1rem)] top-24 z-[62] flex max-h-[calc(100vh-12rem)] w-72 flex-col rounded-2xl border border-line bg-surface text-sm text-ink shadow-[0_18px_48px_-18px_rgb(0_0_0/0.45)]" aria-label="Widgets">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="inline-flex items-center gap-1.5 font-semibold"><LayoutTemplate className="h-4 w-4" aria-hidden /> Widgets</span>
        <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-bg" aria-label="Close widgets"><X className="h-4 w-4" /></button>
      </header>
      {clip && count > 0 && (
        <div className="border-b border-line p-3">
          <div className="relative">
            <button type="button" onClick={() => (registry.active ?? registry.editors[registry.editors.length - 1])?.paste(clip)} className="flex w-full items-center gap-2 rounded-xl border border-dashed px-3 py-2.5 pr-9 text-left text-xs font-semibold hover:bg-[#2563eb]/5" style={{ borderColor: BLUE, color: BLUE }}>
              <ClipboardPaste className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0"><span className="block truncate">Paste “{clip.label}”</span><span className="block font-normal text-muted">Copied earlier · into the Free layout you worked on last</span></span>
            </button>
            <button type="button" onClick={clearClip} title="Clear the copied section" aria-label="Clear the copied section" className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 overflow-y-auto p-3">
        {WIDGETS.map((w) => {
          const I = WIDGET_ICONS[w.type];
          return (
            <button
              key={w.type}
              type="button"
              draggable
              onDragStart={(e) => { e.dataTransfer.setData(DND_NEW, w.type); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => (registry.active ?? registry.editors[registry.editors.length - 1])?.add(w.type)}
              disabled={!count}
              title={w.hint}
              className="flex cursor-grab flex-col items-center gap-1.5 rounded-xl border border-line bg-bg/50 px-2 py-3 text-xs font-medium hover:border-[#2563eb] hover:text-[#2563eb] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
            >
              <I className="h-5 w-5" />
              {w.label}
            </button>
          );
        })}
      </div>
      <div className="border-t border-line px-3 py-2.5 text-[11px] text-muted">
        {count ? (
          "Drag a widget into a column of a Free layout section, or click it to add it to the one you worked on last."
        ) : (
          <>
            <p className="mb-2">Widgets go into a <b>Free layout</b> section. This page doesn&apos;t have one yet.</p>
            <button type="button" onClick={onAddLayout} className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white" style={{ background: BLUE }}><Plus className="h-3.5 w-3.5" aria-hidden /> Add a Free layout section</button>
          </>
        )}
      </div>
    </aside>
  );
}
