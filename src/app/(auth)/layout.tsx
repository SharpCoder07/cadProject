import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Headset, IndianRupee, ShieldCheck } from "lucide-react";
import { getSettings } from "@/server/settings";
import { siteStats } from "@/server/services/catalog";
import { AuthDoodles, CountUp } from "./showcase";
import { ThemeStyle } from "@/components/site/theme-style";
import { AuthBackLink } from "./back-link";
import { makeT } from "@/lib/site-texts";
import { themedLogoUrl } from "@/lib/brand-logo";

export const metadata = { robots: { index: false, follow: false } };

const POINT_ICONS = [BadgeCheck, IndianRupee, ShieldCheck, Headset];

const compact = (n: number) => (n >= 1000 ? `${Math.floor(n / 100) / 10}k+` : n >= 10 ? `${Math.floor(n / 10) * 10}+` : String(n));

/** Sign in / sign up / password pages: brand panel on the left (desktop), form card on the right. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [settings, stats] = await Promise.all([getSettings(), siteStats().catch(() => null)]);
  const { site, theme } = settings;
  const t = makeT(settings.texts);
  const points = POINT_ICONS.map((Icon, i) => ({ Icon, title: t(`auth.point${i + 1}Title`), text: t(`auth.point${i + 1}Text`) })).filter((p) => p.title);
  const figures = stats
    ? [
        { value: compact(stats.products), label: t("auth.statProducts") },
        { value: compact(stats.categories), label: t("auth.statCategories") },
        { value: compact(stats.reviews), label: t("auth.statReviews") },
      ].filter((f) => f.value !== "0")
    : [];
  const logo = (
    <Link href="/" className="inline-flex items-center" aria-label={`${site.name} home`}>
      {site.logoUrl ? (
        <Image src={themedLogoUrl(site.logoUrl, theme)!} alt={site.name} width={180} height={44} className="h-10 w-auto" priority />
      ) : (
        <span className="font-display text-2xl font-bold text-primary">{site.name}</span>
      )}
    </Link>
  );

  return (
    <>
      <ThemeStyle theme={settings.theme} />
      {/* The website keeps its brand colour for focused search boxes and fields (mint is for the panels). */}
      <style>{":root{--color-mint:var(--color-primary);--color-mint-soft:var(--color-primary-soft);--color-mint-ink:var(--color-primary)}"}</style>
      <div className="grid min-h-screen bg-bg lg:h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:overflow-hidden">
        {/* Brand panel */}
        <aside className="relative hidden overflow-hidden bg-[linear-gradient(150deg,rgb(var(--color-band))_0%,rgb(var(--color-primary))_115%)] text-white lg:flex lg:h-screen lg:flex-col">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.06)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)]" />
          <AuthDoodles />
          <div aria-hidden className="cg-auth-glow pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent/25 blur-3xl" />
          <div aria-hidden className="cg-auth-glow pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-primary/40 blur-3xl" style={{ animationDelay: "-6s" }} />

          {/* Scrolls (scrollbar hidden) rather than cutting off the top or bottom on short screens; auto margins centre it when it fits. */}
          <div className="cg-auth-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto px-10 py-8 xl:px-14">
          <div className="cg-auth-in relative my-auto max-w-md">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{t("auth.eyebrow")}</p>
            <h2 className="mt-3 font-display text-[2.4rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-white">{t("auth.heading")}</h2>
            <ul className="mt-8 space-y-4">
              {points.map(({ Icon, title, text }) => (
                <li key={title} className="flex items-start gap-3.5">
                  <span className="cg-auth-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-accent ring-1 ring-white/15"><Icon className="h-5 w-5" aria-hidden /></span>
                  <span>
                    <span className="block font-semibold text-white">{title}</span>
                    <span className="block text-sm text-white/70">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
            {figures.length > 0 && (
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-3 border-t border-white/10 pt-8">
              {figures.map((f) => (
                <div key={f.label} className="rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10 backdrop-blur-sm">
                  <dd className="font-display text-2xl font-extrabold text-white tabular-nums"><CountUp value={f.value} /></dd>
                  <dt className="mt-0.5 text-xs text-white/65">{f.label}</dt>
                </div>
              ))}
            </dl>
            )}
          </div>
          </div>
        </aside>

        {/* Form side */}
        {/* Centred with auto margins (not justify-center), so a tall step — like the authenticator setup —
            scrolls from its top instead of being cut off above the screen. */}
        <main className="relative flex flex-col bg-surface px-6 py-10 sm:px-12 lg:h-screen lg:overflow-y-auto lg:px-16 lg:py-10 xl:px-24 [@media(min-width:1024px)_and_(max-height:800px)]:py-5">
          <AuthBackLink siteName={site.name} />
          {/* The form uses the whole right side: no card, just the logo, heading and fields. */}
          <div className="mx-auto my-auto w-full max-w-[30rem]">
            <div className="mb-8 [@media(max-height:800px)]:mb-5">{logo}</div>
            <div className="[&_button[type=submit]]:h-10 [&_input:not([type=checkbox]):not([type=radio])]:h-10 [&_input]:py-0 [&_input]:text-sm">{children}</div>
          </div>
        </main>
      </div>
    </>
  );
}
