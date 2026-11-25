import { getSettings } from "@/server/settings";
import { ThemeStyle } from "@/components/site/theme-style";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CompareProvider } from "@/components/site/compare-context";
import { CompareTray } from "@/components/site/compare-controls";
import { LeadDialogProvider } from "@/components/site/lead-dialog";
import { CookieConsent } from "@/components/site/cookie-consent";
import { HelpChat } from "@/components/site/help-chat";
import { publicCookieCategories } from "@/server/services/compliance/cookies";
import { JsonLd } from "@/components/site/json-ld";
import { EditModeProvider } from "@/components/site/edit-mode";
import { SiteMotion } from "@/components/site/motion";
import { organizationLd, websiteLd } from "@/server/seo/jsonld";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, cookieCategories] = await Promise.all([getSettings(), publicCookieCategories().catch(() => [])]);
  const { labels, leads, site } = settings;
  // Older cached settings may not have the cookie fields yet.
  const privacy = settings.compliance ?? ({} as Partial<typeof settings.compliance>);
  // Older cached settings may not have it yet.
  const motion = settings.theme.animations ?? "full";
  return (
    <>
      <ThemeStyle theme={settings.theme} />
      {/* The website keeps its brand colour for focused search boxes and fields (mint is for the panels). */}
      <style>{":root{--color-mint:var(--color-primary);--color-mint-soft:var(--color-primary-soft);--color-mint-ink:var(--color-primary)}"}</style>
      <JsonLd data={[organizationLd(site), websiteLd(site.name)]} />
      <CompareProvider>
        <LeadDialogProvider
          title={labels.leadFormTitle}
          subtitle={labels.leadFormSubtitle}
          config={{ consentText: leads.consentText, companySizes: leads.companySizes, successMessage: labels.leadSuccess, submitLabel: labels.enquireCta, requireCompany: leads.requireCompany }}
        >
          <EditModeProvider styles={settings.regionStyles}>
            {/* Animations setting (Design & theme): styles in app/motion.css, runtime in components/site/motion.tsx. */}
            <div
              // Marks the public website, so its page scrollbar can be shown thin (app/globals.css).
              data-site-root=""
              data-motion={motion}
              data-design={settings.theme.design ?? "classic"}
              // Fresh Lime Design uses the reference's exact greens with the Lime & Forest Green Color theme, else the theme's own colours.
              data-d1-tint={settings.theme.primary.toLowerCase() === "#00301e" && settings.theme.accent.toLowerCase() === "#cdf757" ? "lime" : "theme"}
              className="contents"
            >
              <SiteHeader />
              <main id="main" className="min-h-[60vh]">{children}</main>
              <SiteFooter />
            </div>
            <SiteMotion level={motion} />
          </EditModeProvider>
          <CompareTray ctaLabel={labels.compareCta} />
          {/* Help chat (Website settings › Help chat): answers from the FAQs and the catalogue; older cached settings may not have it yet. */}
          {(settings.chat?.enabled ?? true) && settings.chat && <HelpChat config={settings.chat} whatsappNumber={site.whatsappNumber} businessHours={site.businessHours} />}
        </LeadDialogProvider>
      </CompareProvider>
      {/* Cookie banner + tracking scripts, which only load after the visitor allows them (Compliance & Privacy › Cookies). */}
      <CookieConsent
        categories={cookieCategories}
        version={privacy.cookieNoticeVersion || "1.0"}
        days={privacy.consentCookieDays ?? 180}
        bannerOn={privacy.cookieBannerEnabled ?? true}
        analytics={settings.analytics}
      />
    </>
  );
}
