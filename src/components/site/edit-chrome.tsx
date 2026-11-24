"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronsLeft, ChevronsRight, ExternalLink, Gauge, Home, Menu, Pencil, Plus, Search, UserRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, CREATE_ITEMS, type AdminNavLink } from "@/components/admin/nav";
import { ADMIN_ICONS } from "@/components/admin/icons";

/**
 * WordPress-style chrome on the website for signed-in staff: the dark admin bar at the top (always),
 * and in edit mode the admin menu as a sidebar on the left. Admin screens open in the editor panel
 * (over the page, or docked); your admin panel itself is unchanged.
 */

const BAR = "#1d2327";
const SIDE = "#1d2327";
const SIDE_HOVER = "#2c3338";

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close]);
  return ref;
}

export function AdminBar({
  siteName, userName, on, unpublished, busy, canHref, onToggle, onFind, onPublish, openAdmin, editAllowed = true, menuButton,
}: {
  /** UI Editor switched on (Settings › Edit Mode): shows "Edit this page". */
  editAllowed?: boolean;
  /** UI Editor off, sidebar editor on: a button that opens / closes the admin-menu sidebar. */
  menuButton?: { open: boolean; onToggle: () => void };
  siteName: string;
  userName: string;
  on: boolean;
  unpublished: number;
  busy: boolean;
  canHref: (href: string) => boolean;
  onToggle: (on: boolean) => void;
  onFind: () => void;
  onPublish: () => void;
  openAdmin: (label: string, href: string) => void;
}) {
  const [menu, setMenu] = useState<"new" | "me" | null>(null);
  const close = () => setMenu(null);
  const newRef = useOutside(menu === "new", close);
  const meRef = useOutside(menu === "me", close);
  const create = CREATE_ITEMS.filter((c) => canHref(c.href));
  const item = "flex h-8 items-center gap-1.5 px-2.5 text-[13px] text-[#f0f0f1] hover:bg-[#2c3338] hover:text-[#72aee6]";
  const drop = "absolute top-full z-[95] min-w-[13rem] py-1.5 shadow-lg";
  return (
    <div data-cg-ui data-cg-adminbar="" className="fixed inset-x-0 top-0 z-[94] flex h-8 items-center justify-between text-[13px]" style={{ background: BAR }} role="navigation" aria-label="Admin bar">
      <div className="flex min-w-0 items-center">
        <a href="/admin" className={cn(item, "px-2")} title="Admin panel" aria-label="Admin panel"><Gauge className="h-4 w-4" /></a>
        <Link href="/" className={cn(item, "max-w-[14rem]")} title="Visit site"><Home className="h-4 w-4 shrink-0" aria-hidden /><span className="hidden truncate sm:inline">{siteName}</span></Link>
        {create.length > 0 && (
          <div ref={newRef} className="relative">
            <button type="button" onClick={() => setMenu(menu === "new" ? null : "new")} aria-expanded={menu === "new"} className={item}><Plus className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">New</span></button>
            {menu === "new" && (
              <div className={cn(drop, "left-0")} style={{ background: SIDE_HOVER }}>
                {create.map((c) => (
                  <button key={c.href} type="button" onClick={() => { close(); openAdmin(c.label, c.href); }} className="block w-full px-3 py-1.5 text-left text-[13px] text-[#f0f0f1] hover:text-[#72aee6]">{c.label}</button>
                ))}
              </div>
            )}
          </div>
        )}
        {menuButton && (
          <button type="button" onClick={menuButton.onToggle} aria-pressed={menuButton.open} className={cn(item, menuButton.open && "bg-[#2271b1] text-white hover:bg-[#135e96] hover:text-white")}>
            <Menu className="h-4 w-4" aria-hidden /> <span>Admin menu</span>
          </button>
        )}
        {editAllowed && (
          <button type="button" onClick={() => onToggle(!on)} className={cn(item, on && "bg-[#2271b1] text-white hover:bg-[#135e96] hover:text-white")}>
            {on ? <X className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
            <span>{on ? "Exit edit mode" : "Edit this page"}</span>
          </button>
        )}
        {on && (
          <button type="button" onClick={onFind} className={item} title="Find (Ctrl+K)"><Search className="h-4 w-4" aria-hidden /><span className="hidden md:inline">Ctrl+K</span></button>
        )}
        {on && unpublished > 0 && (
          <button type="button" disabled={busy} onClick={onPublish} className={cn(item, "text-[#f0b849]")} title="Put your unpublished changes live">
            <span className="h-2 w-2 rounded-full bg-[#f0b849]" aria-hidden /> {unpublished} unpublished · Publish
          </button>
        )}
      </div>
      <div ref={meRef} className="relative">
        <button type="button" onClick={() => setMenu(menu === "me" ? null : "me")} aria-expanded={menu === "me"} className={item}>
          <span className="hidden sm:inline">Howdy, {userName.split(" ")[0]}</span>
          <span className="grid h-5 w-5 place-items-center rounded-full bg-[#50575e]"><UserRound className="h-3.5 w-3.5" aria-hidden /></span>
        </button>
        {menu === "me" && (
          <div className={cn(drop, "right-0")} style={{ background: SIDE_HOVER }}>
            <p className="px-3 py-1.5 text-[13px] font-semibold text-[#f0f0f1]">{userName}</p>
            <a href="/admin" className="block px-3 py-1.5 text-[13px] text-[#f0f0f1] hover:text-[#72aee6]">Admin panel</a>
            <a href="/admin/account" className="block px-3 py-1.5 text-[13px] text-[#f0f0f1] hover:text-[#72aee6]">My account</a>
          </div>
        )}
      </div>
    </div>
  );
}

/** The admin menu as a WordPress-style sidebar (edit mode). Each screen opens in the editor panel. */
export function EditSidebar({ collapsed, onCollapse, canHref, openAdmin }: { collapsed: boolean; onCollapse: (c: boolean) => void; canHref: (href: string) => boolean; openAdmin: (label: string, href: string) => void }) {
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const groups = ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items
      .map((i) => ({ ...i, children: ((i.children ?? []) as AdminNavLink[]).filter((c) => canHref(c.href)) }))
      .filter((i) => (i.href && canHref(i.href)) || i.children.length > 0),
  })).filter((g) => g.items.length);
  const go = (label: string, href: string) => { setCurrent(href); openAdmin(label, href); };
  return (
    <aside data-cg-ui className="fixed bottom-0 left-0 top-8 z-[93] hidden flex-col overflow-y-auto overflow-x-hidden text-[14px] md:flex" style={{ background: SIDE, width: "var(--cg-side)" }} aria-label="Admin menu">
      <nav className="flex-1 py-2">
        {groups.map((g, gi) => (
          <div key={g.label || gi} className={cn(gi > 0 && "mt-2 border-t border-white/5 pt-2")}>
            {g.items.map((i) => {
              const I = ADMIN_ICONS[i.icon] ?? Gauge;
              const hasKids = i.children.length > 0;
              const isOpen = openItem === i.label;
              const active = current === i.href || i.children.some((c) => c.href === current);
              return (
                <div key={i.label} className={cn(active && "bg-[#2271b1]")}>
                  <button
                    type="button"
                    title={collapsed ? i.label : undefined}
                    onClick={() => (hasKids ? setOpenItem(isOpen ? null : i.label) : i.href && go(i.label, i.href))}
                    className={cn("flex w-full items-center gap-2.5 py-2 text-left text-[#f0f0f1] hover:text-[#72aee6]", collapsed ? "justify-center px-0" : "px-3", !active && "hover:bg-[#2c3338]")}
                  >
                    <I className="h-[18px] w-[18px] shrink-0 opacity-70" aria-hidden />
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{i.label}</span>}
                    {!collapsed && hasKids && <ChevronDown className={cn("h-3.5 w-3.5 opacity-60 transition", isOpen && "rotate-180")} aria-hidden />}
                  </button>
                  {hasKids && (isOpen || active) && !collapsed && (
                    <div className="pb-1.5" style={{ background: "#2c3338" }}>
                      {i.children.map((c) => (
                        <button key={c.href} type="button" onClick={() => go(`${i.label} › ${c.label}`, c.href)} className={cn("block w-full truncate py-1.5 pl-9 pr-3 text-left text-[13px] hover:text-[#72aee6]", current === c.href ? "font-semibold text-white" : "text-[#c3c4c7]")}>
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <a href="/admin" className={cn("flex items-center gap-2.5 border-t border-white/5 py-2 text-[13px] text-[#c3c4c7] hover:text-[#72aee6]", collapsed ? "justify-center" : "px-3")} title="Open the full admin panel">
        <ExternalLink className="h-4 w-4" aria-hidden /> {!collapsed && "Open admin panel"}
      </a>
      <button type="button" onClick={() => onCollapse(!collapsed)} className={cn("flex items-center gap-2.5 py-2 text-[13px] text-[#c3c4c7] hover:text-[#72aee6]", collapsed ? "justify-center" : "px-3")} aria-label={collapsed ? "Expand menu" : "Collapse menu"}>
        {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" aria-hidden /> Collapse menu</>}
      </button>
    </aside>
  );
}
