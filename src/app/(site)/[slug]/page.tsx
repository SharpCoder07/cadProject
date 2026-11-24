import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Briefcase, CalendarClock, Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getPreviewPage, getPublishedPage, HOME_SLUG, pageSectionsFor, type PublicPage } from "@/server/services/cms";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/server/seo/metadata";
import { formatDate } from "@/lib/format";
import { Blocks } from "@/components/blocks/render";
import { LeadForm } from "@/components/site/lead-form";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { formatPhone } from "@/lib/countries";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";
import { LegalLayout } from "@/components/site/legal-layout";
import { publicLegalDocument } from "@/server/services/compliance/legal";
import { renderLegalDocument } from "./legal-document";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string; version?: string; legalPreview?: string }> };

async function load(slug: string, previewKey?: string): Promise<{ page: PublicPage; preview: boolean } | null> {
  if (slug === HOME_SLUG) return null; // homepage lives at /
  if (previewKey) {
    const page = await getPreviewPage(slug, previewKey);
    if (page) return { page, preview: page.status !== "PUBLISHED" };
  }
  const page = await getPublishedPage(slug);
  return page ? { page, preview: false } : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const legal = await publicLegalDocument(slug, sp.version);
  if (legal) return buildMetadata({ path: `/${legal.slug}`, title: legal.shown.title, seo: null, noIndex: legal.shown.id !== legal.current.id || Boolean(sp.legalPreview) });
  if (sp.legalPreview) return { robots: { index: false, follow: false } };
  const r = await load(slug, sp.preview);
  if (!r) return {};
  return buildMetadata({ path: `/${r.page.slug}`, title: r.page.title, seo: r.page.seo, noIndex: r.preview });
}

export default async function CmsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  // Compliance › Legal documents: a document in force takes over this address (and previews for staff).
  const legalPage = await renderLegalDocument(slug, sp.version, sp.legalPreview);
  if (legalPage) return legalPage;
  const r = await load(slug, sp.preview);
  if (!r) notFound();
  const { page, preview } = r;
  const t = await getT();
  const sections = await pageSectionsFor(page);
  const banner = preview ? <p className="bg-warning/15 py-2 text-center text-sm">{t("page.preview")}</p> : null;

  if (page.template === "LANDING") return <>{banner}<Blocks sections={sections} /></>;

  if (page.template === "CONTACT") {
    const s = await getSettings();
    return (
      <>
        {banner}
        <EditRegion label="Contact details & form" live={[{ kind: "site", id: "site", section: "all", title: "Contact details", only: ["contactPhone", "whatsappNumber", "contactEmail", "salesEmail", "address", "businessHours"] }, { kind: "texts", id: "page", section: "texts", title: "Wording", only: ["page.whatsapp", "page.sales", "page.contact*"] }, { kind: "labels", id: "labels", section: "all", title: "Form messages", only: ["leadSuccess"] }]} actions={[{ label: "Form fields", href: "/admin/cms/forms?form=enquiry" }]}>
        <div className="container py-10">
          <h1 className="text-3xl font-semibold sm:text-4xl">{page.title}</h1>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_1.3fr]">
            <div className="space-y-4 text-sm">
              {s.site.contactPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" aria-hidden /><a href={`tel:${s.site.contactPhone.replace(/\s/g, "")}`}>{formatPhone(s.site.contactPhone)}</a></p>}
              {s.site.whatsappNumber && <p className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" aria-hidden /><a href={`https://wa.me/${s.site.whatsappNumber.replace(/\D/g, "")}`} target="_blank" rel="noopener">{t("page.whatsapp", { number: formatPhone(s.site.whatsappNumber) })}</a></p>}
              {s.site.contactEmail && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" aria-hidden /><a href={`mailto:${s.site.contactEmail}`}>{s.site.contactEmail}</a></p>}
              {s.site.salesEmail && <p className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" aria-hidden /><span>{t("page.sales")} <a href={`mailto:${s.site.salesEmail}`}>{s.site.salesEmail}</a></span></p>}
              {s.site.address && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-primary" aria-hidden />{s.site.address}</p>}
              {s.site.businessHours && <p className="flex items-center gap-2 text-muted"><Clock className="h-4 w-4 text-primary" aria-hidden />{s.site.businessHours}</p>}
            </div>
            <div className="rounded-panel border border-line bg-surface p-6">
              <LeadForm source="CONTACT_PAGE" config={{ consentText: s.leads.consentText, companySizes: s.leads.companySizes, successMessage: s.labels.leadSuccess, submitLabel: t("page.contactSubmit"), requireCompany: false }} requirementPlaceholder={t("page.contactPlaceholder")} />
            </div>
          </div>
        </div>
        </EditRegion>
        <Blocks sections={sections} />
      </>
    );
  }

  const header = (
    <EditRegion label="Page title" actions={[{ label: "Edit title & SEO", href: `/admin/cms/pages/${page.id}?tab=settings` }]}>
    <header className="border-b border-line bg-[linear-gradient(180deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-bg))_100%)]">
      <div className="container py-8 sm:py-10">
        <Breadcrumbs items={[{ name: page.title, path: `/${page.slug}` }]} />
        <h1 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[2.6rem]">{page.title}</h1>
        {page.seo?.description && page.template !== "LEGAL" && <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{page.seo.description}</p>}
        {page.template === "LEGAL" && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {t("page.lastUpdated", { date: formatDate(page.updatedAt) })}
          </p>
        )}
      </div>
    </header>
    </EditRegion>
  );

  if (page.template === "LEGAL") {
    const s = await getSettings();
    // Text blocks become the document; their headings become the "On this page" list. Other blocks follow below.
    const texts = sections.filter((x) => x.type === "RICH_TEXT" && typeof x.data.html === "string" && x.data.html);
    const rest = sections.filter((x) => !texts.includes(x));
    return (
      <>
        {banner}
        <LegalLayout
          t={t}
          title={page.title}
          path={`/${page.slug}`}
          dateLine={t("page.lastUpdated", { date: formatDate(page.updatedAt) })}
          html={texts.map((x) => String(x.data.html)).join("")}
          email={s.site.contactEmail}
          editActions={[{ label: "Edit text sections", href: `/admin/cms/pages/${page.id}` }, { label: "Edit title & SEO", href: `/admin/cms/pages/${page.id}?tab=settings` }]}
          editLive={[{ kind: "site", id: "site", section: "all", title: "Contact email", only: ["contactEmail"] }, { kind: "texts", id: "page", section: "texts", title: "Wording", only: ["page.onThisPage", "page.questions*", "page.lastUpdated"] }]}
        />
        <Blocks sections={rest} />
      </>
    );
  }

  return (
    <>
      {banner}
      {header}
      <div className="pt-2">
        <Blocks sections={sections} />
      </div>
    </>
  );
}
