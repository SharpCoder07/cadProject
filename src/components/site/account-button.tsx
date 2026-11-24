"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { useT } from "./texts";

type Me = { signedIn: false } | { signedIn: true; name: string; kind: "buyer" | "vendor" | "staff"; home: string };

/**
 * Header account button: "Login" for visitors, "My account" (or the dashboard for staff/vendors)
 * once signed in. Fetched after load so the cached page HTML is the same for everyone.
 */
export function AccountButton() {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/account/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Me | null) => alive && d && setMe(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const cls = "inline-flex h-10 items-center gap-1.5 rounded-control border border-primary px-4 text-sm font-semibold text-primary hover:bg-primary hover:text-primary-fg";
  if (me?.signedIn) {
    const label = me.kind === "buyer" ? t("header.myAccount") : me.kind === "vendor" ? t("header.vendorPortal") : t("header.dashboard");
    return (
      <Link href={me.home} className={cls} title={`Signed in as ${me.name}`}>
        <UserRound className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }
  return (
    <Link href="/login" className={cls}>
      <UserRound className="h-4 w-4" aria-hidden /> <span className="hidden sm:inline">{t("header.login")}</span>
    </Link>
  );
}
