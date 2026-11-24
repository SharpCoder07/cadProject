"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export interface CompareItem {
  slug: string;
  name: string;
  logoUrl: string | null;
}

import { COMPARE_SLOTS } from "@/lib/compare";

const KEY = "cg_compare";
export const MAX_COMPARE = COMPARE_SLOTS;

interface Ctx {
  items: CompareItem[];
  has: (slug: string) => boolean;
  toggle: (item: CompareItem) => "added" | "removed" | "full";
  remove: (slug: string) => void;
  clear: () => void;
  /** Replace the whole selection (the compare page keeps the tray in step with its slots). */
  set: (items: CompareItem[]) => void;
  /** True once the saved selection has been read from this browser. */
  ready: boolean;
}

const CompareContext = createContext<Ctx | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setItems((JSON.parse(raw) as CompareItem[]).slice(0, MAX_COMPARE));
    } catch {
      /* storage unavailable: compare still works for this page view */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: CompareItem[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const has = useCallback((slug: string) => items.some((i) => i.slug === slug), [items]);
  const toggle = useCallback(
    (item: CompareItem) => {
      if (items.some((i) => i.slug === item.slug)) {
        persist(items.filter((i) => i.slug !== item.slug));
        return "removed" as const;
      }
      if (items.length >= MAX_COMPARE) return "full" as const;
      persist([...items, item]);
      return "added" as const;
    },
    [items, persist],
  );
  const remove = useCallback((slug: string) => persist(items.filter((i) => i.slug !== slug)), [items, persist]);
  const clear = useCallback(() => persist([]), [persist]);
  const set = useCallback((next: CompareItem[]) => persist(next.slice(0, MAX_COMPARE)), [persist]);

  return <CompareContext.Provider value={{ items, has, toggle, remove, clear, set, ready }}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}
