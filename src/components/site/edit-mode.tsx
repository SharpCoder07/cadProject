"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Bookmark, BookmarkPlus, ClipboardCopy, Copy, Eye, EyeOff, Globe, LayoutList, ListTree, LogOut, Monitor, MoreHorizontal, Palette, Pencil, Plus, Redo2, Search, Smartphone, Tablet, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { LIVE_KIND_PERMISSION, liveFromHref, type LiveTarget, type UndoEntry } from "@/lib/live-edit-target";
import { adminHrefPermission } from "@/lib/admin-href-permission";
import type { EditLayout, EditLayoutItem } from "@/lib/layouts";
import { regionStyleCss, styleKey, type RegionStyle } from "@/lib/region-style";
import type { ClipSection } from "@/lib/blocks/free-layout";

/**
 * Website edit mode (homepage and CMS pages): staff who can edit pages switch it on from the
 * "Edit this page" button. Each section gets an outline and a toolbar: edit (side panel), move,
 * duplicate, hide, delete, add. Every change is saved straight away (live), with a page version
 * kept for undo in Admin › Pages.
 */
export interface EditSection {
  key: string;
  id?: string;
  type: string;
  label: string | null;
  isEnabled: boolean;
  data: Record<string, unknown>;
  reusableBlockId: string | null;
  reusableName?: string;
  /** The block type's name (e.g. "Top banner with search"), from the server. */
  typeName?: string;
}
interface EditInfo {
  /** The CMS page behind this address (homepage, /about…), when there is one and you can edit pages. */
  page: { id: string; slug: string; title: string } | null;
  sections: EditSection[];
  reusable: { id: string; name: string; type: string }[];
  /** This person's permissions: edit mode only shows what their role can change (the server checks too). */
  perms: string[];
  /** May delete page sections (else only hide them). */
  canDeleteSections?: boolean;
  /** For the admin bar. */
  me?: { name: string; siteName: string; /** Website sidebar editor switched on (Settings › Edit Mode). */ sidebar?: boolean; /** UI Editor switched on; false = only the admin bar and sidebar. */ ui?: boolean };
}
/** A button in the edit bar that opens an admin screen in the side panel. */
export interface EditAction { label: string; href: string; primary?: boolean }
interface Ctx {
  on: boolean;
  info: EditInfo | null;
  busy: boolean;
  edit: (key: string) => void;
  /** openAfter: open that section's form; reveal: scroll to that section once it's on the page. */
  apply: (next: EditSection[], message: string, openAfter?: number, reveal?: number) => Promise<boolean>;
  addAt: (index: number) => void;
  setPageActions: (a: EditAction[] | null) => void;
  /** Opens an admin screen, or the in-place editor when that part supports it, inside the part of the page `at` (or over the page). */
  open: (a: EditAction, at?: string | null) => void;
  openLive: (t: LiveTarget[], at?: string | null) => void;
  /** What's open, and where: each part of the page shows its own editor in place of itself. */
  editing: string | null;
  live: Opened<LiveTarget[]> | null;
  panel: Opened<EditAction> | null;
  closePanels: () => void;
  onDirty: (dirty: boolean) => void;
  onLiveSaved: (undo?: UndoEntry[]) => void;
  /** Editors open in the page (in place of the section) or in a panel docked on the left. */
  docked: boolean;
  toggleDock: () => void;
  /** Can this person change this part / open this admin screen? (Only what their role allows is shown.) */
  /** A section copied with "Copy" on its tab, to paste into a Free layout (kept while you browse). */
  clip: ClipSection | null;
  /** Opens "Save as template" for a section, a Free layout row or the page. */
  saveTemplate: (kind: "section" | "row" | "page", data: unknown, name: string) => void;
  copySection: (c: ClipSection | null) => void;
  /** A section being added (placeholder shown at that position). */
  pendingInsert: { at: number; label: string } | null;
  canTarget: (t: LiveTarget) => boolean;
  canHref: (href: string) => boolean;
  /** Product, category, blog, brand and vendor pages: their shared layout (Page layouts), when you can change it. */
  layout: EditLayout | null;
  setLayout: (l: EditLayout | null) => void;
  /** Saves a changed layout (order / visibility); it applies to every page of that type. */
  saveLayout: (items: EditLayoutItem[], message: string) => void;
}
interface Opened<T> { what: T; at: string | null }

/** Website-wide parts, in the edit bar's "Whole website" menu. */
const SITE_ACTIONS: EditAction[] = [
  { label: "Header & footer menus", href: "/admin/cms/menus" },
  { label: "Logo, phone & contact details", href: "/admin/settings?tab=site" },
  { label: "Colours, fonts & footer note", href: "/admin/settings?tab=theme" },
  { label: "Buttons, labels & messages", href: "/admin/settings?tab=labels" },
  { label: "Website texts (all wording)", href: "/admin/cms/texts" },
  { label: "Announcement bar", href: "/admin/cms/announcements" },
  { label: "Enquiry & partner forms", href: "/admin/cms/forms" },
  { label: "Page layouts (sections on product, category… pages)", href: "/admin/cms/layouts" },
];

const EditCtx = createContext<Ctx | null>(null);
/** Design of single boxes / sections (Design tab), for every visitor: style key → colours and fonts. */
const StylesCtx = createContext<Record<string, RegionStyle>>({});

/** Wraps a styled part (no box unless it has its own background, so layouts aren't affected). */
function Styled({ css, children }: { css: React.CSSProperties | null; children: ReactNode }) {
  if (!css) return <>{children}</>;
  return <div data-cg-style="" style={{ ...css, ...(css.backgroundColor ? {} : { display: "contents" }) }}>{children}</div>;
}

/**
 * What a part of the page shows (texts, button labels, placeholders, links), read when its editor
 * opens: every field whose value is one of these is added to the panel, so nothing is missed.
 */
function snapshot(el: Element | null): string[] {
  if (!el) return [];
  const out = new Set<string>();
  const add = (v: string | null | undefined) => {
    const t = (v ?? "").replace(/\s+/g, " ").trim();
    if (t && t.length <= 400) out.add(t);
  };
  const skip = (n: Node) => (n instanceof Element ? n : n.parentElement)?.closest("[data-cg-tab],[data-cg-ui],script,style,svg");
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n && out.size < 3000; n = walker.nextNode()) if (!skip(n)) add(n.nodeValue);
  el.querySelectorAll("*").forEach((e) => {
    if (out.size >= 3000 || skip(e)) return;
    if ((e.textContent ?? "").length <= 400) add(e.textContent);
    for (const a of ["placeholder", "aria-label", "title", "alt"]) add(e.getAttribute(a));
    const href = e.getAttribute("href");
    if (href) {
      add(href);
      try { const u = new URL(href, location.href); if (u.origin === location.origin) add(u.pathname + u.search); } catch { /* not a link */ }
    }
  });
  return [...out];
}

/**
 * The full editor for a part of the page: its own targets, plus every website text, button label
 * and site detail shown in it (one "Wording" tab instead of hand-picked lists), plus its Design.
 */
function withDiscovery(targets: LiveTarget[], el: Element | null, design: string | null, can: (t: LiveTarget) => boolean): LiveTarget[] {
  const seen = snapshot(el);
  const patterns = targets.filter((t) => t.kind === "texts").flatMap((t) => t.only ?? [`${t.id}.*`]);
  const out: LiveTarget[] = targets.filter((t) => t.kind !== "texts").map((t) => (t.kind === "labels" || t.kind === "site" ? { ...t, discover: seen } : t));
  const extra: LiveTarget[] = [
    { kind: "texts", id: "*", section: "texts", title: "Wording", only: patterns, discover: seen },
    ...(out.some((t) => t.kind === "labels") ? [] : [{ kind: "labels" as const, id: "labels", section: "all", title: "Buttons & labels", only: [], discover: seen }]),
    ...(out.some((t) => t.kind === "site") ? [] : [{ kind: "site" as const, id: "site", section: "all", title: "Company & contact", only: [], discover: seen }]),
    ...(design ? [{ kind: "style" as const, id: design, section: "all", title: "Design" }] : []),
  ];
  return [...out, ...extra.filter(can)];
}

/** Room for the website admin bar (shown to signed-in staff, edit mode on or off). */
const BAR_CSS = `html[data-cg-adminbar] body{padding-top:32px}html[data-cg-adminbar] header.sticky{top:32px}
${"/* The admin-menu sidebar and the docked panel push the page aside (also with the UI Editor off). */"}
@media (min-width:768px){html[data-cg-side] body,html[data-cg-dock] body{padding-left:calc(var(--cg-side,0px) + var(--cg-dock-w,0px));transition:padding-left .2s ease}html[data-cg-side] [data-cg-ui].bottom-4,html[data-cg-dock] [data-cg-ui].bottom-4{left:calc(var(--cg-side,0px) + var(--cg-dock-w,0px) + 1rem)}}`;

