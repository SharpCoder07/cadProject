"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutGrid, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useT } from "./texts";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  badge: string | null;
  newTab: boolean;
  children: NavItem[];
}
export interface NavCategory {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  children: { id: string; name: string; slug: string }[];
}

/** Categories mega menu: click/keyboard operable, closes on outside click, Escape and navigation. */
export function CategoriesMenu({ categories, label = "All categories" }: { categories: NavCategory[]; label?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(categories[0]?.id);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = categories.find((c) => c.id === active);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex h-9 items-center gap-1.5 rounded-control bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary/90">
        <LayoutGrid className="h-4 w-4" aria-hidden /> {label} <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex w-[min(54rem,calc(100vw-2rem))] overflow-hidden rounded-panel border border-line bg-surface shadow-[0_24px_60px_-20px_rgb(var(--color-ink)/0.35)]">
          <ul className="max-h-[70vh] w-64 shrink-0 overflow-y-auto border-r border-line bg-bg/60 py-2">
            {categories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/categories/${c.slug}`}
                  onMouseEnter={() => setActive(c.id)}
                  onFocus={() => setActive(c.id)}
                  className={cn("flex items-center gap-2.5 px-4 py-2 text-sm", active === c.id ? "bg-surface font-semibold text-primary shadow-[inset_3px_0_0_rgb(var(--color-primary))]" : "text-ink hover:bg-surface")}
                >
                  <Icon name={c.icon} className="h-4 w-4 shrink-0" />
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex-1 p-5">
            {current && (
              <>
                <Link href={`/categories/${current.slug}`} className="font-display text-lg font-semibold hover:text-primary">
                  {current.name}
                </Link>
                {current.children.length ? (
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                    {current.children.map((sc) => (
                      <li key={sc.id}>
                        <Link href={`/categories/${sc.slug}`} className="text-sm text-muted hover:text-primary">
                          {sc.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-muted">{t("header.categoryEmpty")}</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function DesktopMenu({ items }: { items: NavItem[] }) {
  return (
    <ul className="hidden items-center gap-1 lg:flex">
      {items.map((item) => (
        <li key={item.id} className="group relative">
          <Link href={item.href || "#"} target={item.newTab ? "_blank" : undefined} rel={item.newTab ? "noopener" : undefined} className="flex h-9 items-center gap-1 rounded-control px-3 text-sm font-semibold text-ink/85 hover:bg-primary-soft hover:text-primary">
            {item.label}
            {item.badge && <span className="rounded bg-accent px-1.5 text-[10px] font-bold uppercase text-accent-fg">{item.badge}</span>}
            {item.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />}
          </Link>
          {item.children.length > 0 && (
            <ul className="invisible absolute left-0 top-full z-50 min-w-[14rem] rounded-panel border border-line bg-surface py-2 opacity-0 shadow-lg transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              {item.children.map((c) => (
                <li key={c.id}>
                  <Link href={c.href || "#"} target={c.newTab ? "_blank" : undefined} className="block px-4 py-2 text-sm hover:bg-bg">
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

export function MobileMenu({ items, categories }: { items: NavItem[]; categories: NavCategory[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="rounded-control p-2 hover:bg-ink/5">
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <button type="button" aria-label="Close menu" className="flex-1 bg-ink/40" onClick={() => setOpen(false)} />
          <nav className="flex h-full w-[min(22rem,85vw)] flex-col overflow-y-auto bg-surface" aria-label="Mobile">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-medium">{t("header.menu")}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-control p-1.5 hover:bg-ink/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="border-b border-line py-2">
              {items.map((i) => (
                <li key={i.id}>
                  <Link href={i.href || "#"} className="block px-4 py-2.5 text-sm font-medium">
                    {i.label}
                  </Link>
                  {i.children.map((c) => (
                    <Link key={c.id} href={c.href || "#"} className="block py-2 pl-8 pr-4 text-sm text-muted">
                      {c.label}
                    </Link>
                  ))}
                </li>
              ))}
            </ul>
            <p className="px-4 pb-1 pt-4 text-xs font-medium text-muted">{t("header.mobileCategories")}</p>
            <ul className="pb-6">
              {categories.map((c) => (
                <li key={c.id}>
                  <Link href={`/categories/${c.slug}`} className="flex items-center gap-2.5 px-4 py-2.5 text-sm">
                    <Icon name={c.icon} className="h-4 w-4 text-muted" /> {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
