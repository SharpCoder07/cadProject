import Link from "next/link";
import { redirect } from "next/navigation";
import { Award, BadgeCheck, Clock, Package, Search } from "lucide-react";
import { db } from "@/server/db";
import { browseProductsForReseller } from "@/server/services/resellers";
import { formatNumber, formatPrice, toNumber } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, SearchField, SelectField, showing } from "@/components/admin/list-panel";
import { requireVendor } from "../_lib";
import { BecomeResellerButton } from "./become-button";

export const metadata = { title: "Browse products" };
export const dynamic = "force-dynamic";

export default async function BrowseProducts({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; show?: string; page?: string }> }) {
  const user = await requireVendor("vendor.portal", "/reseller/browse");
  const { kind } = await db.vendor.findUniqueOrThrow({ where: { id: user.vendorId }, select: { kind: true } });
  if (kind !== "RESELLER") redirect("/vendor");
  const sp = await searchParams;
  const show = sp.show === "available" || sp.show === "mine" ? sp.show : "all";
  const data = await browseProductsForReseller(user, { q: sp.q, category: sp.category, show, page: Number(sp.page) || 1 });
  const canRequest = user.permissions.has("vendor.authorised");
  const href = (s: string) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, category: sp.category, show: s === "all" ? undefined : s }).filter(([, v]) => v) as [string, string][]);
    return p.toString() ? `/reseller/browse?${p}` : "/reseller/browse";
  };
  return (
    <>
      <PageHeader title="Browse products" description="Find products you sell and become an authorised reseller." />
      <PageStats
        items={[
          { label: "You resell", value: formatNumber(data.mine), icon: BadgeCheck, tone: "green", sub: "Authorised products", href: "/reseller/authorised" },
          { label: "Waiting for approval", value: formatNumber(data.pendingCount), icon: Clock, tone: data.pendingCount ? "amber" : "neutral", sub: data.pendingCount ? "Being reviewed" : "Nothing waiting", href: "/reseller/requests?status=PENDING" },
          { label: "Products on the marketplace", value: formatNumber(data.total), icon: Package, sub: sp.q || sp.category ? "Matching your filters" : "Available to browse" },
        ]}
      />
      <ListPanel
        tabs={
          <PillTabs
            label="Show"
            items={[
              { href: href("all"), label: "All products", active: show === "all" },
              { href: href("available"), label: "Not reselling yet", active: show === "available" },
              { href: href("mine"), label: "Reselling", active: show === "mine" },
            ]}
          />
        }
        meta={showing(data.page, data.perPage, data.total)}
        filters={
          <FilterBar action="/reseller/browse" bare oneLine>
            {show !== "all" && <input type="hidden" name="show" value={show} />}
            <SearchField defaultValue={sp.q} placeholder="Search products, brands or vendors…" />
            <SelectField name="category" label="Category" value={sp.category}>
              <option value="">All categories</option>
              {data.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/reseller/browse" params={sp} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<Search className="h-5 w-5" />} title="No products found">Try another search or category.</PanelEmpty>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((p) => {
              const price = toNumber(p.startingPrice);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
                  <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                    {p.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small product logo
                      <img src={p.logo.url} alt="" className="h-full w-full object-contain p-1.5" />
                    ) : (
                      <span className="text-base font-bold text-muted">{p.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1 basis-60">
                    <Link href={`/software/${p.slug}`} target="_blank" className="font-semibold text-ink hover:text-mint-ink">{p.name}</Link>
                    <p className="truncate text-xs text-muted">
                      {[p.brand?.isActive ? p.brand.name : null, p.vendor ? `by ${p.vendor.name}` : null, p.primaryCategory?.name].filter(Boolean).join(" · ")}
                    </p>
                    {p.tagline && <p className="mt-0.5 line-clamp-1 text-sm text-ink/80">{p.tagline}</p>}
                  </div>
                  <div className="w-32 shrink-0 text-sm">
                    <span className="block font-medium text-ink">{price && price > 0 ? formatPrice(price, p.currency) : p.pricingModel === "FREE" ? "Free" : "On request"}</span>
                    <span className="block text-xs text-muted">{p.otherResellers ? `${p.otherResellers} other reseller${p.otherResellers === 1 ? "" : "s"}` : "No resellers yet"}</span>
                  </div>
                  <div className="flex w-full shrink-0 justify-end sm:w-48">
                    {p.authorised ? (
                      <Badge tone="success"><BadgeCheck className="h-3 w-3" aria-hidden /> {p.authorised.partnerLevel ? <><Award className="h-3 w-3" aria-hidden /> {p.authorised.partnerLevel}</> : "You resell this"}</Badge>
                    ) : p.pending === "CREATE" ? (
                      <Badge tone="warning"><Clock className="h-3 w-3" aria-hidden /> Waiting for approval</Badge>
                    ) : canRequest ? (
                      <BecomeResellerButton softwareId={p.id} name={p.name} vendorName={p.vendor?.name ?? null} />
                    ) : (
                      <span className="text-xs text-muted">Ask your admin to request it</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ListPanel>
    </>
  );
}
