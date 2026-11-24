"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { makeT, type T } from "@/lib/site-texts";

const Ctx = createContext<Record<string, string>>({});

/** Gives client components the wording saved in Pages › Website texts (only the changed entries travel). */
export function TextsProvider({ overrides, children }: { overrides: Record<string, string>; children: ReactNode }) {
  return <Ctx.Provider value={overrides}>{children}</Ctx.Provider>;
}

/** Website wording for client components: `const t = useT(); t("compare.tray.addMore")`. */
export function useT(): T {
  const o = useContext(Ctx);
  return useMemo(() => makeT(o), [o]);
}

/** One piece of website wording inside a server component that has no settings at hand: `<Tx k="card.free" />`. */
export function Tx({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  return <>{useT()(k, vars)}</>;
}