/** Outline + top-edge tab in a fixed editor blue. The hovered part sits above its neighbours (z 20) but under the sticky header (z 30), so it never slides over the header while scrolling. (stands out from any brand colour), shown only on the part under the pointer (see the hover tracker). */
const EDIT_CSS = `
[data-cg-edit]{position:relative}
[data-cg-edit][data-cg-hot]{z-index:20;outline:2px solid #2563eb;outline-offset:-2px;box-shadow:inset 0 0 0 9999px rgb(37 99 235/.05)}
[data-cg-edit]>[data-cg-tab]{display:none}
[data-cg-edit][data-cg-hot]>[data-cg-tab]{display:flex}
[data-cg-edit][data-cg-top]>[data-cg-tab]{top:var(--cg-tab-top,6px);transform:translateX(-50%)}
[data-cg-edit][data-cg-hot][data-cg-above]{z-index:40}
[data-cg-open]{outline:2px solid #2563eb!important;outline-offset:-2px;scroll-margin-top:7rem}
[data-cg-open]>[data-cg-tab]{display:none!important}
header:has([data-cg-open]){position:relative!important}
[data-cg-flash]{outline:3px solid #f59e0b!important;outline-offset:-3px}
[data-cg-section]{scroll-margin-top:8rem}
[data-cg-typable]{cursor:text;outline:1.5px dashed #2563eb!important;outline-offset:3px;border-radius:2px}
`;
const TAB = "absolute left-1/2 top-0 z-[21] -translate-x-1/2 -translate-y-1/2 items-center gap-0.5 whitespace-nowrap rounded-full bg-[#2563eb] p-1 text-white ring-2 ring-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.45)]";
const TAB_BTN = "grid h-7 w-7 place-items-center rounded-full text-white/90 hover:bg-white/20 hover:text-white disabled:opacity-35";
const TAB_NAME = "max-w-[11rem] truncate pl-2.5 pr-1 text-xs font-semibold";

