"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Cookie, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "./texts";
import { Analytics } from "./analytics";
import type { Settings } from "@/server/settings/schemas";
import {
  allowedTrackers, choicesFor, COOKIE_CHOICE_EVENT, COOKIE_CONSENT_COOKIE, OPEN_COOKIE_SETTINGS, parseStoredConsent,
  type CookieChoices, type StoredCookieConsent,
} from "@/lib/compliance/consent";

export interface BannerCategory { key: string; name: string; description: string; isNecessary: boolean; cookies: { name: string; provider: string; duration: string; purpose: string }[] }

const readCookie = () => document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_CONSENT_COOKIE}=`))?.slice(COOKIE_CONSENT_COOKIE.length + 1);

/** Best-effort removal of analytics/marketing cookies once they're no longer allowed. */
function clearTrackingCookies(analytics: boolean, marketing: boolean) {
  const host = location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0] ?? "";
    const isAnalytics = /^(_ga|_gid|_gat|_clck|_clsk|CLID|_uetsid)/.test(name);
    const isMarketing = /^(_fbp|_fbc|_gcl)/.test(name);
    if ((isAnalytics && !analytics) || (isMarketing && !marketing)) {
      for (const d of domains) document.cookie = `${name}=; Max-Age=0; Path=/${d ? `; Domain=${d}` : ""}`;
    }
  }
}

/**
 * Cookie banner, cookie settings window and the gate for tracking scripts. Nothing optional loads until the
 * visitor allows it; "Reject optional" is as prominent as "Accept all". The choice is kept in the
 * cg_cookie_consent cookie and logged (Admin › Compliance & Privacy › Cookies).
 */
export function CookieConsent({ categories, version, days, bannerOn, analytics, privacyHref = "/privacy-policy" }: {
  categories: BannerCategory[];
  version: string;
  days: number;
  bannerOn: boolean;
  analytics: Settings["analytics"];
  privacyHref?: string;
}) {
  const t = useT();
  const [stored, setStored] = useState<StoredCookieConsent | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CookieChoices>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStored(parseStoredConsent(readCookie(), version));
    setReady(true);
  }, [version]);

  const openSettings = useCallback(() => {
    setDraft(choicesFor(categories, "custom", stored?.c ?? {}));
    setOpen(true);
  }, [categories, stored]);

  useEffect(() => {
    window.addEventListener(OPEN_COOKIE_SETTINGS, openSettings);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, openSettings);
  }, [openSettings]);

  // Links from pages without the banner (Account › Settings) open the window with /#cookie-settings.
  useEffect(() => {
    if (!ready || location.hash !== "#cookie-settings") return;
    history.replaceState(null, "", location.pathname + location.search);
    openSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the stored choice is known
  }, [ready]);

  const save = (action: "accept_all" | "reject_all" | "custom", custom?: CookieChoices) => {
    const choices = choicesFor(categories, action, custom);
    const before = allowedTrackers(stored);
    const id = stored?.id ?? (crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`);
    const next: StoredCookieConsent = { v: version, id, c: choices, t: Date.now() };
    document.cookie = `${COOKIE_CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(next))}; Max-Age=${days * 86_400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    fetch("/api/consent/cookies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visitorId: id, action, choices, noticeVersion: version }), keepalive: true }).catch(() => {});
    setStored(next);
    setOpen(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
    window.dispatchEvent(new CustomEvent(COOKIE_CHOICE_EVENT, { detail: choices }));
    const after = allowedTrackers(next);
    clearTrackingCookies(after.ga4, after.metaPixel);
    // Scripts that already ran can't be unloaded: reload so they stop.
    if ((before.ga4 && !after.ga4) || (before.metaPixel && !after.metaPixel)) window.setTimeout(() => location.reload(), 300);
  };

  const allow = useMemo(() => allowedTrackers(stored), [stored]);
  const showBanner = ready && bannerOn && !stored && categories.length > 0;

  return (
    <>
      {ready && <Analytics ids={analytics} allow={allow} />}

      {showBanner && (
        <div role="region" aria-label={t("cookies.title")} data-no-motion className="cg-cookie fixed inset-x-3 bottom-3 z-[60] sm:inset-x-auto sm:left-4 sm:max-w-md">
          <div className="rounded-2xl border border-line bg-surface p-5 text-ink shadow-[0_18px_50px_-12px_rgb(15_23_42/0.35)]">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary"><Cookie className="h-4 w-4" aria-hidden /></span>
              <p className="text-base font-bold">{t("cookies.title")}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {t("cookies.text")}{" "}
              <Link href={privacyHref} className="font-semibold text-primary underline-offset-2 hover:underline">{t("cookies.policyLink")}</Link>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => save("reject_all")}>{t("cookies.rejectAll")}</Button>
              <Button onClick={() => save("accept_all")}>{t("cookies.acceptAll")}</Button>
              <Button variant="secondary" className="col-span-2" onClick={openSettings}>{t("cookies.customise")}</Button>
            </div>
          </div>
        </div>
      )}

      {saved && (
        <div role="status" className="fixed bottom-4 left-1/2 z-[61] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg">{t("cookies.saved")}</div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={t("cookies.dialogTitle")} description={t("cookies.dialogText")} size="md" showScrollbar>
        <ul className="space-y-3">
          {categories.map((c) => {
            const on = c.isNecessary || draft[c.key] === true;
            return (
              <li key={c.key} className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{c.name}</p>
                    <p className="mt-0.5 text-sm text-muted">{c.description}</p>
                  </div>
                  {c.isNecessary ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{t("cookies.alwaysOn")}</span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={c.name}
                      onClick={() => setDraft((d) => ({ ...d, [c.key]: !on }))}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-line"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  )}
                </div>
                {c.cookies.length > 0 && (
                  <>
                    <button type="button" onClick={() => setExpanded((x) => (x === c.key ? null : c.key))} aria-expanded={expanded === c.key} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      {t("cookies.showCookies", { n: c.cookies.length })}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded === c.key ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    {expanded === c.key && (
                      <ul className="mt-2 space-y-1.5 text-xs text-muted">
                        {c.cookies.map((k) => (
                          <li key={k.name} className="rounded-lg bg-bg px-3 py-2">
                            <span className="font-mono font-semibold text-ink">{k.name}</span>
                            {k.provider && <> · {k.provider}</>}
                            {k.duration && <> · {k.duration}</>}
                            {k.purpose && <span className="block">{k.purpose}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => save("reject_all")}>{t("cookies.rejectAll")}</Button>
          <Button variant="secondary" onClick={() => save("accept_all")}>{t("cookies.acceptAll")}</Button>
          <Button onClick={() => save("custom", draft)}>{t("cookies.save")}</Button>
        </div>
      </Dialog>
    </>
  );
}

/** "Cookie settings" link (footer, account page): reopens the cookie settings window. */
export function CookieSettingsLink({ className, label }: { className?: string; label?: string }) {
  const t = useT();
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}>
      {label ?? t("cookies.footerLink")}
    </button>
  );
}
