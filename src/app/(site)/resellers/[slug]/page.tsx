import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Award, BadgeCheck, Globe, MapPin } from "lucide-react";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/server/seo/metadata";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { EnquireButton } from "@/components/site/lead-dialog";
import { makeT } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";
import { PartnerNetwork } from "@/components/site/partner-network";

type Props = { params: Promise<{ slug: string }> };

const load = (slug: string) =>
  db.vendor.findFirst({
    where: { slug, isActive: true, kind: "RESELLER" },
    include: {
      logo: true,
      seo: { include: { ogImage: true } },
      authorisedProducts: {
        where: { software: { status: "PUBLISHED" } },
        orderBy: { software: { name: "asc" } },
        select: { partnerLevel: true, software: { select: { name: true, slug: true, tagline: true, logo: { select: { url: true } }, vendor: { select: { name: true } } } } },
      },
    },
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).slug);
  if (!r) return {};
  const t = await getT();
  const places = r.serviceCities.length ? r.serviceCities.slice(0, 3).join(", ") : r.city ?? "";
  const where = places ? t("resellerPage.metaIn", { places }) : "";
  return buildMetadata({
    path: `/resellers/${r.slug}`,
    noIndex: r.authorisedProducts.length === 0,
    title: t("resellerPage.metaTitle", { name: r.name, where }),
    description: r.description?.slice(0, 160) ?? t("resellerPage.metaDescription", { name: r.name, products: r.authorisedProducts.slice(0, 3).map((a) => a.software.name).join(", "), where }),
    seo: r.seo,
  });
}

export default async function ResellerPage({ params }: Props) {
  const r = await load((await params).slug);
  if (!r) notFound();
  const settings = await getSettings();
  const t = makeT(settings.texts);
  const path = `/resellers/${r.slug}`;
  return (
    <EditRegion label="Reseller page" actions={[{ label: "Edit resellers", href: "/admin/resellers" }, { label: "Page layout", href: "/admin/cms/layouts" }, { label: "Wording", href: "/admin/cms/texts?group=resellerPage" }]}>
    <div className="container py-8">
      <Breadcrumbs items={[{ name: t("resellerPage.breadcrumb"), path: "/become-a-reseller" }, { name: r.name, path }]} />
      <header className="mt-4 flex flex-col gap-5 rounded-panel border border-line bg-surface p-6 sm:flex-row sm:items-center">
        {r.logo && <Image src={r.logo.url} alt={t("resellerPage.logoAlt", { name: r.name })} width={88} height={88} className="h-20 w-20 rounded-control border border-line object-contain p-2" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t("resellerPage.eyebrow")}</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold">
            {r.name}
            {r.verification === "VERIFIED" && <BadgeCheck className="h-6 w-6 text-primary" aria-label={settings.labels.verifiedLabel} />}
          </h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {(r.city || r.state) && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden /> {[r.city, r.state].filter(Boolean).join(", ")}</span>}
            {r.foundedYear && <span>{t("resellerPage.founded", { year: r.foundedYear })}</span>}
            {r.website && (
              <a href={r.website} target="_blank" rel="noopener nofollow" className="flex items-center gap-1 text-primary hover:underline">
                <Globe className="h-4 w-4" aria-hidden /> {t("resellerPage.website")}
              </a>
            )}
          </p>
        </div>
        <EnquireButton softwareSlugs={r.authorisedProducts.slice(0, 4).map((a) => a.software.slug)} productName={t("resellerPage.quoteFor", { name: r.name })} source="PRODUCT_PAGE" className="h-11 rounded-xl bg-accent px-5 text-sm font-bold text-accent-fg hover:brightness-95">
          {t("resellerPage.quoteButton")}
        </EnquireButton>
      </header>
      {r.serviceCities.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{t("resellerPage.serves")}</span>
          {r.serviceCities.map((c) => <span key={c} className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink">{c}</span>)}
        </div>
      )}
      {r.description && <p className="mt-6 max-w-3xl whitespace-pre-line text-muted">{r.description}</p>}
      {r.authorisedProducts.length > 0 && (
        <div className="mt-8">
          <PartnerNetwork
            hubTitle={r.name}
            hubSub={t(r.authorisedProducts.length === 1 ? "resellerPage.networkHubOne" : "resellerPage.networkHub", { count: r.authorisedProducts.length })}
            nodes={r.authorisedProducts.map(({ software: s }) => ({ name: s.name, href: `/software/${s.slug}`, logo: s.logo?.url, kind: "reseller" as const, sub: s.vendor?.name ?? null }))}
            label={t("resellerPage.productsTitle", { name: r.name })}
            verifiedLabel={settings.labels.verifiedLabel}
          />
        </div>
      )}
      <h2 className="mb-4 mt-10 text-2xl font-semibold">{t("resellerPage.productsTitle", { name: r.name })}</h2>
      {r.authorisedProducts.length === 0 ? (
        <p className="text-muted">{t("resellerPage.noProducts")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.authorisedProducts.map(({ software: s, partnerLevel }) => (
            <li key={s.slug}>
              <Link href={`/software/${s.slug}`} className="group flex h-full gap-3 rounded-panel border border-line bg-surface p-4 hover:border-primary/40">
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small product logo
                    <img src={s.logo.url} alt="" className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <span className="text-base font-bold text-primary">{s.name.slice(0, 1)}</span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-semibold text-ink group-hover:text-primary">{s.name} <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></span>
                  <span className="block text-xs text-muted">{s.vendor ? t("resellerPage.by", { vendor: s.vendor.name }) : s.tagline}</span>
                  {partnerLevel && <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"><Award className="h-3 w-3" aria-hidden /> {partnerLevel}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
    </EditRegion>
  );
}
