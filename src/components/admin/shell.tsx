"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, CircleHelp, ExternalLink, FileText, Globe, LogOut, Menu as MenuIcon, PanelLeftClose, PanelLeftOpen, Plus, Search, Sun, Moon, UserRound, X } from "lucide-react";
import type { GuideHit } from "@/lib/editing-guide";
import { helpFor } from "@/lib/admin-help";
import { ADMIN_ICONS } from "./icons";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { flattenNav, type AdminNavGroup, type AdminNavItem } from "./nav";
import { NotificationsBell } from "@/components/notifications/bell";

export interface CreateItem {
  label: string;
  href: string;
  icon: string;
}

interface ShellProps {
  groups: AdminNavGroup[];
  createItems: CreateItem[];
  /** Shown in a rounded tile: the logo, falling back to the favicon (iconUrl). */
  site: { name: string; logoUrl: string | null; iconUrl?: string | null; /** Website theme colours tag: the logo follows them (lib/brand-logo.ts). */ brandTag?: string | null };
  /** Lets the user change the company name and logo from the sidebar (needs settings.manage). */
  user: { name: string; email: string; role: string; avatarUrl: string | null };
  initialCollapsed: boolean;
  /** Pending vendor approval requests (only for users who can approve). */
  /** Things waiting for this person (vendor approval requests, reviews to moderate…), shown on the bell. */
  notifications?: { count: number; items: { id: string; title: string; meta: string; href: string; createdAt: string }[]; links: { label: string; href: string; count: number }[] } | null;
  /** Saved light/dark choice (cookie), so the first render already matches. */
  initialTheme?: "light" | "dark";
  signOut: () => Promise<void>;
  /** Defaults suit the staff admin; the vendor portal overrides them. */
  homeHref?: string;
  workspaceLabel?: string;
  accountHref?: string | null;
  /** Shown inside the website's edit-mode side panel: just the page, no sidebar or top bar. */
  embedded?: boolean;
  /** Editing guide rows for the "Where do I change…?" search (admin only). */
  guide?: GuideHit[];
  children: React.ReactNode;
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

/** Closes a popover on outside click and Escape. */
function useDismiss<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

type FlatEntry = ReturnType<typeof flattenNav>[number];

/** Picks the nav href that best matches the current URL: longest path wins, and a link with a query (?tab=theme) wins only when that query matches. */
function useActiveHref(entries: { href: string }[], homeHref: string) {
  const pathname = usePathname();
  const search = useSearchParams();
  return useMemo(() => {
    let best: string | undefined;
    let bestScore = -1;
    for (const { href } of entries) {
      const [path = "", query] = href.split("?");
      const pathOk = path === homeHref ? pathname === homeHref : pathname === path || pathname.startsWith(`${path}/`);
      if (!pathOk) continue;
      let score = path.length;
      if (query) {
        const want = new URLSearchParams(query);
        if ([...want.entries()].some(([k, v]) => search.get(k) !== v)) continue;
        score += 1000;
      }
      if (score > bestScore) [best, bestScore] = [href, score];
    }
    return best;
  }, [entries, pathname, search, homeHref]);
}

/** Breadcrumb in the top bar: "Admin › Content › Blog" (plus "› Edit"/"› New" a step deeper). */
function PageTrail({ entries, activeHref, homeHref, site, workspaceLabel }: { entries: FlatEntry[]; activeHref?: string; homeHref: string; site: ShellProps["site"]; workspaceLabel: string }) {
  const pathname = usePathname();
  const entry = entries.find((e) => e.href === activeHref);
  const root = homeHref === "/vendor" ? "Vendor portal" : homeHref === "/account" ? "My account" : "Admin";
  if (!entry) return null;
  const base = entry.href.split("?")[0] ?? "";
  const rest = pathname.length > base.length && pathname.startsWith(`${base}/`) ? pathname.slice(base.length + 1).split("/").filter(Boolean) : [];
  const last = rest[rest.length - 1];
  const step = !last ? null : last === "new" ? "New" : last === "edit" || /^c[a-z0-9]{20,30}$/.test(last) ? "Edit" : last.replace(/[-_]/g, " ").replace(/^./, (c) => c.toUpperCase());
  const isHome = base === homeHref && !step;
  const section = isHome ? null : entry.parent && entry.parent !== entry.label ? entry.parent : entry.group && entry.group !== "Overview" ? entry.group : null;
  // Dashboard: company name and workspace label instead of a one-word breadcrumb.
  if (isHome) {
    return (
      <Link href={homeHref} className="hidden min-w-0 items-center gap-2 whitespace-nowrap pl-1.5 text-[13px] lg:flex" aria-label={`${site.name} ${workspaceLabel}`}>
        <span className="truncate font-semibold text-ink">{site.name}</span>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted/70" aria-hidden />
        <span className="truncate text-muted">{workspaceLabel}</span>
      </Link>
    );
  }
  const crumbs: { label: string; href?: string }[] = [
    { label: root, href: isHome ? undefined : homeHref },
    ...(section ? [{ label: section }] : []),
    ...(isHome ? [] : [{ label: entry.label, href: step ? entry.href : undefined }]),
    ...(step ? [{ label: step }] : []),
  ];
  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 pl-1.5 lg:block">
      <ol className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[13px]">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className={cn("flex items-center gap-2", isLast ? "min-w-0" : "shrink-0")}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted/70" aria-hidden />}
              {isLast ? (
                <span className="truncate font-semibold text-ink" aria-current="page">{c.label}</span>
              ) : c.href ? (
                <Link href={c.href} className="font-medium text-muted transition-colors hover:text-ink">{c.label}</Link>
              ) : (
                <span className="font-medium text-muted">{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AdminShell(props: ShellProps) {
  // Inside the website's edit panel (an iframe): only the page itself. Stays embedded after refreshes.
  const [embedded, setEmbedded] = useState(Boolean(props.embedded));
  useEffect(() => {
    if (window.self !== window.top) setEmbedded(true);
  }, []);
  if (embedded) return <EmbeddedAdmin theme={props.initialTheme ?? "light"}>{props.children}</EmbeddedAdmin>;
  return <FullShell {...props} />;
}

const EMBED_CSS = `
[data-admin-embed] .sticky.top-14,[data-admin-embed] .sticky.top-16{top:0}[data-admin-embed] .sticky.top-20{top:1rem}
@media (min-width:1280px){[data-admin-embed] .xl\\:sticky.xl\\:top-20{top:1rem}}
`;

/** Admin page inside the website's edit panel: links stay in the panel, and the website refreshes after saves. */
function EmbeddedAdmin({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.("a");
      if (!a || a.target === "_blank") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/admin")) {
        // Website links leave the panel and open in the main window.
        e.preventDefault();
        window.top?.location.assign(url.href);
        return;
      }
      if (url.searchParams.get("embed") !== "1") {
        url.searchParams.set("embed", "1");
        a.href = url.pathname + url.search + url.hash;
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return (
    <div data-admin-theme={theme} data-admin-embed="" className="min-h-screen bg-bg text-ink">
      {/* No admin top bar in here: bars that stick below it (top-14 / top-20) stick to the top of the panel instead. */}
      <style>{EMBED_CSS}</style>
      <main className="px-4 pb-10 pt-4 sm:px-5">{children}</main>
    </div>
  );
}

/** "?" in the top bar: what this page is for, where its changes show on the website, and the Editing guide. */
function PageHelp({ guideHref }: { guideHref: string | null }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  useEffect(() => setOpen(false), [pathname]);
  const help = helpFor(pathname, search.toString());
  if (!help) return null;
  return (
    <div ref={ref} className="relative hidden sm:block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="What is this page for?" aria-label="What is this page for?" className="grid h-8 w-8 place-items-center rounded-control text-ink/70 hover:bg-bg hover:text-ink">
        <CircleHelp className="h-[18px] w-[18px]" />
      </button>
      {open && (
        <div role="dialog" aria-label="About this page" className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-line bg-surface p-4 text-sm shadow-[0_24px_60px_-20px_rgb(var(--color-ink)/0.4)]">
          <p className="font-semibold text-ink">What is this page for?</p>
          <p className="mt-1 text-muted">{help.what}</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {help.site && (
              <a href={help.site} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 font-semibold text-[#0F766E] hover:underline dark:text-teal-300">
                <ExternalLink className="h-4 w-4" aria-hidden />See it on the website{help.siteLabel ? ` (${help.siteLabel})` : ""}
              </a>
            )}
            {guideHref && (
              <Link href={guideHref} onClick={close} className="inline-flex items-center gap-1.5 font-semibold text-[#0F766E] hover:underline dark:text-teal-300">
                <BookOpen className="h-4 w-4" aria-hidden />Where is everything edited? (Editing guide)
              </Link>
            )}
          </div>
          <p className="mt-3 border-t border-line pt-2 text-xs text-muted">Tip: press Ctrl K and type what you want to change, e.g. “logo” or “footer”.</p>
        </div>
      )}
    </div>
  );
}

function FullShell({ groups, createItems, site, user, notifications = null, initialCollapsed, initialTheme = "light", signOut, homeHref = "/admin", workspaceLabel = "Admin workspace", accountHref = "/admin/account", guide = [], children }: ShellProps) {
  // Staff signed in before the website's edit mode existed: let the website show its "Edit this page" button.
  useEffect(() => {
    if (homeHref === "/admin" && !/(?:^|;\s*)cg_staff=1/.test(document.cookie)) document.cookie = `cg_staff=1; path=/; max-age=${60 * 60 * 24 * 14}; samesite=lax`;
  }, [homeHref]);
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  const chooseTheme = (t: "light" | "dark") => {
    setTheme(t);
    document.cookie = `admin_theme=${t}; path=/; max-age=31536000; samesite=lax`;
  };

  const allItems = useMemo(() => flattenNav(groups), [groups]);
  const activeHref = useActiveHref(allItems, homeHref);
  const byHref = useMemo(() => new Map(allItems.map((e) => [e.href, e])), [allItems]);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      document.cookie = `admin_sidebar=${c ? "open" : "collapsed"}; path=/; max-age=31536000; samesite=lax`;
      return !c;
    });
  };

  return (
    <div className="admin-canvas min-h-screen" data-admin-theme={theme}>
      <Sidebar
        groups={groups}
        activeHref={activeHref}
        site={site}
        homeHref={homeHref}
        workspaceLabel={workspaceLabel}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onToggleCollapsed={toggleCollapsed}
      />
      {mobileOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} />}

      <div className={cn("min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[6.25rem]" : "lg:pl-[17rem]")}>
        <div className="sticky top-0 z-30 bg-bg/80 px-3 pt-3 backdrop-blur-md sm:px-5 lg:pl-0 lg:pr-5">
          <header className="flex h-14 items-center gap-2 rounded-2xl border border-line/70 bg-surface px-2.5 shadow-[0_1px_2px_rgb(16_24_40/0.04)] sm:gap-2.5 sm:px-3">
            <button type="button" onClick={() => setMobileOpen(true)} className="grid h-8 w-8 place-items-center rounded-control text-ink hover:bg-bg lg:hidden" aria-label="Open navigation">
              <MenuIcon className="h-5 w-5" />
            </button>
            <PageTrail entries={allItems} activeHref={activeHref} homeHref={homeHref} site={site} workspaceLabel={workspaceLabel} />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-control border border-line bg-bg/70 pl-3 pr-1 text-left text-sm text-muted transition hover:border-ink/20 sm:max-w-[18rem] lg:ml-auto"
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{guide.length ? "Search, or “where do I change…?”" : "Search or jump to…"}</span>
              <kbd className="hidden rounded bg-line/80 px-1.5 py-px font-sans text-[11px] font-medium text-muted sm:inline">Ctrl K</kbd>
            </button>
            {homeHref === "/admin" && <PageHelp guideHref={byHref.has("/admin/guide") ? "/admin/guide" : null} />}
            {createItems.length > 0 && <CreateMenu items={createItems} />}
            <ThemeToggle value={theme} onChange={chooseTheme} />
            <NotificationsBell waiting={notifications} settingsHref={`${homeHref}/notifications`} />
            <Link href="/" target="_blank" className="hidden h-8 w-8 place-items-center rounded-control text-ink/70 hover:bg-bg hover:text-ink sm:grid" title="View website" aria-label="View website (opens in a new tab)">
              <ExternalLink className="h-[18px] w-[18px]" />
            </Link>
            <UserMenu user={user} signOut={signOut} accountHref={accountHref} />
          </header>
        </div>
        <main className="px-3 pb-12 pt-5 sm:px-5 lg:pl-0 lg:pr-5">
          <div className="mx-auto max-w-[96rem]">{children}</div>
        </main>
      </div>

      {paletteOpen && <CommandPalette items={allItems} createItems={createItems} guide={guide} onClose={() => setPaletteOpen(false)} recordSearch={homeHref === "/admin"} siteName={site.name} />}
    </div>
  );
}

/** Sun / moon segmented switch for the admin colour theme. */
function ThemeToggle({ value, onChange }: { value: "light" | "dark"; onChange: (t: "light" | "dark") => void }) {
  const opts = [
    { key: "light" as const, label: "Light theme", Icon: Sun },
    { key: "dark" as const, label: "Dark theme", Icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label="Colour theme" className="hidden items-center rounded-lg bg-bg p-0.5 ring-1 ring-line sm:inline-flex">
      {opts.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          title={label}
          aria-label={label}
          onClick={() => onChange(key)}
          className={cn("grid h-7 w-7 place-items-center rounded-md transition-colors", value === key ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.15)]" : "text-muted hover:text-ink")}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}

/**
 * Sidebar brand: the Cadgram logo, with a light and a dark version that follow the admin theme.
 * (The logo uploaded in Website settings is the public website's logo.)
 */
const DARK_ONLY = "hidden dark:block";
const LIGHT_ONLY = "dark:hidden";

/** The built-in logo files, in the website theme's colours when the admin follows them. */
const brandSrc = (file: string, tag?: string | null) => (tag ? `/brand/themed/${tag}/${file}` : `/brand/${file}`);

function SiteLogo({ site }: { site: ShellProps["site"] }) {
  return (
    <span className="flex min-w-0 items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo */}
      <img src={brandSrc("cadgram-logo.svg", site.brandTag)} alt={site.name} className={cn("h-9 w-auto max-w-full", LIGHT_ONLY)} />
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo */}
      <img src={brandSrc("cadgram-logo-dark.svg", site.brandTag)} alt={site.name} className={cn("h-9 w-auto max-w-full", DARK_ONLY)} />
    </span>
  );
}

/** Square brand tile (collapsed sidebar): the Cadgram icon, light or dark. */
function SiteMark({ className = "h-10 w-10", tag }: { className?: string; tag?: string | null }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG icon */}
      <img src={brandSrc("cadgram-icon.svg", tag)} alt="" className={cn(className, "shrink-0", LIGHT_ONLY)} />
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG icon */}
      <img src={brandSrc("cadgram-icon-dark.svg", tag)} alt="" className={cn(className, "shrink-0", DARK_ONLY)} />
    </>
  );
}

/** Active marker: a short brand-colour bar on the item's left edge. */
const ActiveBar = () => <span aria-hidden className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />;

const FOLD_KEY = "admin_nav_sections";

function Sidebar({
  groups, activeHref, site, homeHref, workspaceLabel, collapsed, mobileOpen, onCloseMobile, onToggleCollapsed,
}: {
  groups: AdminNavGroup[];
  activeHref: string | undefined;
  site: ShellProps["site"];
  homeHref: string;
  workspaceLabel: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapsed: () => void;
}) {
  // Parents start open when they hold the current page; the rest stay as the user left them.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const holdsActive = (item: AdminNavItem) => Boolean(item.children?.some((c) => c.href === activeHref));
  const isOpen = (item: AdminNavItem) => toggled[item.label] ?? holdsActive(item);
  const toggle = (item: AdminNavItem) => setToggled((t) => ({ ...t, [item.label]: !isOpen(item) }));
  // The mobile drawer always shows labels.
  const rail = collapsed && !mobileOpen;

  // Section headings fold. Folded/unfolded choices are remembered in this browser; the section holding the
  // current page always opens by itself.
  const [sections, setSections] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${FOLD_KEY}:${workspaceLabel}`) ?? "{}") as Record<string, boolean>;
      if (saved && typeof saved === "object") setSections(saved);
    } catch {
      /* storage unavailable: everything starts with defaults */
    }
  }, [workspaceLabel]);
  const groupHoldsActive = (g: AdminNavGroup) => g.items.some((i) => i.href === activeHref || holdsActive(i));
  useEffect(() => {
    const g = groups.find(groupHoldsActive);
    if (g?.label) setSections((s) => (s[g.label] === false ? { ...s, [g.label]: true } : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- when the page changes
  }, [activeHref]);
  // Short menus (the portals) start fully open; the long admin menu starts with only the current section open.
  const manySections = groups.filter((g) => g.label).length > 4;
  const sectionOpen = (g: AdminNavGroup) => !g.label || rail || (sections[g.label] ?? (!manySections || groupHoldsActive(g)));
  const toggleSection = (g: AdminNavGroup) =>
    setSections((s) => {
      const next = { ...s, [g.label]: !sectionOpen(g) };
      try {
        localStorage.setItem(`${FOLD_KEY}:${workspaceLabel}`, JSON.stringify(next));
      } catch {
        /* not remembered */
      }
      return next;
    });
  const waiting = (g: AdminNavGroup) => g.items.reduce((n, i) => n + (i.badge ?? 0) + (i.children ?? []).reduce((m, c) => m + (c.badge ?? 0), 0), 0);

  const rowBase = cn("group relative flex w-full items-center gap-3 rounded-xl text-sm transition-colors", rail ? "h-10 justify-center" : "h-10 px-2.5");
  const rowState = (active: boolean) => (active ? "bg-surface font-semibold text-ink shadow-[0_1px_3px_rgb(16_24_40/0.08)] ring-1 ring-line" : "text-ink/80 hover:bg-surface/70 hover:text-ink");

  return (
    <aside
      className={cn(
        "fixed bottom-3 left-3 top-3 z-50 flex flex-col overflow-hidden rounded-[20px] border border-line/70 bg-sidebar shadow-[0_1px_2px_rgb(16_24_40/0.04),0_8px_24px_-12px_rgb(16_24_40/0.12)] transition-[width,transform] duration-200",
        rail ? "lg:w-[4.25rem]" : "lg:w-[15rem]",
        "w-[15rem]",
        mobileOpen ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0",
      )}
    >
      <div className={cn("flex h-16 shrink-0 items-center border-b border-line/70", rail ? "justify-center px-2" : "gap-2.5 px-3")}>
        {!rail && (
          <Link href={homeHref} className="flex min-w-0 flex-1 items-center gap-2.5" aria-label={`${site.name} ${workspaceLabel} home`}>
            <SiteLogo site={site} />
          </Link>
        )}
        {rail && (
          <button type="button" onClick={onToggleCollapsed} title="Expand sidebar" aria-label="Expand sidebar" className="group relative hidden h-10 w-10 place-items-center rounded-xl lg:grid">
            <span className="grid place-items-center transition-opacity group-hover:opacity-0"><SiteMark tag={site.brandTag} /></span>
            <span className="absolute inset-0 grid place-items-center rounded-xl bg-mint-soft text-mint-ink opacity-0 ring-1 ring-line transition-opacity group-hover:opacity-100" aria-hidden><PanelLeftOpen className="h-[18px] w-[18px]" /></span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          title={rail ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
          className={cn("hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-mint-soft/60 text-ink/70 ring-1 ring-line transition hover:bg-mint-soft hover:text-mint-ink", !rail && "lg:grid")}
        >
          {rail ? <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden /> : <PanelLeftClose className="h-[18px] w-[18px]" aria-hidden />}
        </button>
        <button type="button" onClick={onCloseMobile} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-bg lg:hidden" aria-label="Close navigation">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label={workspaceLabel} className={cn("show-scrollbar flex-1 overflow-y-auto py-3", rail ? "px-2" : "px-2.5")}>
        {groups.map((g, gi) => (
          <div key={g.label || gi} className={cn(gi > 0 && (rail ? "mt-3 border-t border-line pt-3" : "mt-4"))}>
            {g.label && !rail && (
              // Section heading: a chevron and the name, teal while open and grey while closed. The links of an open
              // section sit on a teal rail below it, so headings never look like menu links.
              <button
                type="button"
                onClick={() => toggleSection(g)}
                aria-expanded={sectionOpen(g)}
                title={sectionOpen(g) ? `Hide ${g.label}` : `Show ${g.label}`}
                className={cn(
                  "mb-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm font-normal transition-colors hover:bg-surface/60",
                  sectionOpen(g) ? "text-[#0F766E] dark:text-teal-300" : "text-ink/80 hover:text-ink",
                )}
              >
                {sectionOpen(g) ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
                <span className="flex-1 truncate">{g.label}</span>
                {!sectionOpen(g) && (
                  waiting(g) > 0 ? (
                    <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold leading-[18px] text-primary-fg" aria-label={`${waiting(g)} waiting`}>
                      {waiting(g) > 99 ? "99+" : waiting(g)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-normal text-muted">{g.items.length}</span>
                  )
                )}
              </button>
            )}
            {sectionOpen(g) && <ul className={cn("space-y-1", g.label && !rail && "ml-[13px] border-l-2 border-[#0F766E]/35 pl-1.5 dark:border-teal-300/35")}>
              {g.items.map((item) => {
                const Icon = ADMIN_ICONS[item.icon] ?? FileText;
                const icon = <Icon className="h-[18px] w-[18px] shrink-0 text-ink/70 group-hover:text-ink" aria-hidden />;

                if (!item.children) {
                  const active = item.href === activeHref;
                  return (
                    <li key={item.label}>
                      <Link href={item.href!} aria-current={active ? "page" : undefined} title={rail ? item.label : undefined} className={cn(rowBase, rowState(active))}>
                        {active && <ActiveBar />}
                        {icon}
                        {rail ? <span className="sr-only">{item.label}</span> : <span className="flex-1 truncate">{item.label}</span>}
                        {item.badge ? (
                          <span className={cn("grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-5 text-primary-fg", rail && "absolute right-1 top-1 min-w-4 px-1 text-[10px] leading-4")} aria-label={`${item.badge} pending`}>
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                }

                const containsActive = holdsActive(item);
                // Collapsed rail: the parent icon opens its first page.
                if (rail) {
                  return (
                    <li key={item.label}>
                      <Link href={item.children[0]!.href} title={item.label} className={cn(rowBase, rowState(containsActive))}>
                        {containsActive && <ActiveBar />}
                        {icon}
                        <span className="sr-only">{item.label}</span>
                      </Link>
                    </li>
                  );
                }
                const open = isOpen(item);
                return (
                  <li key={item.label}>
                    <button type="button" onClick={() => toggle(item)} aria-expanded={open} className={cn(rowBase, containsActive && !open ? rowState(true) : open ? "text-[#0F766E] hover:bg-surface/70 dark:text-teal-300 [&_svg]:!text-[#0F766E] dark:[&_svg]:!text-teal-300" : "text-ink/80 hover:bg-surface/70 hover:text-ink")}>
                      {containsActive && !open && <ActiveBar />}
                      {icon}
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {!open && item.children.some((c) => c.badge) && (
                        <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-5 text-primary-fg" aria-label="Items waiting">
                          {item.children.reduce((n, c) => n + (c.badge ?? 0), 0)}
                        </span>
                      )}
                      <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
                    </button>
                    {open && (
                      <ul className="mb-2 ml-[1.15rem] mt-0.5 space-y-0.5 border-l border-line pl-2.5">
                        {item.children.map((c) => {
                          const active = c.href === activeHref;
                          return (
                            <li key={c.href} className="relative">
                              {active && <span aria-hidden className="absolute -left-[11.5px] top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full bg-primary" />}
                              <Link
                                href={c.href}
                                aria-current={active ? "page" : undefined}
                                className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors", active ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_rgb(16_24_40/0.06)] ring-1 ring-line" : "text-ink/65 hover:bg-surface/70 hover:text-ink")}
                              >
                                <span className="flex-1 truncate">{c.label}</span>
                                {c.badge ? (
                                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold leading-5 text-primary-fg" aria-label={`${c.badge} waiting`}>
                                    {c.badge > 99 ? "99+" : c.badge}
                                  </span>
                                ) : null}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>}
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-line/70 py-2.5", rail ? "px-2" : "px-2.5")}>
        <Link href="/" target="_blank" title={rail ? "View website" : undefined} className={cn(rowBase, "text-ink/80 hover:bg-surface/70 hover:text-ink")}>
          <Globe className="h-[18px] w-[18px] shrink-0 text-ink/70" aria-hidden />
          {rail ? <span className="sr-only">View website</span> : <span className="flex-1">View website</span>}
          {!rail && <ExternalLink className="h-4 w-4 text-muted" aria-hidden />}
        </Link>
      </div>
    </aside>
  );
}


function CreateMenu({ items }: { items: CreateItem[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1.5 rounded-control bg-action px-3 text-sm font-semibold text-action-fg transition hover:bg-action/90"
      >
        <Plus className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Create</span>
        <ChevronDown className={cn("hidden h-4 w-4 transition-transform sm:block", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_24px_60px_-20px_rgb(var(--color-ink)/0.4)]">
          {items.map((it) => {
            const Icon = ADMIN_ICONS[it.icon] ?? FileText;
            return (
              <Link key={it.href} role="menuitem" href={it.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-bg">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-ink/80">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                {it.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Avatar({ user, size = 34 }: { user: ShellProps["user"]; size?: number }) {
  return user.avatarUrl ? (
    <Image src={user.avatarUrl} alt="" width={size} height={size} unoptimized className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-white" style={{ width: size, height: size }} aria-hidden>
      {initials(user.name)}
    </span>
  );
}

function UserMenu({ user, signOut, accountHref }: { user: ShellProps["user"]; signOut: () => Promise<void>; accountHref: string | null }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useDismiss<HTMLDivElement>(open, close);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-lg p-1 pr-1.5 hover:bg-bg sm:ml-1 sm:pr-2">
        <Avatar user={user} />
        <span className="hidden min-w-0 text-left leading-tight md:block">
          <span className="block max-w-[11rem] truncate text-sm font-semibold text-ink">{user.name}</span>
          <span className="block text-xs text-muted">{user.role}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-muted md:block" aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_24px_60px_-20px_rgb(var(--color-ink)/0.4)]">
          <div className="flex items-center gap-3 rounded-xl bg-bg px-3 py-3">
            <Avatar user={user} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-muted">{user.email}</span>
            </span>
          </div>
          {accountHref && (
            <Link role="menuitem" href={accountHref} onClick={close} className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-bg">
              <UserRound className="h-4 w-4 text-muted" aria-hidden /> My account
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger hover:bg-danger/5">
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

type PaletteEntry = { label: string; href: string; icon: string; meta?: string | null; section: string };

const RECORD_ICON: Record<string, string> = { Products: "software", Vendors: "vendors", Categories: "categories", Leads: "leads", Users: "users", Pages: "pages", "Blog posts": "blog" };

/** Debounced record search against /api/admin/search. */
function useRecordSearch(q: string, enabled: boolean) {
  const [hits, setHits] = useState<PaletteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const term = q.trim();
    if (!enabled || term.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = res.ok ? ((await res.json()) as { hits: { type: string; label: string; meta: string | null; href: string }[] }) : { hits: [] };
        setHits(data.hits.map((h) => ({ label: h.label, href: h.href, meta: h.meta, icon: RECORD_ICON[h.type] ?? "pages", section: h.type })));
      } catch {
        /* aborted: a newer search is on its way */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, enabled]);
  return { hits, loading };
}

function CommandPalette({ items, createItems, guide = [], onClose, recordSearch, siteName }: { items: FlatEntry[]; createItems: CreateItem[]; guide?: GuideHit[]; onClose: () => void; recordSearch: boolean; siteName: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const { hits, loading } = useRecordSearch(q, recordSearch);

  const entries: PaletteEntry[] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = items.map((i) => ({ label: i.label, href: i.href, icon: i.icon, meta: i.group, section: term ? "Admin pages" : "Quick navigation" }));
    const creates = createItems.map((c) => ({ label: c.label, href: c.href, icon: c.icon, meta: null, section: "Create" }));
    if (!term) return [...pages, ...creates];
    const match = (e: PaletteEntry) => e.label.toLowerCase().includes(term) || (e.meta ?? "").toLowerCase().includes(term);
    // "Where do I change…?": every word must appear in the part of the website, its page or the note.
    const words = term.replace(/^(where|how)( do| can)? (i|we) (change|edit|update|add|find)\s*/, "").split(/\s+/).filter((w) => w.length > 1);
    const where = words.length
      ? guide
          .filter((g) => {
            const text = `${g.part} ${g.page} ${g.note ?? ""}`.toLowerCase();
            return words.every((w) => text.includes(w));
          })
          .slice(0, 8)
          .map((g) => ({ label: `${g.part} (${g.page})`, href: g.href, icon: "guide", meta: g.where, section: "Where to change it" }))
      : [];
    return [...pages.filter(match), ...where, ...creates.filter(match), ...hits];
  }, [items, createItems, guide, q, hits]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const sections = entries.reduce<{ name: string; rows: { e: PaletteEntry; i: number }[] }[]>((acc, e, i) => {
    const last = acc[acc.length - 1];
    if (last && last.name === e.section) last.rows.push({ e, i });
    else acc.push({ name: e.section, rows: [{ e, i }] });
    return acc;
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/40 px-4 pt-[9vh] backdrop-blur-[3px]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="flex max-h-[78vh] w-full max-w-[38rem] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_32px_64px_-24px_rgb(16_24_40/0.45)]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-5">
          <Search className="h-5 w-5 shrink-0 text-muted" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(entries.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && entries[active]) {
                e.preventDefault();
                go(entries[active].href);
              } else if (e.key === "Escape") onClose();
            }}
            placeholder={guide.length ? "Search pages and records, or type what you want to change (e.g. logo, footer, cookie banner)…" : recordSearch ? "Search products, leads, vendors, users, pages…" : "Search pages…"}
            aria-label="Search"
            className="h-14 min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink shadow-none outline-none ring-0 placeholder:text-muted/70 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-bg hover:text-ink" aria-label="Close search">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]" role="listbox" aria-label="Results">
          {sections.map((sec) => (
            <div key={sec.name} className="mb-2 last:mb-0">
              <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{sec.name}</p>
              <ul>
                {sec.rows.map(({ e, i }) => {
                  const Icon = sec.name === "Create" ? Plus : ADMIN_ICONS[e.icon] ?? FileText;
                  return (
                    <li
                      key={`${e.section}-${e.href}-${e.label}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(e.href)}
                      className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm", i === active ? "bg-bg text-ink" : "text-ink/85")}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", i === active ? "text-ink" : "text-ink/55")} aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium">{e.label}</span>
                      {e.meta && sec.name !== "Quick navigation" && <span className="max-w-[40%] truncate text-xs text-muted">{e.meta}</span>}
                      <ChevronRight className={cn("h-4 w-4 shrink-0", i === active ? "text-ink" : "text-muted/70")} aria-hidden />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {loading && <p className="px-3 py-3 text-sm text-muted">Searching records…</p>}
          {!loading && entries.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted">Nothing matches “{q.trim()}”. Try a product, company or lead name.</p>}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-bg/50 px-5 py-2.5 text-xs text-muted">
          <span>Search {siteName} {recordSearch ? "admin pages and records" : "pages"}</span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">↑</kbd>
            <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans">↓</kbd> to move
            <kbd className="ml-2 rounded border border-line bg-surface px-1.5 py-0.5 font-sans">Enter</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}
