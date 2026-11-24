"use client";

import { useEffect } from "react";

/**
 * Keeps the address bar on /reseller/… for resellers and /vendor/… for vendors (both show the same
 * partner-portal pages). Also stores the choice in a cookie for sessions that started before it existed.
 */
export function PortalAddress({ reseller }: { reseller: boolean }) {
  useEffect(() => {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = reseller ? `cg_portal=reseller; path=/; SameSite=Lax${secure}` : `cg_portal=; path=/; max-age=0; SameSite=Lax${secure}`;
    const { pathname, search, hash } = window.location;
    const from = reseller ? /^\/vendor(?=\/|$)/ : /^\/reseller(?=\/|$)/;
    if (from.test(pathname)) window.history.replaceState(window.history.state, "", pathname.replace(from, reseller ? "/reseller" : "/vendor") + search + hash);
  });
  return null;
}
