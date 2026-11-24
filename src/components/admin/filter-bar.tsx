"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * Filter row above admin lists. Results update by themselves: as you type in a text box (after a
 * short pause) and as soon as a dropdown or date changes — there is no Apply/Search button.
 * Pressing Enter still searches straight away.
 */
export function FilterBar({ children, action, bare, oneLine }: { children: ReactNode; action: string; /** No card around it (for use inside a panel). */ bare?: boolean; /** Keep everything on one line on wide screens (few filters). */ oneLine?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  // Rebuild the controls when the URL changes from outside this form (Reset, period tabs, the back
  // button), so dropdowns and dates show the filters actually applied. Changes made by typing or
  // picking here don't rebuild it, so the search box keeps focus.
  const urlKey = useSearchParams().toString();
  const applied = useRef<string | null>(null);
  const seen = useRef(urlKey);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (urlKey === seen.current) return;
    seen.current = urlKey;
    const mine = applied.current === urlKey;
    applied.current = null;
    if (!mine) setVersion((v) => v + 1);
  }, [urlKey]);
  const form = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, start] = useTransition();

  const apply = () => {
    if (timer.current) clearTimeout(timer.current);
    const el = form.current;
    if (!el) return;
    const sp = new URLSearchParams();
    for (const [k, v] of new FormData(el).entries()) {
      if (typeof v === "string" && v.trim() !== "") sp.append(k, v.trim());
    }
    const qs = sp.toString();
    applied.current = qs;
    const url = qs ? `${action}?${qs}` : action;
    start(() => (pathname === action ? router.replace(url, { scroll: false }) : router.push(url)));
  };

  return (
    <form
      key={version}
      ref={form}
      action={action}
      method="get"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        const typing = t.tagName === "INPUT" && ["text", "search", "email", "tel", ""].includes(t.type);
        if (timer.current) clearTimeout(timer.current);
        if (typing) timer.current = setTimeout(apply, 350);
        else apply();
      }}
      className={bare ? `flex flex-wrap items-center gap-2 ${oneLine ? "xl:flex-nowrap xl:[&>label:has(select)]:min-w-[7rem] xl:[&>label:has(select)]:shrink" : ""} [&_input]:h-10 [&_select]:h-10` : "admin-card mb-4 flex flex-wrap items-end gap-2 p-3 [&_input]:h-10 [&_select]:h-10"}
    >
      {children}
      <span className="flex h-10 shrink-0 items-center gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Updating" />}
        <Link href={action} className="px-2 text-sm text-muted hover:text-ink">Reset</Link>
      </span>
    </form>
  );
}
