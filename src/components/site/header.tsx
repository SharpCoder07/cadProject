import Image from "next/image";
import Link from "next/link";
import { getSettings } from "@/server/settings";
import { getMenu, getActiveAnnouncements } from "@/server/services/navigation";
import { getCategoryTree } from "@/server/services/categories";
import { Headset, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchBox } from "./search-box";
import { CategoriesMenu, DesktopMenu, MobileMenu, type NavCategory } from "./header-nav";
import { EnquireButton } from "./lead-dialog";
import { AccountButton } from "./account-button";
import { formatPhone } from "@/lib/countries";
import { makeT } from "@/lib/site-texts";
import { SITE_REGIONS } from "@/lib/edit-regions";
import { EditRegion } from "@/components/site/edit-mode";
import { themedLogoUrl } from "@/lib/brand-logo";
import { luminance } from "@/lib/theme";
import { searchExamples } from "@/lib/search-examples";

/** Standard announcements in the Accent colour: when chosen, or automatically when Primary is nearly black. */
const announcementUsesAccent = (t: { announcementColor?: string; primary: string }) =>
  t.announcementColor === "accent" || ((t.announcementColor ?? "auto") === "auto" && luminance(t.primary) < 0.03);

export async function SiteHeader() {
  const [settings, menu, tree, announcements] = await Promise.all([getSettings(), getMenu("header"), getCategoryTree(), getActiveAnnouncements()]);
  const { site, theme, labels } = settings;
  const t = makeT(settings.texts);
  const categories: NavCategory[] = tree
    .filter((c) => c.showInNav)
    .map((c) => ({ id: c.id, name: c.name, slug: c.slug, icon: c.icon, children: c.children.filter((x) => x.showInNav).map((x) => ({ id: x.id, name: x.name, slug: x.slug })) }));
  const announcement = theme.showAnnouncementBar ? announcements[0] : undefined;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2">
        {t("header.skip")}
      </a>
      {announcement && (
        <EditRegion {...SITE_REGIONS.announcement}>
        <div className={cn("text-center text-sm", announcement.variant === "promo" || (announcement.variant !== "warning" && announcementUsesAccent(theme))
            ? "bg-accent bg-[linear-gradient(96deg,rgb(255_255_255/0.22)_0%,transparent_45%,rgb(0_0_0/0.06)_100%)] text-accent-fg"
            : announcement.variant === "warning" ? "bg-warning text-white" : "bg-primary text-primary-fg")}>
          <p className="container py-2">
            {announcement.message}
            {announcement.linkUrl && (
              <Link href={announcement.linkUrl} className="ml-2 font-semibold underline underline-offset-2">
                {announcement.linkLabel || t("header.announcementLink")}
              </Link>
            )}
          </p>
        </div>
        </EditRegion>
      )}
      <header className="cg-header sticky top-0 z-30 border-b border-line bg-surface shadow-[0_2px_12px_-8px_rgb(var(--color-ink)/0.25)]">
        <EditRegion {...SITE_REGIONS.header}>
        <div className={cn("container flex items-center gap-3 lg:gap-6", theme.headerStyle === "compact" ? "h-14" : "h-16 lg:h-[4.5rem]")}>
          <MobileMenu items={menu} categories={categories} />
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label={`${site.name} home`}>
            {site.logoUrl ? (
              // The built-in logo takes the theme's colours (lib/brand-logo.ts); uploaded logos show as they are.
              <Image src={themedLogoUrl(site.logoUrl, theme)!} alt={site.name} width={150} height={36} className="h-8 w-auto lg:h-9" priority />
            ) : (
              <>
                <span className="grid h-9 w-9 place-items-center rounded-control bg-primary font-display text-lg font-bold text-primary-fg" aria-hidden>
                  {site.name.slice(0, 1)}
                </span>
                <span className="font-display text-xl font-extrabold tracking-tight text-primary">{site.name}</span>
              </>
            )}
          </Link>
          <SearchBox
            placeholder={t("header.searchPlaceholder", { placeholder: labels.searchPlaceholder })}
            hints={searchExamples(labels)}
            className="hidden max-w-2xl flex-1 md:block"
            inputClassName="h-11 rounded-control bg-bg/60 focus:bg-surface"
          />
          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            {site.contactPhone && (
              <a href={`tel:${site.contactPhone.replace(/\s/g, "")}`} className="hidden items-center gap-2.5 rounded-control px-2 py-1 xl:flex">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary">
                  <Headset className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span className="leading-tight">
                  <span className="block text-[11px] text-muted">{t("header.expertLabel")}</span>
                  <span className="block text-sm font-bold text-ink">{formatPhone(site.contactPhone)}</span>
                </span>
              </a>
            )}
            {t("header.listSoftware") && (
              <Link href={t("header.listSoftwareUrl") || "/list-your-software"} className="hidden h-10 items-center rounded-control px-3 text-sm font-semibold text-ink hover:text-primary lg:inline-flex">
                {t("header.listSoftware")}
              </Link>
            )}
            <AccountButton />
          </div>
        </div>
        </EditRegion>
        <div className="container pb-3 md:hidden">
          <SearchBox placeholder={t("header.searchPlaceholder", { placeholder: labels.searchPlaceholder })} hints={searchExamples(labels)} inputClassName="rounded-control bg-bg/60 focus:bg-surface" />
        </div>
        <EditRegion {...SITE_REGIONS.menuBar}>
        <nav className="cg-nav hidden border-t border-line lg:block" aria-label="Main">
          <div className="container flex h-12 items-center gap-1">
            {categories.length > 0 && <CategoriesMenu categories={categories} label={t("header.categories")} />}
            <DesktopMenu items={menu} />
            <EnquireButton type="QUOTE" source="GET_ADVICE" className="cg-glow ml-auto inline-flex h-9 items-center gap-1.5 rounded-control bg-accent px-4 text-sm font-semibold text-accent-fg hover:brightness-95">
              <Sparkles className="h-4 w-4" aria-hidden /> {labels.enquireCta}
            </EnquireButton>
          </div>
        </nav>
        </EditRegion>
      </header>
    </>
  );
}
