"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, SlidersHorizontal, X } from "lucide-react";
import { liveSection, type LiveTarget } from "@/lib/live-edit";
import type { UndoEntry } from "@/lib/live-edit-target";

/**
 * Website edit mode, "click text to type": in an outlined part of the page, a heading, line or
 * button text that comes from one plain-text field (website wording, a section's heading, a site
 * setting…) can be clicked and typed over right there. Enter saves, Esc cancels. Anything else
 * (images, lists, formatted text, links) opens in the docked panel ("All options").
 *
 * How a piece of text is found: each outlined part lists what it's edited from (data-cg-targets);
 * their current values are loaded when you hover the part, and a text is typable when exactly one
 * plain-text field holds exactly what the page shows.
 */
interface Candidate { target: LiveTarget; field: string; label: string; value: string; multiline: boolean }
interface Editing { el: HTMLElement; region: HTMLElement; c: Candidate; value: string; box: { top: number; left: number; width: number; height: number }; style: React.CSSProperties; /** Text in the sticky header is edited above it; elsewhere under it, so scrolling doesn't put the editor over the header. */ z: number }

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const keyOf = (t: LiveTarget) => `${t.kind}|${t.id}`;
const values = new Map<string, Record<string, unknown> | null>();
const loading = new Set<string>();

function targetsOf(region: Element): LiveTarget[] {
  try {
    return JSON.parse(region.getAttribute("data-cg-targets") || "[]") as LiveTarget[];
  } catch {
    return [];
  }
}

function prefetch(region: Element) {
  for (const t of targetsOf(region)) {
    const k = keyOf(t);
    if (values.has(k) || loading.has(k)) continue;
    loading.add(k);
    fetch(`/api/edit/live?kind=${t.kind}&id=${encodeURIComponent(t.id)}`, { cache: "no-store" })
      .then(async (r) => values.set(k, r.ok ? (((await r.json()) as { values?: Record<string, unknown> }).values ?? null) : null))
      .catch(() => values.set(k, null))
      .finally(() => loading.delete(k));
  }
}

function candidates(region: Element): Candidate[] {
  const out: Candidate[] = [];
  for (const t of targetsOf(region)) {
    const vals = values.get(keyOf(t));
    const def = vals ? liveSection(t) : null;
    if (!vals || !def) continue;
    for (const f of def.fields) {
      if (f.type !== "text" && f.type !== "textarea") continue;
      const v = vals[f.name];
      if (typeof v === "string" && norm(v)) out.push({ target: t, field: f.name, label: f.label, value: v, multiline: f.type === "textarea" });
    }
  }
  return out;
}

/** The element under the pointer (or a close parent) whose text is exactly one field's value. */
function findTypable(start: Element | null): { el: HTMLElement; region: HTMLElement; c: Candidate } | null {
  if (!start || start.closest("[data-cg-tab],[data-cg-ui],[data-cg-inline],[data-cg-open]:not([data-cg-edit])")) return null;
  const region = start.closest<HTMLElement>("[data-cg-edit]");
  if (!region) return null;
  const list = candidates(region);
  if (!list.length) return null;
  let el: Element | null = start;
  for (let depth = 0; el && el !== region && depth < 4; depth++, el = el.parentElement) {
    if (el.closest("[data-cg-edit]") !== region) break;
    const text = norm(el.textContent ?? "");
    if (!text || text.length > 600) continue;
    const hits = list.filter((c) => norm(c.value) === text);
    const distinct = new Set(hits.map((h) => `${keyOf(h.target)}|${h.field}`));
    if (distinct.size === 1) return { el: el as HTMLElement, region, c: hits[0]! };
    if (distinct.size > 1) return null; // the same text in two fields: open the panel instead
  }
  return null;
}

