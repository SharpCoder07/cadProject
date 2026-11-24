"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function SoftwareTabs({ tabs, title }: { tabs: { label: string; href: string; content: ReactNode }[]; title?: string }) {
  const [active, setActive] = useState(0);
  if (!tabs.length) return null;
  const current = tabs[active] ?? tabs[0]!;
  return (
    <div>
      {/* Heading on the left, "View all … software" for the open tab on the right (like the other sections). */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        {title ? (
          <div>
            <h2 className="text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.85rem]">{title}</h2>
            <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
          </div>
        ) : <span />}
        <Link href={current.href} className="inline-flex h-9 items-center gap-1 rounded-control border border-primary/30 px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-fg">
          View all {current.label} software <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <div role="tablist" className="mb-6 flex max-w-full gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            role="tab"
            type="button"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={cn("-mb-px h-11 shrink-0 border-b-[3px] px-5 text-sm font-semibold transition-colors", i === active ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{current.content}</div>
    </div>
  );
}
