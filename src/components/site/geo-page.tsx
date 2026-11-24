import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { buildMetadata } from "@/server/seo/metadata";
import { faqLd } from "@/server/seo/jsonld";
import { cardsByIds, getPublishedSoftware } from "@/server/services/catalog";
import { getBrandGeoPage, getProductGeoPage } from "@/server/services/geo";
import { formatPrice, toNumber } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { Breadcrumbs } from "./breadcrumbs";
import { JsonLd } from "./json-ld";
import { EnquireButton } from "./lead-dialog";
import { LeadForm } from "./lead-form";
import { SoftwareLogo, SoftwareTile } from "./software-card";
import { makeT, type T } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { pricingLabel } from "@/lib/enum-labels";
import { CITY_COORDS } from "@/lib/city-coords";
import { EditRegion } from "@/components/site/edit-mode";

type BrandProps = { params: Promise<{ slug: string; sub: string }> };
type ProductProps = { params: Promise<{ slug: string; sub: string; item: string }> };

function Faqs({ faqs, t }: { faqs: { question: string; answer: string }[]; t: T }) {
  if (!faqs.length) return null;
  return (
    <section>
      <JsonLd data={faqLd(faqs)} />
      <h2 className="mb-4 text-[1.45rem] font-bold">{t("geo.faqTitle")}</h2>
      <div className="divide-y divide-line rounded-panel border border-line bg-surface">
        {faqs.map((f) => (
          <details key={f.question} className="px-5 py-4">
            <summary className="cursor-pointer list-none font-medium marker:hidden">{f.question}</summary>
            <p className="mt-2 whitespace-pre-line text-muted">{f.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// Pin spots on the map (% of width / height), away from the centre pin and the caption.
const PIN_SPOTS: [number, number][] = [[24, 30], [74, 26], [80, 62], [30, 72], [56, 18], [16, 52], [64, 80], [88, 40]];

/**
 * Service area (design concept 15 "pin drop"): pins drop onto a map, bounce and ripple. The place itself is the amber
 * pin; teal pins are its business areas, or, when it has none, the other cities this page also exists for (as links).
 */
function ServiceArea({ location, t, others = [] }: { location: { name: string; slug: string; pinCodes: string[]; businessZones: string[]; latitude?: number | null; longitude?: number | null }; t: T; others?: { name: string; slug: string; href: string; lat?: number | null; lng?: number | null }[] }) {
  const useCities = !location.businessZones.length;
  if (!location.pinCodes.length && !location.businessZones.length && !others.length) return null;
  const pins: { name: string; href?: string }[] = useCities ? others.slice(0, PIN_SPOTS.length) : location.businessZones.slice(0, PIN_SPOTS.length).map((name) => ({ name }));
  const zones = pins;
  // Other cities with coordinates sit where they really are (north up), scaled to fit the map; the rest use fixed spots.
  const at = (slug: string, lat?: number | null, lng?: number | null) => (lat != null && lng != null ? { lat, lng } : CITY_COORDS[slug] ? { lat: CITY_COORDS[slug]![0], lng: CITY_COORDS[slug]![1] } : { lat: null, lng: null });
  const here = at(location.slug, location.latitude, location.longitude);
  const geo = useCities && here.lat != null ? [here, ...others.slice(0, PIN_SPOTS.length).map((o) => at(o.slug, o.lat, o.lng))] : null;
  const known = geo?.filter((g): g is { lat: number; lng: number } => g.lat != null && g.lng != null) ?? [];
  const spot = (i: number): [number, number] => {
    const g = geo?.[i];
    if (!g || g.lat == null || g.lng == null || known.length < 2) return i === 0 ? [48, 46] : PIN_SPOTS[i - 1]!;
    const lats = known.map((k) => k.lat);
    const lngs = known.map((k) => k.lng);
    const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
    const x = maxLng - minLng < 0.01 ? 50 : 14 + ((g.lng - minLng) / (maxLng - minLng)) * 72;
    const y = maxLat - minLat < 0.01 ? 46 : 18 + ((maxLat - g.lat) / (maxLat - minLat)) * 58;
    return [x, y];
  };
  return (
    <section className="rounded-panel border border-line bg-surface p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><MapPin className="h-5 w-5 text-primary" aria-hidden />{t("geo.serving", { place: location.name })}</h2>
      <div data-play data-no-motion className="cg-geo-map relative mt-4 h-64 overflow-hidden rounded-[18px] bg-primary-soft [background-image:linear-gradient(rgb(var(--color-primary)/0.08)_1px,transparent_1px),linear-gradient(90deg,rgb(var(--color-primary)/0.08)_1px,transparent_1px)] [background-size:34px_34px]">
        <span aria-hidden className="absolute -left-10 top-10 h-48 w-72 rounded-full bg-surface/60" />
        <span aria-hidden className="absolute -bottom-8 -right-14 h-52 w-80 rounded-full bg-surface/55" />
        <span aria-hidden className="absolute inset-x-0 top-[58%] h-2.5 -rotate-[8deg] bg-surface/90" />
        <span aria-hidden className="absolute bottom-0 left-[38%] top-0 w-2 rotate-[14deg] bg-surface/80" />
        {[{ name: location.name, href: undefined as string | undefined, x: spot(0)[0], y: spot(0)[1], main: true }, ...zones.map((z, i) => ({ name: z.name, href: z.href, x: spot(i + 1)[0], y: spot(i + 1)[1], main: false }))].map((p, i) => (
          <span key={`${p.name}-${i}`} className={`cg-pin-wrap absolute ${p.main ? "z-10" : ""}`} style={{ left: `${p.x}%`, top: `${p.y}%`, ["--i" as string]: i }}>
            <span aria-hidden className={`cg-pin-rip absolute left-0 top-0 h-6 w-6 rounded-full border-2 [translate:-50%_-50%] ${p.main ? "border-accent" : "border-primary"}`} />
            <svg aria-hidden viewBox="0 0 30 38" className={`cg-pin absolute bottom-0 left-0 ${p.main ? "h-11 w-9" : "h-8 w-[26px]"} [translate:-50%_0]`}>
              <path d="M15 37s13-12 13-22A13 13 0 0 0 2 15c0 10 13 22 13 22z" fill={p.main ? "rgb(var(--color-accent))" : "rgb(var(--color-primary))"} />
              <circle cx="15" cy="15" r="5" fill="#fff" />
            </svg>
            {p.href ? (
              <Link href={p.href} className="cg-pin-label absolute left-0 top-1.5 whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink shadow-[0_6px_14px_-10px_rgb(var(--color-ink)/0.6)] [translate:-50%_0] hover:text-primary">{p.name}</Link>
            ) : (
              <span className={`cg-pin-label absolute left-0 top-1.5 whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink shadow-[0_6px_14px_-10px_rgb(var(--color-ink)/0.6)] [translate:-50%_0] ${p.main ? "text-[12px] font-extrabold" : ""}`}>{p.name}</span>
            )}
          </span>
        ))}
        {zones.length > 0 && <span className="absolute bottom-3 left-3 z-20 rounded-xl bg-surface px-3 py-1.5 text-[12.5px] font-bold text-ink shadow-[0_10px_20px_-14px_rgb(var(--color-ink)/0.6)]">{useCities ? t(zones.length === 1 ? "geo.mapCitiesOne" : "geo.mapCities", { count: zones.length, place: location.name }) : t(zones.length === 1 ? "geo.mapCaptionOne" : "geo.mapCaption", { count: zones.length, place: location.name })}</span>}
      </div>
      {location.businessZones.length > 0 && <p className="mt-3 text-sm text-muted">{t("geo.businessAreas", { areas: location.businessZones.join(", ") })}</p>}
      {location.pinCodes.length > 0 && <p className="mt-1 text-sm text-muted">{t("geo.pinCodes", { codes: location.pinCodes.slice(0, 40).join(", ") + (location.pinCodes.length > 40 ? "…" : "") })}</p>}
    </section>
  );
}

function OtherCities({ title, items, href }: { title: string; items: { name: string; slug: string }[]; href: (slug: string) => string }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((c) => <li key={c.slug}><Link href={href(c.slug)} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm hover:border-primary hover:text-primary"><MapPin className="h-3.5 w-3.5" aria-hidden />{c.name}</Link></li>)}
      </ul>
    </section>
  );
}

function Hero({ eyebrow, title, text, crumbs, logo, aside, t }: { t: T; eyebrow: string; title: string; text: string; crumbs: { name: string; path: string }[]; logo: React.ReactNode; aside: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-surface">
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-[90px]" />
      <div className="container relative py-7 sm:py-10">
        <Breadcrumbs items={crumbs} />
        <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-center">
          <div className="flex gap-5">
            {logo}
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.08em] text-primary"><MapPin className="h-4 w-4" aria-hidden />{eyebrow}</p>
              <h1 className="mt-1 text-[2rem] font-bold leading-tight tracking-[-0.02em] sm:text-[2.5rem]">{title}</h1>
              {text && <p className="mt-3 max-w-2xl text-lg text-muted">{text}</p>}
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {t("geo.promise1") && <li className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden />{t("geo.promise1")}</li>}
                {t("geo.promise2") && <li className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-primary" aria-hidden />{t("geo.promise2")}</li>}
                {t("geo.promise3") && <li className="inline-flex items-center gap-1.5"><Phone className="h-4 w-4 text-primary" aria-hidden />{t("geo.promise3")}</li>}
              </ul>
            </div>
          </div>
          {aside}
        </div>
      </div>
    </div>
  );
}

// ─── Brand: /{location}/{vendor} ─────────────────────────────────────────────

export async function brandGeoMetadata({ params }: BrandProps): Promise<Metadata> {
  const { slug, sub } = await params;
  const r = await getBrandGeoPage(slug, sub);
  if (!r) return {};
  const t = await getT();
  return buildMetadata({
    path: `/${slug}/${sub}`,
    title: r.page.seoTitle || t("geo.brandMetaTitle", { name: r.vendor.name, city: r.ctx.city }),
    description: r.page.seoDescription || r.sections.hero || r.sections.introduction,
    image: r.vendor.logo?.url,
    noIndex: r.page.noIndex,
  });
}

export async function BrandGeoPage({ params }: BrandProps) {
  const { slug, sub } = await params;
  const r = await getBrandGeoPage(slug, sub);
  if (!r) notFound();
  const { vendor, location, sections, settings } = r;
  const products = await cardsByIds(r.productIds);
  const t = makeT(settings.texts);
  const leadConfig = { consentText: settings.leads.consentText, companySizes: settings.leads.companySizes, successMessage: settings.labels.leadSuccess, submitLabel: settings.labels.enquireCta, requireCompany: settings.leads.requireCompany };
  return (
    <EditRegion label="Local brand page" actions={[{ label: "Edit geo pages", href: "/admin/geo/pages" }, { label: "Geo settings & templates", href: "/admin/geo/settings" }]}>
    <>
      <Hero
        eyebrow={location.cityLabel}
        title={t("geo.brandHeading", { name: vendor.name, city: r.ctx.city })}
        t={t}
        text={sections.hero}
        crumbs={[{ name: t("geo.vendorsCrumb"), path: "/vendors" }, { name: vendor.name, path: `/vendors/${vendor.slug}` }, { name: location.name, path: `/${location.slug}/${vendor.slug}` }]}
        logo={<SoftwareLogo logo={vendor.logo ? { url: vendor.logo.url, alt: vendor.logo.alt } : null} name={vendor.name} size={88} />}
        aside={
          <div className="rounded-panel border border-line bg-surface p-5 shadow-[0_20px_48px_-28px_rgb(var(--color-ink)/0.45)]">
            <p className="font-semibold">{t("geo.brandExpert", { name: vendor.name, city: r.ctx.city })}</p>
            <p className="mt-1 text-sm text-muted">{t("geo.brandExpertText")}</p>
            <EnquireButton softwareSlugs={products.map((p) => p.slug).slice(0, 5)} productName={vendor.name} source="GET_ADVICE" title={t("geo.brandHeading", { name: vendor.name, city: r.ctx.city })} className="mt-4 h-11 w-full rounded-full bg-accent text-sm font-semibold text-accent-fg hover:brightness-95">
              {t("geo.quoteButton")}
            </EnquireButton>
          </div>
        }
      />
      <div className="container grid gap-10 py-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-12">
          {sections.introduction && <p className="whitespace-pre-line text-lg leading-relaxed text-ink/85">{sections.introduction}</p>}
          {products.length > 0 && (
            <section>
              <h2 className="mb-4 text-[1.45rem] font-bold">{t("geo.brandProducts", { name: vendor.name, city: r.ctx.city })}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {products.map((p) => <SoftwareTile key={p.id} sw={p} labels={settings.labels} />)}
              </div>
            </section>
          )}
          {sections.guide && (
            <section>
              <h2 className="mb-3 text-[1.45rem] font-bold">{t("geo.buying", { name: vendor.name, city: r.ctx.city })}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted">{sections.guide}</p>
            </section>
          )}
          <ServiceArea location={location} t={t} others={r.otherCities.map((c) => ({ name: c.name, slug: c.slug, href: `/${c.slug}/${vendor.slug}`, lat: c.latitude, lng: c.longitude }))} />
          <Faqs faqs={sections.faqs} t={t} />
          {(location.businessZones.length > 0 || r.otherCities.length > PIN_SPOTS.length) && <OtherCities title={t("geo.otherCities", { name: vendor.name })} items={r.otherCities} href={(c) => `/${c}/${vendor.slug}`} />}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-panel border border-line bg-surface p-5">
            <p className="font-semibold">{t("geo.brandFormTitle", { name: vendor.name })}</p>
            <div className="mt-4"><LeadForm config={leadConfig} softwareSlugs={products.map((p) => p.slug).slice(0, 5)} source="GET_ADVICE" compact requirementPlaceholder={t("geo.brandFormHint", { name: vendor.name, city: r.ctx.city })} /></div>
          </div>
        </aside>
      </div>
    </>
    </EditRegion>
  );
}

// ─── Product: /{location}/{base}/{product} ───────────────────────────────────

export async function productGeoMetadata({ params }: ProductProps): Promise<Metadata> {
  const { slug, sub, item } = await params;
  const r = await getProductGeoPage(slug, sub, item);
  if (!r) return {};
  const sw = await getPublishedSoftware(item);
  const t = await getT();
  return buildMetadata({
    path: `/${slug}/${sub}/${item}`,
    title: r.page.seoTitle || t("geo.productMetaTitle", { name: r.ctx.name, city: r.ctx.city }),
    description: r.page.seoDescription || r.sections.hero || r.sections.introduction,
    image: sw?.logo?.url,
    noIndex: r.page.noIndex,
  });
}

export async function ProductGeoPage({ params }: ProductProps) {
  const { slug, sub, item } = await params;
  const r = await getProductGeoPage(slug, sub, item);
  if (!r) notFound();
  const sw = await getPublishedSoftware(item);
  if (!sw) notFound();
  const { location, sections, settings } = r;
  const price = toNumber(sw.startingPrice);
  const t = makeT(settings.texts);
  const leadConfig = { consentText: settings.leads.consentText, companySizes: settings.leads.companySizes, successMessage: settings.labels.leadSuccess, submitLabel: settings.labels.enquireCta, requireCompany: settings.leads.requireCompany };
  return (
    <EditRegion label="Local product page" actions={[{ label: "Edit geo pages", href: "/admin/geo/pages" }, { label: "Geo settings & templates", href: "/admin/geo/settings" }]}>
    <>
      <Hero
        eyebrow={location.cityLabel}
        title={t("geo.productHeading", { name: sw.name, city: r.ctx.city })}
        t={t}
        text={sections.hero}
        crumbs={[{ name: sw.name, path: `/software/${sw.slug}` }, { name: location.name, path: `/${location.slug}/${sub}/${sw.slug}` }]}
        logo={<SoftwareLogo logo={sw.logo ? { url: sw.logo.url, alt: sw.logo.alt } : null} name={sw.name} size={88} />}
        aside={
          <div className="rounded-panel border border-line bg-surface p-5 shadow-[0_20px_48px_-28px_rgb(var(--color-ink)/0.45)]">
            <p className="text-sm text-muted">{t("geo.startingPrice")}</p>
            <p className="mt-0.5 font-display text-[1.8rem] font-bold leading-tight">
              {price && price > 0 ? formatPrice(price, sw.currency) : sw.pricingModel === "FREE" ? t("product.free") : t("product.priceOnRequest")}
              {price && price > 0 && sw.priceUnit ? <span className="ml-1 font-sans text-sm font-normal text-muted">{sw.priceUnit}</span> : null}
            </p>
            <p className="text-xs text-muted">{pricingLabel(t, sw.pricingModel)}</p>
            <div className="mt-4 grid gap-2">
              <EnquireButton type="QUOTE" softwareSlugs={[sw.slug]} productName={sw.name} source="PRODUCT_PAGE" title={t("geo.productHeading", { name: sw.name, city: r.ctx.city })} className="h-11 rounded-full bg-accent text-sm font-semibold text-accent-fg hover:brightness-95">{settings.labels.enquireCta}</EnquireButton>
              <Link href={`/software/${sw.slug}`} className="inline-flex h-11 items-center justify-center rounded-full border border-line text-sm font-semibold hover:border-ink/30">{t("geo.fullDetails")}</Link>
            </div>
          </div>
        }
      />
      <div className="container grid gap-10 py-10 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-12">
          {sections.introduction && <p className="whitespace-pre-line text-lg leading-relaxed text-ink/85">{sections.introduction}</p>}
          {sw.features.length > 0 && (
            <section>
              <h2 className="mb-4 text-[1.45rem] font-bold">{t("geo.features", { name: sw.name })}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {sw.features.slice(0, 8).map((f) => (
                  <li key={f.id} className="rounded-panel border border-line bg-surface p-4">
                    <p className="font-semibold">{f.title}</p>
                    {f.description && <p className="mt-1 text-sm text-muted">{f.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {sw.plans.length > 0 && (
            <section>
              <h2 className="mb-4 text-[1.45rem] font-bold">{t("geo.priceIn", { name: sw.name, city: r.ctx.city })}</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                {sw.plans.slice(0, 3).map((p) => {
                  const pp = toNumber(p.price);
                  return (
                    <div key={p.id} className="rounded-panel border border-line bg-surface p-4">
                      <p className="flex items-center gap-2 font-semibold">{p.name}{p.isPopular && <Badge tone="accent"><Sparkles className="mr-1 h-3 w-3" aria-hidden />{t("geo.popular")}</Badge>}</p>
                      <p className="mt-1 text-lg font-bold">{pp && pp > 0 ? formatPrice(pp, p.currency) : t("geo.onRequest")}</p>
                      {p.priceUnit && <p className="text-xs text-muted">{p.priceUnit}</p>}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted">{t("geo.priceNote", { city: r.ctx.city })}</p>
            </section>
          )}
          {sections.guide && (
            <section>
              <h2 className="mb-3 text-[1.45rem] font-bold">{t("geo.buying", { name: sw.name, city: r.ctx.city })}</h2>
              <p className="whitespace-pre-line leading-relaxed text-muted">{sections.guide}</p>
            </section>
          )}
          <ServiceArea location={location} t={t} others={r.otherCities.map((c) => ({ name: c.name, slug: c.slug, href: `/${c.slug}/${sub}/${sw.slug}`, lat: c.latitude, lng: c.longitude }))} />
          <Faqs faqs={sections.faqs} t={t} />
          {(location.businessZones.length > 0 || r.otherCities.length > PIN_SPOTS.length) && <OtherCities title={t("geo.otherCities", { name: sw.name })} items={r.otherCities} href={(c) => `/${c}/${sub}/${sw.slug}`} />}
          {r.nearby.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold">{t("geo.moreSoftware", { place: location.name })}</h2>
              <ul className="flex flex-wrap gap-2">
                {r.nearby.map((n) => <li key={n.slug}><Link href={`/${location.slug}/${sub}/${n.slug}`} className="inline-flex rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm hover:border-primary hover:text-primary">{n.name}</Link></li>)}
              </ul>
            </section>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-panel border border-line bg-surface p-5">
            <p className="font-semibold">{t("geo.productFormTitle", { name: sw.name })}</p>
            <div className="mt-4"><LeadForm config={leadConfig} softwareSlugs={[sw.slug]} source="PRODUCT_PAGE" compact requirementPlaceholder={t("geo.productFormHint", { name: sw.name, city: r.ctx.city })} /></div>
          </div>
        </aside>
      </div>
    </>
    </EditRegion>
  );
}
