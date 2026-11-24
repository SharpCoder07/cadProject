"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BellOff, BellRing, CheckCheck, Inbox, Mail, MonitorSmartphone, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { NOTIFY_TYPES, type NotifyType } from "@/lib/notify-types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/admin/page-header";
import { ListPanel, PanelEmpty, PILL_TRACK, pillTab } from "@/components/admin/list-panel";
import { disablePush, enablePush, needsHomeScreen, pushState, type PushState } from "./push-client";

interface Item { id: string; type: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string }

export interface NotificationCenterProps {
  initial: { items: Item[]; unread: number; more: boolean };
  prefs: { key: NotifyType; on: boolean }[];
  devices: number;
  emailHref: string;
}

const post = async (body: unknown) => {
  const res = await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Couldn't save. Try again.");
};

/** "Notifications" page (admin, vendor/reseller portal and buyer account): history, pop-ups on this device, and which types to get. */
export function NotificationCenter({ initial, prefs: initialPrefs, devices, emailHref }: NotificationCenterProps) {
  const toast = useToast();
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [unread, setUnread] = useState(initial.unread);
  const [more, setMore] = useState(initial.more);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(false);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    void pushState().then(setPush);
    setIosHint(needsHomeScreen());
  }, []);

  const fetchPage = async (opts: { before?: string; unreadOnly: boolean }) => {
    const q = new URLSearchParams({ take: "30" });
    if (opts.before) q.set("before", opts.before);
    if (opts.unreadOnly) q.set("unread", "1");
    const res = await fetch(`/api/notifications?${q}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Couldn't load notifications.");
    return (await res.json()) as { items: Item[]; unread: number; more: boolean };
  };

  const changeFilter = async (f: "all" | "unread") => {
    setFilter(f);
    setLoading(true);
    try {
      const data = await fetchPage({ unreadOnly: f === "unread" });
      setItems(data.items);
      setUnread(data.unread);
      setMore(data.more);
    } catch (e) {
      toast.notify("error", e instanceof Error ? e.message : "Couldn't load notifications.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setLoading(true);
    try {
      const data = await fetchPage({ before: last.createdAt, unreadOnly: filter === "unread" });
      setItems((list) => [...list, ...data.items]);
      setMore(data.more);
    } catch (e) {
      toast.notify("error", e instanceof Error ? e.message : "Couldn't load notifications.");
    } finally {
      setLoading(false);
    }
  };

  const open = (n: Item) => {
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      void post({ op: "read", ids: [n.id] }).catch(() => undefined);
    }
    if (n.href) router.push(n.href);
  };

  const readAll = async () => {
    try {
      await post({ op: "read", ids: "all" });
      setItems((list) => (filter === "unread" ? [] : list.map((x) => ({ ...x, read: true }))));
      setUnread(0);
      toast.notify("success", "All notifications marked as read");
    } catch (e) {
      toast.notify("error", e instanceof Error ? e.message : "Couldn't save.");
    }
  };

  const clearRead = async () => {
    try {
      await post({ op: "clear" });
      setItems((list) => list.filter((x) => !x.read));
      toast.notify("success", "Read notifications cleared");
    } catch (e) {
      toast.notify("error", e instanceof Error ? e.message : "Couldn't clear.");
    }
  };

  const togglePref = async (key: NotifyType, on: boolean) => {
    setPrefs((p) => p.map((x) => (x.key === key ? { ...x, on } : x)));
    try {
      await post({ op: "pref", type: key, on });
      toast.notify("success", `${NOTIFY_TYPES[key].label}: ${on ? "on" : "off"}`);
    } catch (e) {
      setPrefs((p) => p.map((x) => (x.key === key ? { ...x, on: !on } : x)));
      toast.notify("error", e instanceof Error ? e.message : "Couldn't save.");
    }
  };

  const togglePush = async () => {
    setBusy(true);
    try {
      const next = push === "on" ? await disablePush() : await enablePush();
      setPush(next);
      if (next === "on") toast.notify("success", "We sent a test pop-up to this device.", "Pop-ups are on");
      else if (next === "denied") toast.notify("error", "Notifications are blocked for this site in your browser settings.");
      else if (push === "on") toast.notify("success", "Pop-ups turned off on this device");
      router.refresh();
    } catch (e) {
      toast.notify("error", e instanceof Error ? e.message : "Couldn't change pop-ups.");
    } finally {
      setBusy(false);
    }
  };

  const hasRead = items.some((x) => x.read);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates for you, in the bell at the top and as pop-ups on your devices."
        actions={
          <>
            {hasRead && (
              <Button variant="secondary" size="sm" onClick={clearRead}>
                <Trash2 className="h-4 w-4" aria-hidden /> Clear read
              </Button>
            )}
            {unread > 0 && (
              <Button size="sm" onClick={readAll}>
                <CheckCheck className="h-4 w-4" aria-hidden /> Mark all read
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <ListPanel
          title="All notifications"
          meta={unread ? `${unread} unread` : "All read"}
          tabs={
            <div className={PILL_TRACK} role="tablist" aria-label="Show">
              {(["all", "unread"] as const).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => void changeFilter(f)} className={pillTab(filter === f)}>
                  {f === "all" ? "All" : "Unread"}
                  {f === "unread" && unread > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold leading-5 text-primary-fg">{unread}</span>}
                </button>
              ))}
            </div>
          }
          footer={
            more ? (
              <div className="flex justify-center px-4 py-3">
                <Button variant="secondary" size="sm" disabled={loading} onClick={loadMore}>
                  {loading ? "Loading…" : "Show older"}
                </Button>
              </div>
            ) : undefined
          }
        >
          {items.length === 0 ? (
            <PanelEmpty icon={<Inbox className="h-5 w-5" aria-hidden />} title={filter === "unread" ? "You're all caught up" : "No notifications yet"}>
              {filter === "unread" ? "Nothing unread." : "New leads, approvals and other updates for you will appear here."}
            </PanelEmpty>
          ) : (
            <ul className={cn("divide-y divide-line", loading && "opacity-60")}>
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => open(n)} className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-bg sm:px-5", !n.read && "bg-primary/[0.04]")}>
                    <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-line" : "bg-primary")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm text-ink", !n.read && "font-semibold")}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-sm text-muted">{n.body}</span>}
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>{formatDateTime(n.createdAt)}</span>
                        {n.type in NOTIFY_TYPES && <span>· {NOTIFY_TYPES[n.type as NotifyType].label}</span>}
                        {!n.read && <span className="font-semibold text-primary">· New</span>}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ListPanel>

        <div className="space-y-5">
          <ListPanel title="Pop-ups on this device">
            <div className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", push === "on" ? "bg-success/10 text-success" : "bg-ink/5 text-muted")}>
                  {push === "on" ? <BellRing className="h-5 w-5" aria-hidden /> : <BellOff className="h-5 w-5" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-ink">
                    {push === null ? "Checking…" : push === "on" ? "On for this browser" : push === "denied" ? "Blocked in this browser" : push === "unsupported" ? "Not available here" : "Off for this browser"}
                  </p>
                  <p className="mt-0.5 text-muted">
                    {push === "denied"
                      ? "Allow notifications for this site in the browser's site settings (the icon left of the address), then reload."
                      : push === "unsupported"
                        ? iosHint
                          ? "On iPhone or iPad, add this site to your Home Screen (Share › Add to Home Screen), open it from there and turn pop-ups on."
                          : "This browser can't show pop-ups for websites. Try Chrome, Edge, Firefox or Safari."
                        : "Pop-ups appear even when the site is closed. Turn them on in each browser you use."}
                  </p>
                </div>
              </div>
              {(push === "on" || push === "off") && (
                <Button variant={push === "on" ? "secondary" : "primary"} size="sm" className="w-full" disabled={busy} onClick={togglePush}>
                  {busy ? "Please wait…" : push === "on" ? "Turn off on this device" : "Turn on pop-ups"}
                </Button>
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <MonitorSmartphone className="h-3.5 w-3.5" aria-hidden /> Pop-ups are on in {devices} browser{devices === 1 ? "" : "s"} for your account.
              </p>
            </div>
          </ListPanel>

          <ListPanel title="What to notify me about" meta={`${prefs.filter((p) => p.on).length} of ${prefs.length} on`}>
            <ul className="divide-y divide-line">
              {prefs.map((p) => (
                <li key={p.key} className="px-4 py-3 sm:px-5">
                  <Switch label={<span className="font-medium">{NOTIFY_TYPES[p.key].label}</span>} hint={NOTIFY_TYPES[p.key].description} checked={p.on} onChange={(e) => void togglePref(p.key, e.target.checked)} />
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">
              Switches apply to the bell and pop-ups.{" "}
              <Link href={emailHref} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <Mail className="h-3 w-3" aria-hidden /> Email notifications
              </Link>{" "}
              are set separately.
            </p>
          </ListPanel>
        </div>
      </div>
    </>
  );
}