/** "More" menu on a tab, for admin screens that can't be edited in place. */
function TabMore({ actions, onPick }: { actions: EditAction[]; onPick: (a: EditAction) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  if (!actions.length) return null;
  return (
    <div ref={ref} className="relative">
      <button type="button" className={TAB_BTN} title="More" aria-label="More" aria-expanded={open} onClick={() => setOpen((v) => !v)}><MoreHorizontal className="h-4 w-4" /></button>
      {open && (
        <div className="absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-xl border border-line bg-surface p-1 text-sm text-ink shadow-lg">
          {actions.map((a) => (
            <button key={a.href} type="button" onClick={() => { setOpen(false); onPick(a); }} className="block w-full whitespace-normal rounded-lg px-3 py-2 text-left hover:bg-bg">{a.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
const EditTools = dynamic(() => import("./edit-tools").then((m) => m.EditTools), { ssr: false });
const AdminPanel = dynamic(() => import("./edit-tools").then((m) => m.AdminPanel), { ssr: false });
const LivePanel = dynamic(() => import("./edit-tools").then((m) => m.LivePanel), { ssr: false });
const AdminBar = dynamic(() => import("./edit-chrome").then((m) => m.AdminBar), { ssr: false });
const EditSidebar = dynamic(() => import("./edit-chrome").then((m) => m.EditSidebar), { ssr: false });
const TemplatesPanel = dynamic(() => import("./edit-library").then((m) => m.TemplatesPanel), { ssr: false });
const SaveTemplateDialog = dynamic(() => import("./edit-library").then((m) => m.SaveTemplateDialog), { ssr: false });
const Finder = dynamic(() => import("./edit-library").then((m) => m.Finder), { ssr: false });
const WidgetsPanel = dynamic(() => import("./free-layout/editor").then((m) => m.WidgetsPanel), { ssr: false });
const InlineText = dynamic(() => import("./inline-text").then((m) => m.InlineText), { ssr: false });

/**
 * Scrolls to a section as soon as it's on the page (after a save the page refreshes, which can take a
 * moment), and outlines it briefly so you can see where it is.
 */
function revealSection(selector: string, onFound?: () => void, settle = 150) {
  const started = Date.now();
  const tick = () => {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) {
      if (Date.now() - started < 15_000) window.setTimeout(tick, 60);
      else onFound?.();
      return;
    }
    onFound?.();
    window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.setAttribute("data-cg-flash", "");
      window.setTimeout(() => el.removeAttribute("data-cg-flash"), 1600);
    }, settle);
  };
  tick();
}

/** Inside the tablet / mobile preview frame: show the page (with drafts) but no editing tools. */
const isFramed = () => typeof window !== "undefined" && window.self !== window.top && new URLSearchParams(window.location.search).has("cg_frame");
const hasHint = () => typeof document !== "undefined" && !isFramed() && /(?:^|;\s*)cg_staff=1/.test(document.cookie);
/**
 * What a section is called in edit mode: its own name (Admin › Pages), else its heading on the page,
 * else the kind of block ("Top banner with search"…).
 */
export function sectionName(s: EditSection) {
  const heading = [s.data.title, s.data.heading].find((v): v is string => typeof v === "string" && v.trim().length > 0)?.trim();
  return s.label || s.reusableName || (heading && heading.length <= 40 ? heading : s.typeName) || s.type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
const strip = (s: EditSection) => ({ id: s.id, type: s.type, label: s.label, isEnabled: s.isEnabled, data: s.data, reusableBlockId: s.reusableBlockId });

export function EditModeProvider({ children, styles = {} }: { children: ReactNode; styles?: Record<string, RegionStyle> }) {
  const pathname = usePathname();
  const router = useRouter();
  const [info, setInfo] = useState<EditInfo | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pageActions, setPageActions] = useState<EditAction[] | null>(null);
  const [pageLayout, setPageLayout] = useState<EditLayout | null>(null);
  const [panel, setPanel] = useState<Opened<EditAction> | null>(null);
  const [live, setLive] = useState<Opened<LiveTarget[]> | null>(null);
  const [siteMenu, setSiteMenu] = useState(false);
  const [docked, setDocked] = useState(false);
  useEffect(() => {
    try { setDocked(localStorage.getItem("cg_edit_dock") === "1"); } catch { /* storage blocked */ }
  }, []);
  const toggleDock = useCallback(() => {
    // Moving the editor re-opens it, so unsaved changes would be lost.
    if (dirty.current) return setMessage({ tone: "error", text: "Save or cancel your changes first, then move the editor" });
    setDocked((d) => {
      try { localStorage.setItem("cg_edit_dock", d ? "0" : "1"); } catch { /* ignore */ }
      return !d;
    });
  }, []);

  const load = useCallback(async () => {
    if (!hasHint()) return setInfo(null);
    try {
      const res = await fetch(`/api/edit/page?path=${encodeURIComponent(pathname)}`, { cache: "no-store" });
      const data = (await res.json()) as { editable: boolean } & Partial<EditInfo>;
      setInfo(data.editable ? (data as EditInfo) : null);
      return data.editable ? (data as EditInfo) : null;
    } catch {
      setInfo(null);
      return null;
    }
  }, [pathname]);

  useEffect(() => {
    setEditing(null);
    setAdding(null);
    setPanel(null);
    setLive(null);
    setSiteMenu(false);
    void load();
    try {
      setOn(sessionStorage.getItem("cg_edit") === "1");
    } catch {
      /* storage blocked */
    }
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(t);
  }, [message]);

  // Edit outlines (Elementor-style): only the part under the pointer (the innermost one) shows its
  // outline and its tab of buttons on its top edge; nothing is shown elsewhere.
  const editOn = on && Boolean(info);
  // Animations stay still while editing (app/motion.css › html[data-cg-editing]).
  useEffect(() => {
    document.documentElement.toggleAttribute("data-cg-editing", editOn);
    return () => document.documentElement.removeAttribute("data-cg-editing");
  }, [editOn]);
  useEffect(() => {
    if (!editOn) return;
    let hot: Element | null = null;
    const set = (el: Element | null) => {
      if (el === hot) return;
      hot?.removeAttribute("data-cg-hot");
      hot = el;
      if (!el) return;
      el.setAttribute("data-cg-hot", "");
      place(el);
    };
    // The tab sits on the part's top edge. When anything would hide it there (the top of the
    // window, the sticky header, a parent that clips its content), it goes just inside the part,
    // right below whatever covers it. Parts above the header (announcement bar) are raised over it,
    // so a tab that hangs below them stays visible.
    const place = (el: Element) => {
      const r = el.getBoundingClientRect();
      const header = document.querySelector("header.sticky");
      const h = header && !header.contains(el) ? header.getBoundingClientRect() : null;
      const aboveHeader = Boolean(h && r.bottom <= h.top + 1);
      // The website admin bar (32px) covers the very top of the window.
      let limit = document.documentElement.hasAttribute("data-cg-adminbar") ? 32 : 0;
      if (h && !aboveHeader) limit = Math.max(limit, h.bottom);
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.overflowX !== "visible" || cs.overflowY !== "visible") limit = Math.max(limit, p.getBoundingClientRect().top);
      }
      const inside = r.top - 18 < limit;
      el.toggleAttribute("data-cg-top", inside);
      el.toggleAttribute("data-cg-above", aboveHeader);
      (el as HTMLElement).style.setProperty("--cg-tab-top", `${Math.round(Math.max(6, limit - r.top + 6))}px`);
    };
    const onScroll = () => { if (hot) place(hot); };
    const over = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (t?.closest("[data-cg-ui]") && !t.closest("[data-cg-tab]")) return; // edit bar, panels
      set(t?.closest("[data-cg-edit]") ?? null);
    };
    const leave = () => set(null);
    document.addEventListener("mouseover", over);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseover", over);
      document.documentElement.removeEventListener("mouseleave", leave);
      set(null);
    };
  }, [editOn]);

  // Admin screens in the side panel tell us when they saved something: show it on the page.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || (e.data as { type?: string } | null)?.type !== "cg-admin-saved") return;
      router.refresh();
      void load();
      setMessage({ tone: "ok", text: "Saved — the page is updated" });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router, load]);

  // Edit mode on: this browser sees unpublished drafts (Next.js draft mode); off: the live site.
  const setPreview = useCallback(async (v: boolean) => {
    await fetch("/api/edit/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ on: v }) }).catch(() => null);
    router.refresh();
  }, [router]);
  const toggle = (v: boolean) => {
    setOn(v);
    closePanels();
    setDevice("desktop");
    setNavOpen(false);
    setWidgetsOpen(false);
    setTemplatesOpen(false);
    setFinderOpen(false);
    void setPreview(v);
    if (!v && changes.length) setMessage({ tone: "ok", text: `${changes.length} unpublished change${changes.length === 1 ? "" : "s"} kept as a draft` });
    try {
      sessionStorage.setItem("cg_edit", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  // ── Drafts, Undo / Redo ──────────────────────────────────────────────────────────────────────
  // Page sections and settings changed here are drafts until "Publish"; each change can be undone.
  const [changes, setChanges] = useState<{ key: string; label: string }[]>([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);
  const refreshDrafts = useCallback(async () => {
    try {
      const r = await fetch("/api/edit/draft", { cache: "no-store" });
      if (r.ok) setChanges(((await r.json()) as { changes: { key: string; label: string }[] }).changes);
    } catch { /* offline */ }
    setDraftVersion((n) => n + 1);
  }, []);
  const undoStack = useRef<UndoEntry[][]>([]);
  const redoStack = useRef<UndoEntry[][]>([]);
  const [, setHistory] = useState(0);
  const record = useCallback((entries?: UndoEntry[]) => {
    if (entries?.length) {
      undoStack.current.push(entries);
      if (undoStack.current.length > 100) undoStack.current.shift();
      redoStack.current = [];
      setHistory((n) => n + 1);
    }
    void refreshDrafts();
  }, [refreshDrafts]);

  // A section being added: a placeholder shows at its place right away (and the page scrolls
  // there), until the real section has been saved and the page has refreshed.
  const [pendingInsert, setPendingInsert] = useState<{ at: number; label: string } | null>(null);
  // Copied section (survives moving to another page in this tab).
  const [clip, setClip] = useState<ClipSection | null>(null);
  useEffect(() => {
    try { const raw = sessionStorage.getItem("cg_clip"); if (raw) setClip(JSON.parse(raw) as ClipSection); } catch { /* none */ }
  }, []);
  const copySection = useCallback((c: ClipSection | null) => {
    setClip(c);
    try {
      if (c) sessionStorage.setItem("cg_clip", JSON.stringify(c));
      else sessionStorage.removeItem("cg_clip");
    } catch { /* too big or blocked: kept for this page only */ }
    setMessage(c ? { tone: "ok", text: `Copied “${c.label}” — paste it into a Free layout column (its “+”), or add it as a new Free layout` } : { tone: "ok", text: "Copied section cleared" });
  }, []);
  const apply = useCallback(
    async (next: EditSection[], revisionMessage: string, openAfter?: number, reveal?: number) => {
      if (!info?.page) return false;
      if (reveal !== undefined) {
        setPendingInsert({ at: reveal, label: /“(.+)”/.exec(revisionMessage)?.[1] ?? "section" });
        revealSection("[data-cg-pending]", undefined, 0);
      }
      setBusy(true);
      try {
        // Saved as the page's draft: visible in edit mode, live after "Publish".
        const res = await fetch("/api/edit/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: `page:${info.page.id}`, value: next.map(strip) }) });
        const data = (await res.json().catch(() => ({}))) as { error?: string; undo?: UndoEntry };
        if (!res.ok) {
          setPendingInsert(null);
          setMessage({ tone: "error", text: data.error ?? "Couldn't save." });
          return false;
        }
        record(data.undo ? [data.undo] : []);
        const fresh = await load();
        router.refresh();
        setMessage({ tone: "ok", text: `${revisionMessage.replace(/ \(edit mode\)$/, "")} — saved as a draft` });
        const target = fresh?.sections[reveal ?? openAfter ?? -1]?.id;
        if (target) revealSection(`[data-cg-section="${CSS.escape(target)}"]`, () => setPendingInsert(null));
        else setPendingInsert(null);
        // A section just added: close "Add a section" and open its form.
        if (openAfter !== undefined && fresh?.sections[openAfter]) {
          setAdding(null);
          setEditing(fresh.sections[openAfter]!.key);
        }
        return true;
      } catch {
        setPendingInsert(null);
        setMessage({ tone: "error", text: "Couldn't save. Check your connection and try again." });
        return false;
      } finally {
        setBusy(false);
      }
    },
    [info, load, router, record],
  );

  // Undo / Redo put the drafts back as they were before / after a change.
  const restore = useCallback(async (entries: UndoEntry[], to: "before" | "after") => {
    for (const e of to === "before" ? [...entries].reverse() : entries) {
      const res = await fetch("/api/edit/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: e.key, value: e[to] ?? null }) });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? "Couldn't undo.");
      }
    }
  }, []);
  const step = useCallback(async (dir: "undo" | "redo") => {
    const from = dir === "undo" ? undoStack.current : redoStack.current;
    const to = dir === "undo" ? redoStack.current : undoStack.current;
    const group = from.pop();
    if (!group || busy) return;
    setBusy(true);
    try {
      await restore(group, dir === "undo" ? "before" : "after");
      to.push(group);
      setMessage({ tone: "ok", text: dir === "undo" ? "Undone" : "Redone" });
    } catch (e) {
      from.push(group);
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Couldn't undo." });
    } finally {
      setHistory((n) => n + 1);
      setBusy(false);
      void load();
      void refreshDrafts();
      router.refresh();
    }
  }, [busy, restore, load, refreshDrafts, router]);

  const publish = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/edit/draft/publish", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { published?: number; errors?: string[]; queued?: string[]; error?: string };
      if (!res.ok) return setMessage({ tone: "error", text: data.error ?? "Couldn't publish." });
      undoStack.current = [];
      redoStack.current = [];
      setHistory((n) => n + 1);
      setMessage(
        data.errors?.length ? { tone: "error", text: `Published ${data.published}; not published: ${data.errors.join("; ")}` }
        : data.queued?.length ? { tone: "ok", text: `${data.published ? `Published ${data.published}. ` : ""}${data.queued.join(" ")}` }
        : { tone: "ok", text: "Published — visitors see your changes now" },
      );
    } catch {
      setMessage({ tone: "error", text: "Couldn't publish. Check your connection and try again." });
    } finally {
      setBusy(false);
      void load();
      void refreshDrafts();
      router.refresh();
    }
  }, [load, refreshDrafts, router]);
  const discard = useCallback(async () => {
    setConfirmDiscard(false);
    setBusy(true);
    try {
      const res = await fetch("/api/edit/draft", { method: "DELETE" });
      if (!res.ok) return setMessage({ tone: "error", text: "Couldn't discard the changes." });
      undoStack.current = [];
      redoStack.current = [];
      setHistory((n) => n + 1);
      setMessage({ tone: "ok", text: "Unpublished changes discarded" });
    } finally {
      setBusy(false);
      void load();
      void refreshDrafts();
      router.refresh();
    }
  }, [load, refreshDrafts, router]);

  // ── Navigator and device preview ───────────────────────────────────────────────────────────
  const [navOpen, setNavOpen] = useState(false);
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  // ── Templates and Finder (stage 4) ──
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);
  const [saveTpl, setSaveTpl] = useState<{ kind: "section" | "row" | "page"; data: unknown; name: string } | null>(null);
  const saveTemplate = useCallback((kind: "section" | "row" | "page", data: unknown, name: string) => setSaveTpl({ kind, data, name }), []);
  /** Inserts a template as a copy: a section / page at the end of this page, a row into a Free layout. */
  const insertTemplate = useCallback(async (t: { id: string; name: string; kind: "section" | "row" | "page" }, mode: "append" | "replace" = "append") => {
    if (!info?.page) return setMessage({ tone: "error", text: "Templates go into the homepage and your own pages" });
    const res = await fetch(`/api/edit/templates/${t.id}`, { cache: "no-store" });
    const tpl = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
    if (!res.ok || !tpl.data) return setMessage({ tone: "error", text: tpl.error ?? "Couldn't load the template." });
    const fl = await import("@/lib/blocks/free-layout");
    const end = info.sections.length;
    const newLayout = (rows: unknown) => ({ key: `new-${Date.now()}-${Math.random()}`, type: "LAYOUT", label: null, isEnabled: true, data: { rows } as Record<string, unknown>, reusableBlockId: null });
    if (t.kind === "row") {
      const clip = { blockType: "LAYOUT", label: t.name, data: tpl.data };
      const editor = await import("./free-layout/editor");
      if (editor.pasteIntoActive(clip)) return setMessage({ tone: "ok", text: `Inserted “${t.name}” — saving as a draft` });
      const content = fl.clipToContent(clip);
      return void apply([...info.sections, newLayout("rows" in content ? content.rows : [])], `Added “${t.name}” (edit mode)`, undefined, end);
    }
    if (t.kind === "section") {
      const clip = tpl.data as unknown as ClipSection;
      const content = fl.clipToContent(clip);
      const rows = "rows" in content ? content.rows : [{ ...fl.newRow([12]), columns: [{ ...fl.newRow([12]).columns[0]!, widgets: content.widgets }] }];
      return void apply([...info.sections, newLayout(rows)], `Added “${t.name}” (edit mode)`, undefined, end);
    }
    const sections = ((tpl.data.sections as { type: string; label: string | null; data: Record<string, unknown> }[]) ?? []).map((x, i) => ({ key: `new-${Date.now()}-${i}`, type: x.type, label: x.label, isEnabled: true, data: x.data, reusableBlockId: null }));
    void apply(mode === "replace" ? sections : [...info.sections, ...sections], `${mode === "replace" ? "Replaced the page with" : "Added"} “${t.name}” (edit mode)`, undefined, mode === "replace" ? 0 : end);
  }, [info, apply]);
  // A new Free layout section at the end of the page (from the Widgets panel).
  const addFreeLayout = useCallback(async () => {
    if (!info?.page) return;
    const { defaultBlockData } = await import("@/lib/blocks/schemas");
    await apply([...info.sections, { key: `new-${Date.now()}`, type: "LAYOUT", label: null, isEnabled: true, data: defaultBlockData("LAYOUT") as unknown as Record<string, unknown>, reusableBlockId: null }], "Added a Free layout section (edit mode)", undefined, info.sections.length);
  }, [info, apply]);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");

  // Edit mode on (also after a reload): make sure this browser sees the drafts, and count them.
  const previewSynced = useRef(false);
  useEffect(() => {
    if (!info || !on) return;
    void refreshDrafts();
    if (!previewSynced.current) {
      previewSynced.current = true;
      void setPreview(true);
    }
  }, [info, on, refreshDrafts, setPreview]);

  // Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y): undo / redo, unless you're typing in a field.
  useEffect(() => {
    if (!on || !info) return;
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input,textarea,select,[contenteditable='true'],[contenteditable='plaintext-only']")) return;
      const k = e.key.toLowerCase();
      if (k === "k" || k === "e") { e.preventDefault(); setFinderOpen(true); return; }
      if (k === "z" && !e.shiftKey) { e.preventDefault(); void step("undo"); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); void step("redo"); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [on, info, step]);

  // One editor at a time, shown in place of the part of the page it edits. Opening another part
  // closes it, unless it has unsaved changes.
  const dirty = useRef(false);
  const onDirty = useCallback((d: boolean) => { dirty.current = d; }, []);
  const swap = useCallback((show: () => void) => {
    if (dirty.current) {
      setMessage({ tone: "error", text: "Save or cancel the changes in the panel first" });
      return;
    }
    setEditing(null);
    setAdding(null);
    setPanel(null);
    setLive(null);
    show();
  }, []);
  const closePanels = useCallback(() => { dirty.current = false; setEditing(null); setAdding(null); setPanel(null); setLive(null); }, []);
  const editSection = useCallback((key: string) => swap(() => setEditing(key)), [swap]);
  const addSectionAt = useCallback((i: number) => swap(() => setAdding(i)), [swap]);
  const openLive = useCallback((t: LiveTarget[], at: string | null = null) => swap(() => setLive({ what: t, at })), [swap]);

  // Admin links that can be edited in place (website texts, settings) open the in-place editor.
  const openAction = useCallback((a: EditAction, at: string | null = null) => {
    const t = liveFromHref(a.href);
    swap(() => (t ? setLive({ what: [{ ...t, title: a.label }], at }) : setPanel({ what: a, at })));
  }, [swap]);
  const onLiveSaved = useCallback((undo: UndoEntry[] = []) => {
    record(undo);
    router.refresh();
    void load();
    setMessage({ tone: "ok", text: undo.length ? "Saved as a draft — Publish to put it live" : "Saved — the page is updated" });
  }, [router, load, record]);

  // The open editor scrolls into view.
  const openAt = editing && !editing.startsWith("delete:") ? `sec:${editing}` : live?.at ?? panel?.at ?? null;
  useEffect(() => {
    if (!openAt) return;
    const t = window.setTimeout(() => document.querySelector("[data-cg-open]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    return () => window.clearTimeout(t);
  }, [openAt]);

  // Docked: the panel on the left pushes the page aside, and the section stays visible (outlined).
  const sectionOpen = Boolean(editing && !editing.startsWith("delete:"));
  const showDock = Boolean((on || info?.me?.ui === false) && info && docked && (sectionOpen || live || panel));
  const dockWidth = panel ? "min(46rem,58vw)" : "min(28rem,42vw)";
  useEffect(() => {
    const root = document.documentElement;
    if (!showDock) return root.removeAttribute("data-cg-dock");
    root.setAttribute("data-cg-dock", "");
    root.style.setProperty("--cg-dock", dockWidth);
    root.style.setProperty("--cg-dock-w", dockWidth);
    return () => { root.removeAttribute("data-cg-dock"); root.style.removeProperty("--cg-dock-w"); };
  }, [showDock, dockWidth]);

  const perms = useMemo(() => new Set(info?.perms ?? []), [info]);
  const canHref = useCallback((href: string) => {
    const t = liveFromHref(href);
    const need = t ? LIVE_KIND_PERMISSION[t.kind] : adminHrefPermission(href);
    return !need || perms.has(need);
  }, [perms]);
  const canTarget = useCallback((t: LiveTarget) => perms.has(LIVE_KIND_PERMISSION[t.kind]), [perms]);
  // Page layouts (product, category… pages) change the setting shared by every page of that type.
  const layout = pageLayout && canHref("/admin/cms/layouts") ? pageLayout : null;
  const saveLayout = useCallback(async (items: EditLayoutItem[], note: string) => {
    if (!pageLayout) return;
    setBusy(true);
    try {
      const res = await fetch("/api/edit/layout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: pageLayout.page, entries: items.map((i) => ({ id: i.id, visible: i.visible })) }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; undo?: UndoEntry[] };
      if (!res.ok) return setMessage({ tone: "error", text: data.error ?? "Couldn't save the layout." });
      record(data.undo);
      setPageLayout({ ...pageLayout, items });
      router.refresh();
      setMessage({ tone: "ok", text: `${note} — on every ${pageLayout.title.toLowerCase()} (draft)` });
    } catch {
      setMessage({ tone: "error", text: "Couldn't save. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }, [pageLayout, router, record]);
  const [layoutMenu, setLayoutMenu] = useState(false);

  // ── WordPress-style admin bar (staff, always) and admin-menu sidebar (edit mode) ──
  // UI Editor switched off (Settings › Edit Mode): no editing tools, but the sidebar editor can
  // still be used — "Admin menu" in the admin bar opens it, its screens open over the page.
  const uiOff = info?.me?.ui === false;
  const sidebarOn = info?.me?.sidebar !== false;
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (uiOff && on) setOn(false);
  }, [uiOff, on]);
  const showSide = Boolean(info && sidebarOn && (uiOff ? menuOpen : on));
  const [sideCollapsed, setSideCollapsed] = useState(false);
  useEffect(() => {
    try { setSideCollapsed(localStorage.getItem("cg_side_collapsed") === "1"); } catch { /* storage blocked */ }
  }, []);
  const collapseSide = (c: boolean) => {
    setSideCollapsed(c);
    try { localStorage.setItem("cg_side_collapsed", c ? "1" : "0"); } catch { /* ignore */ }
  };
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-cg-adminbar", Boolean(info));
    const side = showSide;
    root.toggleAttribute("data-cg-side", side);
    if (side) root.style.setProperty("--cg-side", sideCollapsed ? "36px" : "160px");
    else root.style.removeProperty("--cg-side");
    return () => { root.removeAttribute("data-cg-adminbar"); root.removeAttribute("data-cg-side"); root.style.removeProperty("--cg-side"); };
  }, [info, showSide, sideCollapsed]);
  // From the bar / sidebar: in edit mode the screen opens in the editor panel; otherwise go to the admin.
  const openAdmin = (label: string, href: string) => {
    if (on) openAction({ label, href });
    else if (uiOff && sidebarOn) { setLive(null); setPanel({ what: { label, href }, at: null }); }
    else window.location.assign(href);
  };

  const ctx = useMemo<Ctx>(
    () => ({ on: on && Boolean(info), info, busy, edit: editSection, apply, addAt: addSectionAt, setPageActions, open: openAction, openLive, editing, live, panel, closePanels, onDirty, onLiveSaved, docked, toggleDock, canTarget, canHref, layout, setLayout: setPageLayout, saveLayout: (i, m) => void saveLayout(i, m), pendingInsert, clip, copySection, saveTemplate }),
    [on, info, busy, apply, openAction, editSection, addSectionAt, openLive, editing, live, panel, closePanels, onDirty, onLiveSaved, docked, toggleDock, canTarget, canHref, layout, saveLayout, pendingInsert, clip, copySection, saveTemplate],
  );
  const actions: EditAction[] = [...(pageActions ?? []), ...(info?.page ? [{ label: "Page settings & SEO", href: `/admin/cms/pages/${info.page.id}` }] : [])].filter((a) => canHref(a.href));
  const siteActions = SITE_ACTIONS.filter((a) => canHref(a.href));
  const hidden = info?.sections.filter((s) => !s.isEnabled) ?? [];

  return (
    <StylesCtx.Provider value={styles}>
    <EditCtx.Provider value={ctx}>
      {info && <style>{BAR_CSS}</style>}
      {editOn && <style>{EDIT_CSS}</style>}
      {info && (
        <AdminBar
          siteName={info.me?.siteName ?? "Website"}
          userName={info.me?.name ?? "there"}
          on={on}
          unpublished={changes.length}
          busy={busy}
          canHref={canHref}
          editAllowed={!uiOff}
          menuButton={uiOff && sidebarOn ? { open: menuOpen, onToggle: () => setMenuOpen((v) => !v) } : undefined}
          onToggle={toggle}
          onFind={() => setFinderOpen(true)}
          onPublish={() => void publish()}
          openAdmin={openAdmin}
        />
      )}
      {showSide && <EditSidebar collapsed={sideCollapsed} onCollapse={collapseSide} canHref={canHref} openAdmin={openAdmin} />}
      {children}
      {editOn && (
        <InlineText
          onMore={(region) => {
            const key = region.getAttribute("data-cg-key");
            if (key) return editSection(key);
            try {
              const t = JSON.parse(region.getAttribute("data-cg-targets") || "[]") as LiveTarget[];
              openLive(withDiscovery(t, region, region.getAttribute("data-cg-style-key"), canTarget), region.getAttribute("data-cg-at"));
            } catch { /* no targets */ }
          }}
          onSaved={(undo) => { record(undo); void load(); setMessage({ tone: "ok", text: undo.length ? "Saved as a draft — Publish to put it live" : "Saved — the page is updated" }); }}
        />
      )}
      {info && (on || message) && (
        <div data-cg-ui className="fixed bottom-4 left-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/95 p-2 text-sm shadow-[0_18px_48px_-18px_rgb(0_0_0/0.45)] backdrop-blur">
          {!on ? (
            <button type="button" onClick={() => toggle(true)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-3.5 font-semibold text-primary-fg hover:bg-primary/90">
              <Pencil className="h-4 w-4" aria-hidden /> Edit this page
            </button>
          ) : (
            <>
              <span className="px-1.5 font-semibold text-ink">
                Edit mode
                {info.page && <span className="ml-1.5 font-normal text-muted">· {info.page.title} · {info.sections.length} section{info.sections.length === 1 ? "" : "s"}</span>}
              </span>
              <span className="flex items-center rounded-xl border border-line">
                <button type="button" className="grid h-9 w-9 place-items-center rounded-l-xl text-ink hover:bg-bg disabled:opacity-30" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={busy || !undoStack.current.length} onClick={() => void step("undo")}><Undo2 className="h-4 w-4" /></button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-r-xl border-l border-line text-ink hover:bg-bg disabled:opacity-30" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled={busy || !redoStack.current.length} onClick={() => void step("redo")}><Redo2 className="h-4 w-4" /></button>
              </span>
              <span className="flex items-center rounded-xl border border-line" role="group" aria-label="Preview size">
                {([["desktop", Monitor, "Desktop"], ["tablet", Tablet, "Tablet preview"], ["mobile", Smartphone, "Mobile preview"]] as const).map(([d, I, t], i) => (
                  <button key={d} type="button" title={t} aria-label={t} aria-pressed={device === d} onClick={() => setDevice(d)} className={cn("grid h-9 w-9 place-items-center text-ink hover:bg-bg", i === 0 && "rounded-l-xl", i === 2 && "rounded-r-xl", i > 0 && "border-l border-line", device === d && "bg-primary-soft text-primary")}><I className="h-4 w-4" /></button>
                ))}
              </span>
              {info.page && (
                <button type="button" onClick={() => { setWidgetsOpen((v) => !v); setNavOpen(false); setTemplatesOpen(false); }} aria-pressed={widgetsOpen} className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 font-medium text-ink hover:bg-bg", widgetsOpen && "bg-primary-soft text-primary")}>
                  <Plus className="h-4 w-4" aria-hidden /> Widgets
                </button>
              )}
              {info.page && canHref("/admin/cms/pages") && (
                <button type="button" onClick={() => { setTemplatesOpen((v) => !v); setWidgetsOpen(false); setNavOpen(false); }} aria-pressed={templatesOpen} className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 font-medium text-ink hover:bg-bg", templatesOpen && "bg-primary-soft text-primary")}>
                  <Bookmark className="h-4 w-4" aria-hidden /> Templates
                </button>
              )}
              <button type="button" onClick={() => setFinderOpen(true)} title="Find (Ctrl+K)" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 font-medium text-ink hover:bg-bg">
                <Search className="h-4 w-4" aria-hidden /> Find <kbd className="hidden rounded border border-line px-1 text-[10px] text-muted sm:inline">Ctrl K</kbd>
              </button>
              <button type="button" onClick={() => { setNavOpen((v) => !v); setWidgetsOpen(false); setTemplatesOpen(false); }} aria-pressed={navOpen} className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 font-medium text-ink hover:bg-bg", navOpen && "bg-primary-soft text-primary")}>
                <ListTree className="h-4 w-4" aria-hidden /> Navigator
              </button>
              {changes.length > 0 ? (
                <span className="flex items-center gap-1.5 rounded-xl bg-[#FEF3C7] py-1 pl-2.5 pr-1 text-[#92400E]" title={changes.map((c) => c.label).join(", ")}>
                  <span className="h-2 w-2 rounded-full bg-[#F59E0B]" aria-hidden />
                  <span className="text-xs font-semibold">{changes.length} unpublished</span>
                  {confirmDiscard ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => void discard()} className="h-7 rounded-lg bg-danger px-2.5 text-xs font-semibold text-white">Discard all</button>
                      <button type="button" onClick={() => setConfirmDiscard(false)} className="h-7 rounded-lg px-2 text-xs font-medium hover:bg-white/60">Keep</button>
                    </>
                  ) : (
                    <>
                      <button type="button" disabled={busy} onClick={() => setConfirmDiscard(true)} className="h-7 rounded-lg px-2 text-xs font-medium hover:bg-white/60">Discard</button>
                      <button type="button" disabled={busy} onClick={() => void publish()} className="h-7 rounded-lg bg-[#2563eb] px-3 text-xs font-bold text-white hover:bg-[#1d4ed8] disabled:opacity-60">{busy ? "…" : "Publish"}</button>
                    </>
                  )}
                </span>
              ) : (
                <span className="px-1 text-xs text-muted">All changes published</span>
              )}
              {actions.map((a) => (
                <button key={a.href} type="button" onClick={() => openAction(a)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-xl px-3 font-medium", a.primary ? "bg-primary font-semibold text-primary-fg hover:bg-primary/90" : "border border-line text-ink hover:bg-bg")}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden /> {a.label}
                </button>
              ))}
              {info.page && (
                <button type="button" disabled={busy} onClick={() => addSectionAt(info.sections.length)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 font-medium text-ink hover:bg-bg disabled:opacity-50">
                  <Plus className="h-4 w-4" aria-hidden /> Add section
                </button>
              )}
              {siteActions.length > 0 && <div className="relative">
                <button type="button" onClick={() => setSiteMenu((v) => !v)} aria-expanded={siteMenu} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 font-medium text-ink hover:bg-bg">
                  <Globe className="h-4 w-4" aria-hidden /> Whole website
                </button>
                {siteMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                    {siteActions.map((a) => (
                      <button key={a.href} type="button" onClick={() => { openAction(a); setSiteMenu(false); }} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-bg">{a.label}</button>
                    ))}
                  </div>
                )}
              </div>}
              {layout && (
                <div className="relative">
                  <button type="button" onClick={() => setLayoutMenu((v) => !v)} aria-expanded={layoutMenu} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 font-medium text-ink hover:bg-bg">
                    <LayoutList className="h-4 w-4" aria-hidden /> {layout.title} layout
                    <span className="text-xs font-normal text-muted">· {layout.items.filter((i) => i.visible).length} of {layout.items.length} shown</span>
                  </button>
                  {layoutMenu && <LayoutMenu layout={layout} busy={busy} save={(items, m) => void saveLayout(items, m)} onClose={() => setLayoutMenu(false)} />}
                </div>
              )}
              {info.page && hidden.length > 0 && (
                <details className="relative">
                  <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-xl border border-line px-3 font-medium text-ink hover:bg-bg">
                    <EyeOff className="h-4 w-4" aria-hidden /> Hidden ({hidden.length})
                  </summary>
                  <div className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-line bg-surface p-2 shadow-lg">
                    {hidden.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        disabled={busy}
                        onClick={() => void apply(info.sections.map((x) => (x.key === s.key ? { ...x, isEnabled: true } : x)), "Showed a section (edit mode)")}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-bg"
                      >
                        <span className="truncate">{sectionName(s)}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary"><Eye className="h-3.5 w-3.5" aria-hidden /> Show</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
              <button type="button" onClick={() => toggle(false)} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink px-3 font-semibold text-white hover:bg-ink/90">
                <LogOut className="h-4 w-4" aria-hidden /> Done
              </button>
            </>
          )}
          {message && <span className={cn("px-1.5 text-xs font-medium", message.tone === "ok" ? "text-success" : "text-danger")} role="status">{message.text}</span>}
        </div>
      )}
      {info && on && navOpen && <Navigator onClose={() => setNavOpen(false)} version={draftVersion} />}
      {info?.page && on && templatesOpen && (
        <TemplatesPanel
          onClose={() => setTemplatesOpen(false)}
          onInsert={(t, mode) => void insertTemplate(t, mode)}
          canSavePage={Boolean(info.sections.some((x) => !x.reusableBlockId))}
          onSavePage={() => saveTemplate("page", { sections: info.sections.filter((x) => !x.reusableBlockId && x.isEnabled).map((x) => ({ type: x.type, label: x.label, data: x.data })) }, info.page!.title)}
        />
      )}
      {info && on && saveTpl && (
        <SaveTemplateDialog kind={saveTpl.kind} data={saveTpl.data} defaultName={saveTpl.name} onClose={() => setSaveTpl(null)} onSaved={(msg) => { setSaveTpl(null); setMessage({ tone: "ok", text: msg }); }} />
      )}
      {info && on && finderOpen && (
        <Finder
          onClose={() => setFinderOpen(false)}
          go={(href) => router.push(href)}
          openAdmin={(label, href) => openAction({ label, href })}
          insertTemplate={(t) => void insertTemplate(t)}
          canHref={canHref}
          extra={[
            ...(changes.length ? [{ label: `Publish ${changes.length} unpublished change${changes.length === 1 ? "" : "s"}`, run: () => void publish() }] : []),
            { label: "Open the Navigator", run: () => setNavOpen(true) },
            ...(info.page ? [{ label: "Open the Widgets panel", run: () => setWidgetsOpen(true) }, { label: "Open Templates", run: () => setTemplatesOpen(true) }] : []),
            { label: "Tablet preview", run: () => setDevice("tablet") },
            { label: "Mobile preview", run: () => setDevice("mobile") },
          ]}
        />
      )}
      {info?.page && on && widgetsOpen && <WidgetsPanel onClose={() => setWidgetsOpen(false)} onAddLayout={() => void addFreeLayout()} />}
      {info && on && device !== "desktop" && <DevicePreview device={device} version={draftVersion} onClose={() => setDevice("desktop")} />}
      {/* Section editors open inside their section (EditableSection); deleting and adding are dialogs. */}
      {info?.page && on && (editing?.startsWith("delete:") || adding !== null) && (
        <EditTools info={{ ...info, page: info.page }} busy={busy} editingKey={editing} addingAt={adding} onClose={closePanels} apply={apply} onDirty={onDirty} />
      )}
      {/* Docked on the left: whatever editor is open. */}
      {showDock && info && (
        <div data-cg-ui className="fixed bottom-0 left-[var(--cg-side,0px)] top-8 z-[70] w-[var(--cg-dock)] max-w-full overflow-y-auto border-r border-line bg-surface shadow-[8px_0_30px_-18px_rgb(0_0_0/0.35)] [&>*]:max-w-none [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none">
          {sectionOpen && info.page && <EditTools info={{ ...info, page: info.page }} busy={busy} editingKey={editing} addingAt={null} onClose={closePanels} apply={apply} onDirty={onDirty} />}
          {panel && <AdminPanel title={panel.what.label} href={panel.what.href} onClose={closePanels} />}
          {live && <LivePanel key={live.what.map((t) => `${t.kind}${t.id}${t.section}`).join("|")} targets={live.what} onClose={closePanels} onDirty={onDirty} onSaved={onLiveSaved} />}
        </div>
      )}
      {/* In the page, opened from the edit bar (whole website, page settings): not tied to a part of the page. */}
      {info && (on || info.me?.ui === false) && !docked && (panel?.at === null || live?.at === null) && (
        <div className="fixed inset-0 z-[68] overflow-y-auto bg-ink/30 p-4 pt-16" onMouseDown={(e) => e.target === e.currentTarget && !dirty.current && closePanels()}>
          <div className="mx-auto max-w-3xl">
            {panel?.at === null && <AdminPanel title={panel.what.label} href={panel.what.href} onClose={closePanels} />}
            {live?.at === null && <LivePanel key={live.what.map((t) => `${t.kind}${t.id}${t.section}`).join("|")} targets={live.what} onClose={closePanels} onDirty={onDirty} onSaved={onLiveSaved} />}
          </div>
        </div>
      )}
    </EditCtx.Provider>
    </StylesCtx.Provider>
  );
}

/**
 * Navigator: every editable part of this page, in order and nested, like Elementor's structure
 * panel. Hover to find it on the page, click to go there and open its editor.
 */
function Navigator({ onClose, version }: { onClose: () => void; version: number }) {
  const [items, setItems] = useState<{ el: HTMLElement; name: string; depth: number }[]>([]);
  const scan = useCallback(() => {
    const els = [...document.querySelectorAll<HTMLElement>("[data-cg-edit]")];
    setItems(els.map((el) => {
      let depth = 0;
      for (let p = el.parentElement?.closest("[data-cg-edit]"); p; p = p.parentElement?.closest("[data-cg-edit]")) depth++;
      const name = el.querySelector(":scope > [data-cg-tab] span")?.textContent?.trim() || "Section";
      return { el, name, depth };
    }));
  }, []);
  useEffect(() => {
    const t = window.setTimeout(scan, 300); // after the page has refreshed
    return () => window.clearTimeout(t);
  }, [scan, version]);
  const flash = (el: HTMLElement, on: boolean) => el.toggleAttribute("data-cg-flash", on);
  return (
    <aside data-cg-ui className="fixed left-[calc(var(--cg-side,0px)+1rem)] top-24 z-[62] flex max-h-[calc(100vh-12rem)] w-72 flex-col rounded-2xl border border-line bg-surface text-sm shadow-[0_18px_48px_-18px_rgb(0_0_0/0.45)]" aria-label="Navigator">
      <header className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink"><ListTree className="h-4 w-4" aria-hidden /> Navigator</span>
        <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-bg" aria-label="Close navigator"><X className="h-4 w-4" /></button>
      </header>
      <ol className="flex-1 overflow-y-auto p-1.5">
        {items.map(({ el, name, depth }, i) => (
          <li key={i}>
            <button
              type="button"
              onMouseEnter={() => flash(el, true)}
              onMouseLeave={() => flash(el, false)}
              onClick={() => {
                flash(el, false);
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                window.setTimeout(() => (el.querySelector(":scope > [data-cg-tab] button") as HTMLButtonElement | null)?.click(), 450);
              }}
              className="flex w-full items-center gap-1.5 rounded-lg py-1.5 pr-2 text-left text-ink hover:bg-bg"
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", depth ? "bg-muted" : "bg-[#2563eb]")} aria-hidden />
              <span className="truncate">{name}</span>
            </button>
          </li>
        ))}
        {!items.length && <li className="px-2 py-6 text-center text-xs text-muted">Nothing editable on this page.</li>}
      </ol>
      <p className="border-t border-line px-3 py-2 text-[11px] text-muted">Hover to find a part on the page, click to edit it.</p>
    </aside>
  );
}

/** Tablet / mobile preview of this page (with your drafts) in a frame of that width. */
function DevicePreview({ device, version, onClose }: { device: "tablet" | "mobile"; version: number; onClose: () => void }) {
  const width = device === "tablet" ? 820 : 390;
  const src = useMemo(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("cg_frame", "1");
    return u.pathname + u.search;
  }, []);
  return (
    <div data-cg-ui className="fixed inset-0 z-[64] flex flex-col items-center bg-ink/70 px-4 pb-24 pt-4 backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-3 text-sm text-white">
        <span className="font-semibold">{device === "tablet" ? "Tablet" : "Mobile"} preview · {width}px</span>
        <span className="text-white/70">Edit on the desktop view; this updates after each change.</span>
        <button type="button" onClick={onClose} className="inline-flex h-8 items-center gap-1 rounded-lg bg-white/15 px-3 font-medium hover:bg-white/25"><X className="h-4 w-4" aria-hidden /> Close</button>
      </div>
      <iframe key={version} src={src} title={`${device} preview`} className="h-full max-w-full rounded-[1.5rem] border-[10px] border-ink bg-surface shadow-2xl" style={{ width: width + 20 }} />
    </div>
  );
}

/**
 * For a section that edits itself on the page (Free layout): saving its data as the page's draft.
 * null when edit mode is off or the section can't be edited here.
 */
export function useSectionEditor(id: string) {
  const ctx = useContext(EditCtx);
  if (!ctx?.on || !ctx.info?.page) return null;
  const list = ctx.info.sections;
  const index = list.findIndex((s) => s.id === id);
  if (index < 0 || list[index]!.reusableBlockId) return null;
  return {
    busy: ctx.busy,
    save: (data: Record<string, unknown>) => ctx.apply(list.map((s, i) => (i === index ? { ...s, data } : s)), `Edited “${sectionName(list[index]!)}” (edit mode)`),
  };
}
export type SectionEditor = NonNullable<ReturnType<typeof useSectionEditor>>;

/** The copied section (for pasting into a Free layout), if any. */
export function useEditClipboard(): ClipSection | null {
  return useContext(EditCtx)?.clip ?? null;
}
/** "Save as template" (for a Free layout row). */
export function useSaveTemplate() {
  const ctx = useContext(EditCtx);
  return (kind: "section" | "row" | "page", data: unknown, name: string) => ctx?.saveTemplate(kind, data, name);
}
/** Forgets the copied section (the × next to "Paste …"). */
export function useClearClipboard(): () => void {
  const ctx = useContext(EditCtx);
  return () => ctx?.copySection(null);
}

/** For the editors: whether they're docked on the left, and the button to switch. */
export function useEditDock() {
  const ctx = useContext(EditCtx);
  return { docked: Boolean(ctx?.docked), toggle: ctx?.toggleDock ?? (() => undefined) };
}

/** Where a section is being added: shown at once, replaced by the section when it's saved. */
function AddingPlaceholder({ label }: { label: string }) {
  return (
    <div data-cg-pending="" className="container py-4" aria-live="polite">
      <div className="flex h-28 items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#2563eb] bg-[#2563eb]/5 text-sm font-semibold text-[#2563eb]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2563eb] border-t-transparent" aria-hidden />
        Adding “{label}”…
      </div>
    </div>
  );
}

/** Wraps one page section on the website; in edit mode it shows an outline and the section toolbar. */
export function EditableSection({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(EditCtx);
  const design = `section:${id}`;
  const css = regionStyleCss(useContext(StylesCtx)[design]);
  const index = ctx?.info?.sections.findIndex((s) => s.id === id) ?? -1;
  const active = Boolean(ctx?.on && ctx.info && index >= 0);
  if (!active || !ctx?.info) return <div data-cg-section={id} style={css ?? undefined}>{children}</div>;
  const { info, busy, apply, edit, addAt } = ctx;
  const list = info.sections;
  const s = list[index]!;
  const name = sectionName(s);
  const designAt = `secd:${s.key}`;
  if (ctx.live?.at === designAt && !ctx.docked) {
    return (
      <div data-cg-section={id} data-cg-edit="" data-cg-open="" className="px-3 py-4">
        <LivePanel key={designAt} targets={ctx.live.what} onClose={ctx.closePanels} onDirty={ctx.onDirty} onSaved={ctx.onLiveSaved} />
      </div>
    );
  }
  if (ctx.editing === s.key && info.page && !ctx.docked) {
    return (
      <div data-cg-section={id} data-cg-edit="" data-cg-open="" className="px-3 py-4">
        <EditTools info={{ ...info, page: info.page }} busy={busy} editingKey={s.key} addingAt={null} onClose={ctx.closePanels} apply={apply} onDirty={ctx.onDirty} />
      </div>
    );
  }
  const move = (d: -1 | 1) => {
    const j = index + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[index], next[j]] = [next[j]!, next[index]!];
    void apply(next, `Moved “${name}” ${d < 0 ? "up" : "down"} (edit mode)`);
  };
  const pending = ctx.pendingInsert;
  const before = pending && pending.at === index ? <AddingPlaceholder label={pending.label} /> : null;
  const after = pending && pending.at >= list.length && index === list.length - 1 ? <AddingPlaceholder label={pending.label} /> : null;
  return (
    <>
    {before}
    <div data-cg-section={id} style={css ?? undefined} data-cg-edit="" data-cg-open={ctx.editing === s.key || ctx.live?.at === designAt ? "" : undefined} data-cg-key={s.key} data-cg-targets={s.id && !s.reusableBlockId ? JSON.stringify([{ kind: "block", id: s.id, section: s.type, title: name }]) : undefined}>
      <div data-cg-tab className={TAB} onClick={(e) => e.stopPropagation()}>
        <span className={TAB_NAME}>{name}</span>
        <button type="button" className={TAB_BTN} title="Edit" aria-label={`Edit ${name}`} disabled={busy} onClick={() => edit(s.key)}><Pencil className="h-4 w-4" /></button>
        <button type="button" className={TAB_BTN} title="Wording & design (colours, fonts)" aria-label={`Wording and design of ${name}`} disabled={busy} onClick={(e) => ctx.openLive(withDiscovery([], (e.currentTarget as Element).closest("[data-cg-section]"), design, ctx.canTarget), designAt)}><Palette className="h-4 w-4" /></button>
        <button type="button" className={TAB_BTN} title="Move up" aria-label="Move up" disabled={busy || index === 0} onClick={() => move(-1)}><ArrowUp className="h-4 w-4" /></button>
        <button type="button" className={TAB_BTN} title="Move down" aria-label="Move down" disabled={busy || index === list.length - 1} onClick={() => move(1)}><ArrowDown className="h-4 w-4" /></button>
        <button type="button" className={TAB_BTN} title={s.reusableBlockId ? "Reusable blocks can't be copied — edit them in Admin › Reusable blocks" : "Copy — then paste it into a Free layout (on this or another page) to edit it there"} aria-label={`Copy ${name}`} disabled={busy || Boolean(s.reusableBlockId)} onClick={() => ctx.copySection({ blockType: s.type, label: name, data: structuredClone(s.data) })}><ClipboardCopy className="h-4 w-4" /></button>
        <button type="button" className={TAB_BTN} title={s.reusableBlockId ? "Reusable blocks can't be saved as templates" : "Save as template (reuse it on any page)"} aria-label={`Save ${name} as a template`} disabled={busy || Boolean(s.reusableBlockId)} onClick={() => ctx.saveTemplate("section", { blockType: s.type, label: name, data: s.data }, name)}><BookmarkPlus className="h-4 w-4" /></button>
        <button type="button" className={TAB_BTN} title="Duplicate (opens an unsaved copy below to check before saving)" aria-label="Duplicate" disabled={busy} onClick={() => edit(`copy:${s.key}`)}><Copy className="h-4 w-4" /></button>
        <button type="button" className={TAB_BTN} title="Hide (show it again from the Hidden list)" aria-label="Hide" disabled={busy} onClick={() => void apply(list.map((x) => (x.key === s.key ? { ...x, isEnabled: false } : x)), `Hid “${name}” (edit mode)`)}><EyeOff className="h-4 w-4" /></button>
        {(info.canDeleteSections !== false || !info.sections.some((x) => x.key === s.key && x.id && !x.id.startsWith("d"))) && <button type="button" className={cn(TAB_BTN, "hover:bg-danger")} title="Delete" aria-label="Delete" disabled={busy} onClick={() => edit(`delete:${s.key}`)}><Trash2 className="h-4 w-4" /></button>}
        <button type="button" className={TAB_BTN} title="Add a section below" aria-label="Add a section below" disabled={busy} onClick={() => addAt(index + 1)}><Plus className="h-4 w-4" /></button>
      </div>
      {children}
      {ctx.editing === `copy:${s.key}` && !ctx.docked && info.page && (
        <div data-cg-open="" className="relative px-3 py-4 outline-dashed outline-2 -outline-offset-2 outline-[#2563eb]">
          <EditTools info={{ ...info, page: info.page }} busy={busy} editingKey={`copy:${s.key}`} addingAt={null} onClose={ctx.closePanels} apply={apply} onDirty={ctx.onDirty} />
        </div>
      )}
    </div>
    {after}
    </>
  );
}

/**
 * Put on a website page to add its own buttons to the edit bar (e.g. "Edit product"), each opening
 * that admin screen in the side panel. Renders nothing.
 */
export function PageEditActions({ actions, layout }: { actions: EditAction[]; layout?: EditLayout }) {
  const ctx = useContext(EditCtx);
  const key = JSON.stringify(actions);
  const layoutKey = JSON.stringify(layout ?? null);
  useEffect(() => {
    ctx?.setPageActions(actions);
    return () => ctx?.setPageActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-register when the actions change
  }, [key]);
  useEffect(() => {
    ctx?.setLayout(layout ?? null);
    return () => ctx?.setLayout(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-register when the layout changes
  }, [layoutKey]);
  return null;
}

/** Moves a section up/down among the visible sections of its own area (zone). */
export function moveLayoutItem(items: EditLayoutItem[], id: string, dir: -1 | 1): EditLayoutItem[] | null {
  const i = items.findIndex((x) => x.id === id);
  const me = items[i];
  if (!me?.movable) return null;
  let j = i + dir;
  while (j >= 0 && j < items.length && (items[j]!.zone !== me.zone || !items[j]!.visible)) j += dir;
  if (j < 0 || j >= items.length || items[j]!.zone !== me.zone) return null;
  const next = [...items];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** The edit bar's layout menu: every section of this page type, by area, with show/hide and order. */
function LayoutMenu({ layout, busy, save, onClose }: { layout: EditLayout; busy: boolean; save: (items: EditLayoutItem[], message: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as Element).closest?.("[aria-expanded]")) onClose(); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [onClose]);
  const zones = [...new Map(layout.items.map((i) => [i.zone, i.zoneLabel])).entries()];
  const iconBtn = "grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink disabled:opacity-30";
  return (
    <div ref={ref} className="absolute bottom-full left-0 mb-2 max-h-[70vh] w-[22rem] overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-lg">
      <p className="px-2 pb-2 text-xs text-muted">Applies to every {layout.title.toLowerCase()}, not just this one.</p>
      {zones.map(([zone, zoneLabel]) => (
        <div key={zone} className="mb-1">
          {zones.length > 1 && <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">{zoneLabel}</p>}
          {layout.items.filter((i) => i.zone === zone).map((it) => (
            <div key={it.id} className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-bg/60">
              <span className={cn("min-w-0 flex-1 truncate text-sm", it.visible ? "text-ink" : "text-muted line-through")}>{it.label}</span>
              {it.movable && it.visible && (
                <>
                  <button type="button" className={iconBtn} title="Move up" aria-label={`Move ${it.label} up`} disabled={busy || !moveLayoutItem(layout.items, it.id, -1)} onClick={() => save(moveLayoutItem(layout.items, it.id, -1)!, `Moved “${it.label}” up`)}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" className={iconBtn} title="Move down" aria-label={`Move ${it.label} down`} disabled={busy || !moveLayoutItem(layout.items, it.id, 1)} onClick={() => save(moveLayoutItem(layout.items, it.id, 1)!, `Moved “${it.label}” down`)}><ArrowDown className="h-3.5 w-3.5" /></button>
                </>
              )}
              {it.required ? (
                <span className="px-1 text-[11px] text-muted">Always shown</span>
              ) : (
                <button type="button" className={iconBtn} title={it.visible ? "Hide" : "Show"} aria-label={`${it.visible ? "Hide" : "Show"} ${it.label}`} disabled={busy} onClick={() => save(layout.items.map((x) => (x.id === it.id ? { ...x, visible: !x.visible } : x)), `${it.visible ? "Hid" : "Showed"} “${it.label}”`)}>
                  {it.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Move up / down and Hide on a section of a product, category… page (shared layout of that page type). */
function LayoutButtons({ id }: { id?: string }) {
  const ctx = useContext(EditCtx);
  const l = ctx?.layout;
  const it = id ? l?.items.find((x) => x.id === id) : undefined;
  if (!ctx || !l || !it) return null;
  const note = `Applies to every ${l.title.toLowerCase()}`;
  const up = moveLayoutItem(l.items, it.id, -1);
  const down = moveLayoutItem(l.items, it.id, 1);
  return (
    <>
      {it.movable && (
        <>
          <button type="button" className={TAB_BTN} title={`Move up (${note})`} aria-label="Move up" disabled={ctx.busy || !up} onClick={() => up && ctx.saveLayout(up, `Moved “${it.label}” up`)}><ArrowUp className="h-4 w-4" /></button>
          <button type="button" className={TAB_BTN} title={`Move down (${note})`} aria-label="Move down" disabled={ctx.busy || !down} onClick={() => down && ctx.saveLayout(down, `Moved “${it.label}” down`)}><ArrowDown className="h-4 w-4" /></button>
        </>
      )}
      {!it.required && (
        <button type="button" className={TAB_BTN} title={`Hide (${note}; show it again from the layout menu in the edit bar)`} aria-label="Hide" disabled={ctx.busy} onClick={() => ctx.saveLayout(l.items.map((x) => (x.id === it.id ? { ...x, visible: false } : x)), `Hid “${it.label}”`)}><EyeOff className="h-4 w-4" /></button>
      )}
    </>
  );
}

/**
 * Wraps one part of a website page (a product's pricing, a category's FAQs, the footer…). In edit
 * mode it gets an outline and buttons that open the admin screens where that part is edited.
 * Outside edit mode it adds no markup at all.
 */
export function EditRegion({ label, actions, live, layoutId, children }: { label: string; actions: EditAction[]; live?: LiveTarget | LiveTarget[] | null; /** This part is a section of the page type's layout (move / hide it). */ layoutId?: string; children: ReactNode }) {
  const ctx = useContext(EditCtx);
  const styles = useContext(StylesCtx);
  // Its Design (Design tab) is shared by every page showing this part, e.g. "Pricing plans" on all products.
  const design = styleKey(label, (Array.isArray(live) ? live : live ? [live] : []).map((t) => `${t.kind}.${t.section}`));
  const css = regionStyleCss(styles[design]);
  if (!ctx?.on) return <Styled css={css}>{children}</Styled>;
  // Only what this person's role can change: no outline at all when that's nothing.
  live = (Array.isArray(live) ? live : live ? [live] : []).filter(ctx.canTarget);
  actions = actions.filter((a) => ctx.canHref(a.href));
  // Everything in this part that can be edited right here opens together (one tab each): its own
  // fields, its wording, button labels… Admin-only screens stay as extra buttons.
  const targets: LiveTarget[] = [
    ...(Array.isArray(live) ? live : live ? [live] : []),
    ...actions.flatMap((a) => {
      const t = liveFromHref(a.href);
      return t ? [{ ...t, title: a.label }] : [];
    }),
  ].filter((t, i, all) => all.findIndex((x) => x.kind === t.kind && x.id === t.id && x.section === t.section) === i);
  const adminActions = actions.filter((a) => !liveFromHref(a.href));
  // Wording and design can be edited for any part (when the role allows), even one with only admin screens.
  const editable = targets.length > 0 || ctx.canTarget({ kind: "texts", id: "*", section: "texts" }) || ctx.canTarget({ kind: "style", id: design, section: "all" });
  const primary: (EditAction & { targets?: LiveTarget[] }) | undefined = editable ? { label: "Edit", href: "#live", targets } : adminActions[0];
  const rest = editable ? adminActions : adminActions.slice(1);
  if (!primary) return <Styled css={css}>{children}</Styled>;
  if (targets[0] && !targets[0].title) targets[0] = { ...targets[0], title: label };
  const at = `reg:${label}|${targets.map((t) => `${t.kind}.${t.id}.${t.section}`).join(",")}`;
  const isOpen = ctx.live?.at === at || ctx.panel?.at === at;
  if (isOpen && !ctx.docked) {
    return (
      <div data-cg-region data-cg-edit="" data-cg-open="" className="px-3 py-4" style={css ?? undefined}>
        {ctx.live?.at === at ? (
          <LivePanel key={at} targets={ctx.live.what} onClose={ctx.closePanels} onDirty={ctx.onDirty} onSaved={ctx.onLiveSaved} />
        ) : (
          <AdminPanel title={ctx.panel!.what.label} href={ctx.panel!.what.href} onClose={ctx.closePanels} />
        )}
      </div>
    );
  }
  return (
    <div data-cg-region data-cg-edit="" data-cg-targets={JSON.stringify(targets)} data-cg-at={at} data-cg-style-key={design} data-cg-open={isOpen ? "" : undefined} style={css ?? undefined}>
      <div data-cg-tab className={TAB}>
        <span className={TAB_NAME}>{label}</span>
        <button type="button" onClick={(e) => (primary.targets ? ctx.openLive(withDiscovery(primary.targets, (e.currentTarget as Element).closest("[data-cg-region]"), design, ctx.canTarget), at) : ctx.open(primary, at))} className="inline-flex h-7 items-center gap-1 rounded-full bg-white/20 px-2.5 text-xs font-semibold hover:bg-white/30">
          <Pencil className="h-3.5 w-3.5" aria-hidden /> {primary.targets ? "Edit" : primary.label}
        </button>
        <LayoutButtons id={layoutId} />
        <TabMore actions={rest} onPick={(a) => ctx.open(a, at)} />
      </div>
      {children}
    </div>
  );
}
