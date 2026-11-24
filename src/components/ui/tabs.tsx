"use client";

import { useEffect, useId, useState, type ReactNode, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/**
 * WAI-ARIA tabs with arrow-key navigation. Panels stay mounted so form state survives tab switches.
 * `variant="underline"`: a row of text tabs with a line under the open one (account pages).
 * `urlParam`: keeps the open tab in the address bar (?tab=password), so it can be linked and survives a reload.
 */
export function Tabs({ tabs, defaultTab, className, variant = "pill", urlParam }: { tabs: { id: string; label: ReactNode; content: ReactNode; badge?: ReactNode }[]; defaultTab?: string; className?: string; variant?: "pill" | "underline"; urlParam?: string }) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const base = useId();
  useEffect(() => {
    if (!urlParam) return;
    const fromUrl = new URLSearchParams(window.location.search).get(urlParam);
    if (fromUrl && tabs.some((t) => t.id === fromUrl)) setActive(fromUrl);
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParam]);
  const open = (id: string) => {
    setActive(id);
    if (urlParam) {
      const url = new URL(window.location.href);
      if (id === tabs[0]?.id) url.searchParams.delete(urlParam);
      else url.searchParams.set(urlParam, id);
      window.history.replaceState(window.history.state, "", url);
    }
  };
  const onKey = (e: KeyboardEvent, index: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tabs[(index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    if (next) {
      open(next.id);
      document.getElementById(`${base}-tab-${next.id}`)?.focus();
    }
  };
  const underline = variant === "underline";
  return (
    <div className={className}>
      <div
        role="tablist"
        className={cn(
          "flex max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          underline ? "gap-6 border-b border-line" : "w-fit gap-1 rounded-xl bg-bg p-1",
        )}
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => open(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm transition-colors",
              underline
                ? cn("-mb-px border-b-2 px-0.5 pb-3 pt-1 font-medium", active === t.id ? "border-primary text-primary" : "border-transparent text-muted hover:border-line hover:text-ink")
                : cn("rounded-lg px-3 py-1.5", active === t.id ? "bg-surface font-semibold text-ink shadow-[0_1px_3px_rgb(16_24_40/0.1)] ring-1 ring-line" : "font-medium text-muted hover:text-ink"),
            )}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} id={`${base}-panel-${t.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${t.id}`} hidden={active !== t.id} className="pt-5">
          {t.content}
        </div>
      ))}
    </div>
  );
}