export function InlineText({ onMore, onSaved }: { onMore: (region: HTMLElement) => void; onSaved: (undo: UndoEntry[]) => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startRefresh] = useTransition();
  const hidden = useRef<HTMLElement | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const editingRef = useRef<Editing | null>(null);
  editingRef.current = editing;

  const unhide = () => {
    if (hidden.current) hidden.current.style.visibility = "";
    hidden.current = null;
  };
  // After a save, the page's own text is shown again once it has refreshed.
  useEffect(() => {
    if (!refreshing && !editing) unhide();
  }, [refreshing, editing]);

  const finish = useCallback(() => {
    setEditing(null);
    setError(null);
  }, []);
  const cancel = useCallback(() => {
    unhide();
    finish();
  }, [finish]);

  const save = useCallback(async () => {
    const e = editingRef.current;
    if (!e) return;
    if (e.value === e.c.value) return cancel();
    if (!norm(e.value)) return setError("Type some text, or use All options to clear it");
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/edit/live", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: e.c.target.kind, id: e.c.target.id, values: { [e.c.field]: e.value } }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; undo?: UndoEntry[] };
      if (!res.ok) return setError(data.error ?? "Couldn't save.");
      values.delete(keyOf(e.c.target));
      finish();
      startRefresh(() => router.refresh());
      onSaved(data.undo ?? []);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, [cancel, finish, onSaved, router]);

  useEffect(() => {
    let marked: Element | null = null;
    const mark = (el: Element | null) => {
      if (el === marked) return;
      marked?.removeAttribute("data-cg-typable");
      marked = el;
      el?.setAttribute("data-cg-typable", "");
    };
    const over = (e: MouseEvent) => {
      const t = e.target as Element;
      const region = t.closest?.("[data-cg-edit]");
      if (region) prefetch(region);
      mark(editingRef.current ? null : findTypable(t)?.el ?? null);
    };
    const click = (e: MouseEvent) => {
      const t = e.target as Element;
      if (editingRef.current) {
        if (t.closest("[data-cg-inline]")) return;
        e.preventDefault();
        e.stopPropagation();
        void save(); // clicking elsewhere keeps what you typed
        return;
      }
      const hit = findTypable(t);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      mark(null);
      const r = hit.el.getBoundingClientRect();
      const cs = getComputedStyle(hit.el);
      unhide();
      hit.el.style.visibility = "hidden";
      hidden.current = hit.el;
      setError(null);
      setEditing({
        ...hit,
        value: hit.c.value,
        z: hit.el.closest("header") ? 35 : 25,
        box: { top: r.top + window.scrollY, left: r.left + window.scrollX, width: Math.max(r.width, 160), height: r.height },
        style: { fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing, color: cs.color, textAlign: cs.textAlign as React.CSSProperties["textAlign"], textTransform: cs.textTransform as React.CSSProperties["textTransform"], padding: cs.padding, backgroundColor: cs.backgroundColor },
      });
    };
    document.addEventListener("mouseover", over);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("mouseover", over);
      document.removeEventListener("click", click, true);
      mark(null);
    };
  }, [save]);

  // Focus with the text selected, and grow with the text.
  useEffect(() => {
    const f = field.current;
    if (!f || !editing) return;
    f.style.height = "auto";
    f.style.height = `${Math.max(f.scrollHeight, editing.box.height)}px`;
  }, [editing]);
  const startedFor = editing?.el;
  useEffect(() => {
    if (!startedFor) return;
    field.current?.focus();
    field.current?.select();
  }, [startedFor]);
  useEffect(() => () => unhide(), []);

  if (!editing) return null;
  const { box } = editing;
  return createPortal(
    <div data-cg-inline>
      <div className="absolute flex items-center gap-1 rounded-full bg-ink p-1 text-xs text-white shadow-lg" style={{ top: Math.max(box.top - 42, 4), left: box.left, zIndex: editing.z + 1 }}>
        <span className="max-w-[12rem] truncate px-2 font-semibold text-white/80">{editing.c.label}</span>
        <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-7 items-center gap-1 rounded-full bg-[#2563eb] px-2.5 font-semibold hover:bg-[#1d4ed8] disabled:opacity-60">
          <Check className="h-3.5 w-3.5" aria-hidden /> {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={cancel} title="Cancel (Esc)" aria-label="Cancel" className="grid h-7 w-7 place-items-center rounded-full hover:bg-white/15"><X className="h-4 w-4" /></button>
        <button type="button" onClick={() => { const r = editing.region; cancel(); onMore(r); }} className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 hover:bg-white/15">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> All options
        </button>
        {error && <span className="max-w-[16rem] truncate px-2 font-medium text-[#fca5a5]" role="alert" title={error}>{error}</span>}
      </div>
      <textarea
        ref={field}
        value={editing.value}
        aria-label={editing.c.label}
        rows={1}
        spellCheck
        onChange={(e) => setEditing({ ...editing, value: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); cancel(); }
          else if (e.key === "Enter" && (!editing.c.multiline || e.metaKey || e.ctrlKey)) { e.preventDefault(); void save(); }
        }}
        className="absolute m-0 resize-none overflow-hidden border-0 bg-transparent outline-2 outline-offset-2 outline-[#2563eb] [outline-style:solid]"
        style={{ ...editing.style, top: box.top, left: box.left, width: box.width, minHeight: box.height, borderRadius: 4, zIndex: editing.z }}
      />
    </div>,
    document.body,
  );
}
