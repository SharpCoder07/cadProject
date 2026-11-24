"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Row selection shared between header checkbox, row checkboxes and the bulk action bar. */
const SelectionContext = createContext<{ selected: Set<string>; toggle: (id: string) => void; setAll: (ids: string[], on: boolean) => void; clear: () => void } | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const setAll = (ids: string[], on: boolean) => setSelected(on ? new Set(ids) : new Set());
  return <SelectionContext.Provider value={{ selected, toggle, setAll, clear: () => setSelected(new Set()) }}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside SelectionProvider");
  return ctx;
}

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} aria-label={`Select ${label}`} className="h-4 w-4 rounded border-line text-primary" />;
}

export function AllCheckbox({ ids }: { ids: string[] }) {
  const { selected, setAll } = useSelection();
  const all = ids.length > 0 && ids.every((id) => selected.has(id));
  return <input type="checkbox" checked={all} onChange={(e) => setAll(ids, e.target.checked)} aria-label="Select all on this page" className="h-4 w-4 rounded border-line text-primary" />;
}

export function BulkBar({ children }: { children: (ids: string[], clear: () => void) => ReactNode }) {
  const { selected, clear } = useSelection();
  if (!selected.size) return null;
  return <SelectionBar count={selected.size} onClear={clear}>{children([...selected], clear)}</SelectionBar>;
}

/**
 * The one bulk-select bar used across the admin: a mint box above the list that stays at the top while
 * scrolling, “N selected”, the actions (use size="sm" buttons) and “Clear selection”.
 */
export function SelectionBar({ count, onClear, children, slot }: { count: number; onClear: () => void; children: ReactNode; /** id of an empty element above the list to show the bar in (when the list itself sits inside a card). */ slot?: string }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => setTarget(slot ? document.getElementById(slot) : null), [slot]);
  if (!count) return null;
  const bar = (
    <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-panel border border-mint bg-mint-soft px-4 py-2.5 text-sm" role="region" aria-label="Bulk actions">
      <span className="font-medium">{count} selected</span>
      <span className="mx-1 h-4 w-px bg-mint" aria-hidden />
      {children}
      <button type="button" onClick={onClear} className="ml-auto text-muted hover:text-ink">Clear selection</button>
    </div>
  );
  return slot && target ? createPortal(bar, target) : bar;
}
