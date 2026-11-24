import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { buildMetadata } from "@/server/seo/metadata";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { InstantFilter } from "@/components/site/instant-filter";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";
import { PartnerNetwork, type NetworkNode } from "@/components/site/partner-network";
import { getSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return buildMetadata({ path: "/vendors", title: t("vendors.seoTitle"), description: t("vendors.seoDescription") });
}

export default async function VendorsIndex() {
  const t = await getT();
  const vendors = await db.vendor.findMany({
    where: { isActive: true, software: { some: { status: "PUBLISHED" } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, _count: { select: { software: { where: { status: "PUBLISHED" } } } } },
  });
  // Partner network map: the biggest vendors (teal) and resellers with live products (amber); the hub counts verified partners.
  const [settings, resellers, verifiedCount] = await Promise.all([
    getSettings(),
    db.vendor.findMany({
      where: { isActive: true, kind: "RESELLER", authorisedProducts: { some: { software: { status: "PUBLISHED" } } } },
      orderBy: [{ verification: "desc" }, { name: "asc" }],
      take: 3,
      select: { name: true, slug: true, verification: true, logo: { select: { url: true } } },
    }),
    db.vendor.count({ where: { isActive: true, verification: "VERIFIED" } }),
  ]);
  const top = await db.vendor.findMany({
    where: { id: { in: vendors.map((v) => v.id) }, kind: "VENDOR" },
    select: { id: true, verification: true, logo: { select: { url: true } } },
  });
  const extra = new Map(top.map((v) => [v.id, v]));
  const vendorNodes: NetworkNode[] = [...vendors]
    .filter((v) => extra.has(v.id))
    .sort((a, b) => b._count.software - a._count.software)
    .map((v) => ({ name: v.name, href: `/vendors/${v.slug}`, logo: extra.get(v.id)?.logo?.url, kind: "vendor" as const, verified: extra.get(v.id)?.verification === "VERIFIED" }));
  const resellerNodes: NetworkNode[] = resellers.map((r) => ({ name: r.name, href: `/resellers/${r.slug}`, logo: r.logo?.url, kind: "reseller" as const, verified: r.verification === "VERIFIED" }));
  // Resellers take slots 4 and 5 (left/right middle) and 9, so both colours show even with few nodes.
  const nodes: NetworkNode[] = [];
  const vq = [...vendorNodes];
  const rq = [...resellerNodes];
  for (let i = 0; i < 10; i++) {
    const wantReseller = i === 4 || i === 5 || i === 9;
    const n = (wantReseller ? rq.shift() ?? vq.shift() : vq.shift() ?? rq.shift());
    if (n) nodes.push(n);
  }
  const groups = new Map<string, typeof vendors>();
  for (const v of vendors) {
    const k = /[a-z]/i.test(v.name[0] ?? "") ? (v.name[0] as string).toUpperCase() : "#";
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  return (
    <EditRegion label="All vendors" live={{ kind: "vendors", id: "all", section: "all", title: "Vendors" }} actions={[{ label: "Open in admin", href: "/admin/vendors" }, { label: "Wording", href: "/admin/cms/texts?group=vendors" }]}>
    <div className="container py-8">
      <Breadcrumbs items={[{ name: t("vendors.breadcrumb"), path: "/vendors" }]} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.9rem] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[2.4rem]">{t("vendors.heading")}</h1>
          <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />
          {t("vendors.intro") && <p className="mt-3 max-w-2xl text-muted">{t("vendors.intro")}</p>}
        </div>
        <p className="flex gap-4 text-[13px] font-medium text-ink" aria-hidden>
          <span className="flex items-center gap-1.5"><span className="h-[3px] w-[18px] rounded-full bg-primary" />{t("vendors.legendVendor")}</span>
          <span className="flex items-center gap-1.5"><span className="h-[3px] w-[18px] rounded-full bg-accent" />{t("vendors.legendReseller")}</span>
        </p>
      </div>
      {nodes.length > 0 && (
        <div className="mt-6">
          <PartnerNetwork hubTitle={settings.site.name} hubSub={verifiedCount ? t("vendors.networkHub", { count: verifiedCount }) : undefined} nodes={nodes} label={t("vendors.networkLabel")} verifiedLabel={settings.labels.verifiedLabel} />
        </div>
      )}
      <InstantFilter placeholder={t("vendors.search")} scopeHref="/vendors" scopeLabel={t("vendors.heading")} className="mt-8">
        <nav aria-label="Jump to letter" className="mt-2 flex flex-wrap gap-1">
          {[...groups.keys()].map((k) => (
            <a key={k} href={`#v-${k}`} className="flex h-8 w-8 items-center justify-center rounded-control border border-line bg-surface text-sm hover:border-primary">{k}</a>
          ))}
        </nav>
        <div className="mt-8 space-y-8">
          {[...groups.entries()].map(([k, list]) => (
            <section key={k} id={`v-${k}`} aria-labelledby={`h-${k}`} data-filter-group>
              <h2 id={`h-${k}`} className="border-b border-line pb-1 font-display text-xl">{k}</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {list.map((v) => (
                  <li key={v.id} data-filter={v.name}>
                    <Link href={`/vendors/${v.slug}`} className="text-sm hover:text-primary">
                      {v.name} <span className="text-muted">({v._count.software})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </InstantFilter>
    </div>
    </EditRegion>
  );
}
