"use client";

import { useEffect } from "react";

/** Counts one product view per tab session (pages are cached, so counting must happen client-side). */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const key = `cg_viewed_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
    const url = `/api/software/${encodeURIComponent(slug)}/view`;
    if (!navigator.sendBeacon?.(url)) void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
  }, [slug]);
  return null;
}
