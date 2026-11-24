"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/site/texts";

type Status = { signedIn: boolean; eligible: boolean; favourited: boolean; softwareId: string | null };

/**
 * Heart toggle on a public product page. Buyers save the product to their favourites (and get
 * emailed about offers); signed-out visitors are sent to sign in first. Staff and vendor accounts
 * don't see it. The state is fetched after load, so the cached page stays the same for everyone.
 */
export function FavouriteButton({ slug }: { slug: string }) {
  const tx = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/account/favourites?slug=${encodeURIComponent(slug)}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Status | null) => {
        if (alive && d?.eligible) setState(d);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [slug]);

  if (!state) return null;

  const toggle = async () => {
    if (!state.signedIn || !state.softwareId) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    const on = !state.favourited;
    setBusy(true);
    setState({ ...state, favourited: on });
    const res = await fetch("/api/account/favourites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ softwareId: state.softwareId, on }) }).catch(() => null);
    if (!res?.ok) setState({ ...state, favourited: !on });
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={state.favourited}
      title={
        !state.signedIn
          ? tx("site.favSignIn")
          : state.favourited
            ? tx("site.favOn")
            : tx("site.favOff")
      }
      className={cn("inline-flex items-center gap-1.5 text-sm transition-colors", state.favourited ? "text-danger" : "text-muted hover:text-danger")}
    >
      <Heart className={cn("h-4 w-4", state.favourited && "fill-current")} aria-hidden />
      {state.favourited ? tx("site.favourited") : tx("site.favourite")}
    </button>
  );
}
