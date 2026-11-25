"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_COMPARE, useCompare, type CompareItem } from "./compare-context";
import { useT } from "./texts";
import { compareUrl } from "@/lib/compare";

export function CompareCheckbox({ item, label = "Compare" }: { item: CompareItem; label?: string }) {
  const { has, toggle } = useCompare();
  const [full, setFull] = useState(false);
  const checked = has(item.slug);
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center justify-center gap-2 text-sm", checked ? "font-medium text-primary" : "text-muted hover:text-ink")}>
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-line text-primary focus:ring-mint-soft"
        checked={checked}
        onChange={() => {
          const r = toggle(item);
          setFull(r === "full");
          if (r === "full") setTimeout(() => setFull(false), 3000);
        }}
      />
      {full ? `Up to ${MAX_COMPARE} products` : label}
    </label>
  );
}

/** Sticky bottom tray listing products selected for comparison. */
export function CompareTray({ ctaLabel }: { ctaLabel: string }) {
  const t = useT();
  const { items, remove, clear } = useCompare();
  const pathname = usePathname();
  const bar = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const visible = items.length > 0 && !pathname.startsWith("/compare");
  // Leave room under the footer equal to the bar's height, so the bar never hides the footer's last line.
  useEffect(() => {
    const el = bar.current;
    // --cg-tray-h lets the help chat button sit above the bar.
    const root = document.documentElement.style;
    if (!visible || !el) { root.setProperty("--cg-tray-h", "0px"); return setHeight(0); }
    const update = () => { setHeight(el.offsetHeight); root.setProperty("--cg-tray-h", `${el.offsetHeight}px`); };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { ro.disconnect(); root.setProperty("--cg-tray-h", "0px"); };
  }, [visible]);
  // The compare page has its own product slots.
  if (!visible) return null;
  const href = compareUrl(items.map((i) => i.slug));
  return (
    <>
    <div aria-hidden style={{ height }} />
    <div ref={bar} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 shadow-[0_-12px_32px_-16px_rgb(var(--color-ink)/0.3)] backdrop-blur" role="region" aria-label="Products to compare">
      <div className="container flex items-center gap-3 py-3">
        <ul className="flex flex-1 items-center gap-2 overflow-x-auto">
          {items.map((i) => (
            <li key={i.slug} className="flex shrink-0 items-center gap-2 rounded-control border border-line bg-bg py-1 pl-1.5 pr-1 text-sm">
              {i.logoUrl ? <Image src={i.logoUrl} alt="" width={20} height={20} className="rounded-sm object-contain" /> : null}
              <span className="max-w-[9rem] truncate">{i.name}</span>
              <button type="button" onClick={() => remove(i.slug)} className="rounded p-0.5 text-muted hover:bg-ink/5 hover:text-ink" aria-label={`Remove ${i.name}`}>
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {Array.from({ length: MAX_COMPARE - items.length }).map((_, n) => (
            <li key={`slot-${n}`} className="hidden h-8 w-28 shrink-0 rounded-control border border-dashed border-line sm:block" aria-hidden />
          ))}
        </ul>
        <button type="button" onClick={clear} className="hidden text-sm text-muted hover:text-ink sm:block">
          {t("compareTray.clear")}
        </button>
        {items.length >= 2 ? (
          <Link href={href} className="inline-flex h-10 items-center rounded-control bg-primary px-4 text-sm font-medium text-primary-fg hover:bg-primary/90">
            {ctaLabel} {items.length}
          </Link>
        ) : (
          <span className="text-sm text-muted">{t("compareTray.addMore")}</span>
        )}
      </div>
    </div>
    </>
  );
}
