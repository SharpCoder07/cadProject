import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { homeFor } from "@/server/rbac/permissions";
import { cn } from "@/lib/utils";
import { LoginForm, type LoginAudience } from "../forms";

export const metadata = { title: "Sign in" };

const AUDIENCES: { key: LoginAudience; label: string; title: string; text: string }[] = [
  { key: "buyer", label: "Buyer", title: "Welcome back", text: "Sign in to save favourites, get offer alerts and write reviews." },
  { key: "vendor", label: "Vendor", title: "Vendor sign in", text: "Manage your product listings, enquiries, offers and reviews." },
  { key: "reseller", label: "Reseller", title: "Reseller sign in", text: "Find products to resell and follow up on enquiries in your area." },
  { key: "team", label: "Team", title: "Team sign in", text: "Sign in to the admin panel to manage the marketplace." },
];

/**
 * One sign-in for everyone (same accounts behind every tab); the tab only changes the wording and
 * links. ?as=vendor|reseller|team picks a tab; a ?next= into /admin, /vendor or /reseller picks it automatically.
 */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; as?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user.roleKey, user.vendorId));
  const { next, as } = await searchParams;
  const guessed: LoginAudience = next?.startsWith("/admin") ? "team" : next?.startsWith("/reseller") ? "reseller" : next?.startsWith("/vendor") ? "vendor" : "buyer";
  const audience = AUDIENCES.find((a) => a.key === as)?.key ?? guessed;
  const current = AUDIENCES.find((a) => a.key === audience)!;
  const href = (key: LoginAudience) => {
    const p = new URLSearchParams();
    if (key !== "buyer") p.set("as", key);
    if (next) p.set("next", next);
    return p.size ? `/login?${p}` : "/login";
  };
  return (
    <>
      <nav aria-label="Sign in as" className="mb-7 grid grid-cols-4 gap-1 rounded-xl bg-bg p-1 ring-1 ring-line">
        {AUDIENCES.map((a) => (
          <Link
            key={a.key}
            href={href(a.key)}
            replace
            scroll={false}
            aria-current={a.key === audience ? "page" : undefined}
            className={cn(
              "flex h-9 items-center justify-center rounded-lg text-sm font-semibold transition",
              a.key === audience ? "bg-surface text-ink shadow-[0_1px_3px_rgb(16_24_40/0.12)] ring-1 ring-line" : "text-muted hover:text-ink",
            )}
          >
            {a.label}
          </Link>
        ))}
      </nav>
      <h1 className="font-display text-[2rem] font-extrabold leading-tight tracking-[-0.02em] text-ink">{current.title}</h1>
      <p className="mb-6 mt-1.5 text-sm text-muted">{current.text}</p>
      <LoginForm next={next} audience={audience} />
    </>
  );
}
