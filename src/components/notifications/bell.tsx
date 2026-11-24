"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { enablePush, needsHomeScreen, pushState, refreshPush, type PushState } from "./push-client";

export interface WaitingSummary {
  count: number;
  items: { id: string; title: string; meta: string; href: string; createdAt: string }[];
  links: { label: string; href: string; count: number }[];
}

interface Item { id: string; type: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string }

const POLL_MS = 45_000;

/**
 * Header bell: the person's notifications (with unread count, refreshed every 45 seconds and
 * whenever a browser push arrives) and, for staff, what's waiting for them.
 */
export function NotificationsBell({ waiting, settingsHref }: { waiting?: WaitingSummary | null; settingsHref: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"updates" | "waiting">("updates");
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?take=15", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: Item[]; unread: number };
      setItems(data.items);
      setUnread(data.unread);
      setLoaded(true);
    } catch {
      /* offline: keep what we have */
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), POLL_MS);
    const onFocus = () => void load();
    const onMessage = (e: MessageEvent) => (e.data as { type?: string } | null)?.type === "cg-notification" && void load();
    window.addEventListener("focus", onFocus);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    void pushState().then(setPush);
    try {
      if (!sessionStorage.getItem("cg_push_refreshed")) {
        sessionStorage.setItem("cg_push_refreshed", "1");
        void refreshPush();
      }
    } catch {
      /* storage blocked */
    }
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [load]);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    void load();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const post = (body: unknown) => fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => undefined);

  const openItem = (n: Item) => {
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      void post({ op: "read", ids: [n.id] });
    }
    setOpen(false);
    if (n.href) {
      if (/^https?:\/\//.test(n.href)) window.location.href = n.href;
      else router.push(n.href);
    }
  };

  const readAll = () => {
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    void post({ op: "read", ids: "all" });
  };

  const turnOn = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      setPush(await enablePush());
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Couldn't turn on notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const waitingCount = waiting?.count ?? 0;
  const badge = unread || waitingCount;
  const showPushPrompt = push === "off" && !needsHomeScreen();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `${unread} unread notifications` : waitingCount ? `${waitingCount} things waiting` : "Notifications"}
        title="Notifications"
        className="relative grid h-8 w-8 place-items-center rounded-control text-ink/70 hover:bg-bg hover:text-ink"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {badge > 0 && (
          <span className={cn("absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold leading-[18px] ring-2 ring-surface", unread ? "bg-danger text-white" : "bg-primary text-primary-fg")}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 top-full z-50 mt-2 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-20px_rgb(0_0_0/0.4)]">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" onClick={readAll} className="inline-flex h-7 items-center gap-1 rounded-control px-2 text-xs font-medium text-primary hover:bg-bg">
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark all read
                </button>
              )}
              <Link href={settingsHref} className="grid h-7 w-7 place-items-center rounded-control text-muted hover:bg-bg hover:text-ink" title="Notification settings" aria-label="Notification settings">
                <Settings2 className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>

          {waiting && (
            <div className="flex gap-1 border-b border-line px-3 py-2">
              {(["updates", "waiting"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors", tab === t ? "bg-primary text-primary-fg" : "text-muted hover:bg-bg hover:text-ink")}
                >
                  {t === "updates" ? "Updates" : "Waiting for you"}
                  {(t === "updates" ? unread : waitingCount) > 0 && <span className={cn("rounded-full px-1.5 text-[10px] leading-4", tab === t ? "bg-white/25" : "bg-line text-ink")}>{t === "updates" ? unread : waitingCount}</span>}
                </button>
              ))}
            </div>
          )}

          {tab === "updates" || !waiting ? (
            <>
              {showPushPrompt && (
                <div className="flex items-start gap-3 border-b border-line bg-primary/5 px-4 py-3">
                  <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-ink">Get these as pop-ups on this device, even when the site is closed.</p>
                    {pushError && <p className="mt-1 text-xs text-danger">{pushError}</p>}
                  </div>
                  <button type="button" disabled={pushBusy} onClick={turnOn} className="h-7 shrink-0 rounded-control bg-primary px-2.5 text-xs font-semibold text-primary-fg hover:bg-primary/90 disabled:opacity-60">
                    {pushBusy ? "Turning on…" : "Turn on"}
                  </button>
                </div>
              )}
              {!loaded ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No notifications yet. New leads, approvals and other updates will show up here.</p>
              ) : (
                <ul className="max-h-[22rem] overflow-y-auto py-1">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => openItem(n)} className={cn("flex w-full gap-3 px-4 py-2.5 text-left hover:bg-bg", !n.read && "bg-primary/[0.04]")}>
                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm text-ink", !n.read && "font-semibold")}>{n.title}</span>
                          {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{n.body}</span>}
                          <span className="mt-0.5 block text-[11px] text-muted">{formatDateTime(n.createdAt)}{!n.read && <span className="sr-only"> · unread</span>}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Link href={settingsHref} className="block border-t border-line px-4 py-2.5 text-center text-sm font-semibold text-ink hover:bg-bg">
                See all notifications
              </Link>
            </>
          ) : (
            <>
              {waiting.items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Nothing waiting for you.</p>
              ) : (
                <ul className="max-h-[22rem] overflow-y-auto py-1">
                  {waiting.items.map((r) => (
                    <li key={r.id}>
                      <Link href={r.href} className="block px-4 py-2.5 hover:bg-bg">
                        <span className="block truncate text-sm font-medium text-ink">{r.title}</span>
                        <span className="block text-xs text-muted">{r.meta} · {formatDateTime(r.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {waiting.links.length > 0 && (
                <div className="flex border-t border-line">
                  {waiting.links.map((l) => (
                    <Link key={l.href} href={l.href} className="flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-ink hover:bg-bg [&+&]:border-l [&+&]:border-line">
                      {l.label}
                      {l.count > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold leading-5 text-primary-fg">{l.count > 99 ? "99+" : l.count}</span>}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
