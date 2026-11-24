import Link from "next/link";
import { BadgeCheck, Facebook, Headset, IndianRupee, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Twitter, Youtube } from "lucide-react";
import { getSettings } from "@/server/settings";
import { getMenu } from "@/server/services/navigation";
import { getCategoryTree } from "@/server/services/categories";
import { EnquireButton } from "./lead-dialog";
import { formatPhone } from "@/lib/countries";
import { makeT } from "@/lib/site-texts";
import { SITE_REGIONS } from "@/lib/edit-regions";
import { EditRegion } from "@/components/site/edit-mode";
import { CookieSettingsLink } from "./cookie-consent";
import { themedLogoUrl } from "@/lib/brand-logo";

const PROMISE_ICONS = [BadgeCheck, IndianRupee, Headset, ShieldCheck];

const FOOTER_MENUS = [
  { key: "footer.software", title: "footer.softwareTitle" },
  { key: "footer.resources", title: "footer.resourcesTitle" },
  { key: "footer.company", title: "footer.companyTitle" },
] as const;

export async function SiteFooter() {
  const [settings, tree, ...menus] = await Promise.all([getSettings(), getCategoryTree(), ...FOOTER_MENUS.map((m) => getMenu(m.key))]);
  const { site, theme, labels } = settings;
  const t = makeT(settings.texts);
  const promises = PROMISE_ICONS.map((Icon, i) => ({ Icon, title: t(`footer.promise${i + 1}Title`), text: t(`footer.promise${i + 1}Text`) })).filter((p) => p.title);
  const topCategories = tree.filter((c) => c.showInNav).slice(0, 8);
  const social = [
    { href: site.social.linkedin, label: "LinkedIn", Icon: Linkedin },
    { href: site.social.x, label: "X", Icon: Twitter },
    { href: site.social.facebook, label: "Facebook", Icon: Facebook },
    { href: site.social.instagram, label: "Instagram", Icon: Instagram },
    { href: site.social.youtube, label: "YouTube", Icon: Youtube },
  ].filter((s) => s.href);

  const columns = [
    ...(topCategories.length > 0 && !menus[0]?.length ? [{ key: "top", title: t("footer.topCategories"), items: topCategories.map((c) => ({ id: c.id, href: `/categories/${c.slug}`, label: c.name, newTab: false })) }] : []),
    ...FOOTER_MENUS.map((m, i) => ({ key: m.key, title: t(m.title), items: (menus[i] ?? []).map((it) => ({ id: it.id, href: it.href, label: it.label, newTab: Boolean(it.newTab) })) })).filter((c) => c.items.length),
  ];

  return (
    <>
      {/* Before the footer: expert-advice call-to-action and our promises (light section). */}
      {(t("footer.expertHeading") || promises.length > 0) && (
      <EditRegion {...SITE_REGIONS.expert}>
      <section className="container mt-8" aria-label={t("footer.expertHeading") || "Our promises"}>
        {/* Expert advice call-to-action */}
          {t("footer.expertHeading") && (
          <div className="relative overflow-hidden rounded-2xl text-white bg-[linear-gradient(120deg,rgb(var(--color-primary))_0%,rgb(var(--color-primary)/0.82)_100%)] px-5 py-5 shadow-[0_20px_40px_-24px_rgb(var(--color-primary)/0.6)] sm:px-7">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-white/10" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="hidden h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 sm:grid"><Headset className="h-5 w-5" aria-hidden /></span>
                <div>
                  <p className="font-display text-lg font-bold leading-tight sm:text-xl">{t("footer.expertHeading")}</p>
                  {t("footer.expertText") && <p className="mt-0.5 text-sm text-white/80">{t("footer.expertText")}</p>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {site.contactPhone && (
                  <a href={`tel:${site.contactPhone.replace(/\s/g, "")}`} className="inline-flex h-10 items-center gap-2 rounded-control border border-white/35 px-4 text-sm font-semibold transition hover:bg-white/10">
                    <Phone className="h-4 w-4" aria-hidden /> {formatPhone(site.contactPhone)}
                  </a>
                )}
                <EnquireButton type="QUOTE" source="GET_ADVICE" className="inline-flex h-10 items-center rounded-control bg-accent px-5 text-sm font-bold text-accent-fg transition hover:brightness-95">
                  {labels.enquireCta}
                </EnquireButton>
              </div>
            </div>
          </div>
          )}

          {/* Promises */}
          {promises.length > 0 && (
          <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {promises.map(({ Icon, title, text }) => (
              <li key={title} className="flex items-center gap-3 rounded-panel border border-line bg-surface px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight text-ink">{title}</span>
                  <span className="mt-0.5 hidden truncate text-xs text-muted sm:block">{text}</span>
                </span>
              </li>
            ))}
          </ul>
          )}

      </section>
      </EditRegion>
      )}

    <EditRegion {...SITE_REGIONS.footer}>
    <footer className="cg-footer relative mt-8 overflow-hidden bg-band text-white">
      {/* Soft brand glows */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full bg-primary/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />

      <div className="container relative">
        {/* Brand + link columns */}
        <div className="flex flex-col gap-8 py-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xs">
            <Link href="/" className="inline-flex items-center" aria-label={`${site.name} home`}>
              {/* The footer is dark, so it uses the logo for dark backgrounds (Website settings), or the Cadgram one. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG or uploaded logo of any shape */}
              <img src={themedLogoUrl(site.logoDarkUrl || "/brand/cadgram-logo-dark.svg", theme)!} alt={site.name} className="cg-logo-dark h-9 w-auto max-w-[12rem] object-contain object-left" />
              {/* Design 1 has a light footer, so it shows the normal logo instead. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG or uploaded logo of any shape */}
              <img src={themedLogoUrl(site.logoUrl || "/brand/cadgram-logo.svg", theme)!} alt="" aria-hidden className="cg-logo-light h-9 w-auto max-w-[12rem] object-contain object-left" />
            </Link>
            {site.tagline && <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">{site.tagline}</p>}
            <ul className="mt-4 space-y-1.5 text-sm text-white/70">
              {site.contactEmail && (
                <li><a href={`mailto:${site.contactEmail}`} className="inline-flex items-center gap-2 transition hover:text-accent"><Mail className="h-4 w-4 shrink-0" aria-hidden />{site.contactEmail}</a></li>
              )}
              {site.salesEmail && (
                <li><a href={`mailto:${site.salesEmail}`} className="inline-flex items-center gap-2 transition hover:text-accent"><Mail className="h-4 w-4 shrink-0" aria-hidden />{t("footer.salesPrefix")} {site.salesEmail}</a></li>
              )}
              {site.whatsappNumber && (
                <li><a href={`https://wa.me/${site.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noopener" className="inline-flex items-center gap-2 transition hover:text-accent"><MessageCircle className="h-4 w-4 shrink-0" aria-hidden />{t("footer.whatsappPrefix")} {formatPhone(site.whatsappNumber)}</a></li>
              )}
              {site.address && (
                <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{site.address}</span></li>
              )}
            </ul>
            {social.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2" aria-label={t("footer.followUs")}>
                {social.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 ring-1 ring-white/15 transition hover:bg-accent hover:text-accent-fg hover:ring-accent">
                      <Icon className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3 lg:gap-x-16">
          {columns.map((col) => (
            <nav key={col.key} aria-label={col.title}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/90">{col.title}</p>
              <span aria-hidden className="mt-2 block h-0.5 w-6 rounded-full bg-accent" />
              <ul className="mt-3.5 space-y-2">
                {col.items.map((it) => (
                  <li key={it.id}>
                    <Link href={it.href} target={it.newTab ? "_blank" : undefined} className="text-sm text-white/65 transition hover:text-accent">
                      {it.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-white/10">
        <div className="container flex flex-col gap-3 py-4 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {t("footer.copyright", { year: new Date().getFullYear(), company: site.legalName || site.name })}
            {theme.footerNote && <span className="hidden md:inline"> · {theme.footerNote}</span>}
          </p>
          {theme.footerNote && <p className="md:hidden">{theme.footerNote}</p>}
          <CookieSettingsLink className="self-start text-white/70 underline-offset-2 hover:text-white hover:underline sm:self-auto" />
        </div>
      </div>
    </footer>
    </EditRegion>
    </>
  );
}
