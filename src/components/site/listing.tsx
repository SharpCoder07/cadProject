import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { subRatings, type runListing, type filterAttributes } from "@/server/services/catalog";
import type { SearchParams } from "@/server/services/search";
import type { Settings } from "@/server/settings/schemas";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/misc";
import { Pagination } from "@/components/ui/pagination";
import { SoftwareRow, SoftwareTile } from "./software-card";
import { AutoSubmitForm, SortSelect } from "./listing-client";
import { makeT } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { deploymentOptions, pricingOptions } from "@/lib/enum-labels";

type Listing = Awaited<ReturnType<typeof runListing>>;
type FilterAttr = Awaited<ReturnType<typeof filterAttributes>>[number];

const SORT_LABEL: Record<string, string> = {
  relevance: "listing.sortRelevance",
  popular: "listing.sortPopular",
  rating: "listing.sortRating",
  price_asc: "listing.sortPriceAsc",
  price_desc: "listing.sortPriceDesc",
  name: "listing.sortName",
  newest: "listing.sortNewest",
};

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-line py-4 last:border-b-0">
      <legend className="mb-2.5 text-[13px] font-bold text-ink">{title}</legend>
      <div className="space-y-1.5">{children}</div>
    </fieldset>
  );
}

function CheckOption({ name, value, checked, label, count }: { name: string; value: string; checked: boolean; label: string; count?: number }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2">
        <input type="checkbox" name={name} value={value} defaultChecked={checked} className="h-4 w-4 rounded border-line text-primary focus:ring-mint-soft" />
        {label}
      </span>
      {count !== undefined && <span className="text-xs text-muted">{count}</span>}
    </label>
  );
}

export function ListingFilters({ params, listing, settings, attributes, hidden, action }: { params: SearchParams; listing: Listing; settings: Settings; attributes: FilterAttr[]; hidden?: Record<string, string | undefined>; action: string }) {
  const f = settings.listing.filters;
  const t = makeT(settings.texts);
  const has = (arr: string[], v: string) => arr.includes(v);
  return (
    <AutoSubmitForm action={action} className="text-sm">
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      {params.sort && <input type="hidden" name="sort" value={params.sort} />}
      {f.freeTrial && (
        <FilterGroup title={t("listing.availability")}>
          <CheckOption name="trial" value="1" checked={params.trial === "1"} label={settings.labels.freeTrialBadge} />
          <CheckOption name="free" value="1" checked={params.free === "1"} label={settings.labels.freeVersionBadge} />
        </FilterGroup>
      )}
      {f.pricingModel && (
        <FilterGroup title={t("listing.pricingModel")}>
          {pricingOptions(t).map(([k, label]) => (
            <CheckOption key={k} name="pricing" value={k} checked={has(params.pricing, k)} label={label} count={listing.facets.pricing[k] ?? 0} />
          ))}
        </FilterGroup>
      )}
      {f.price && (
        <FilterGroup title={t("listing.startingPrice")}>
          <div className="flex items-center gap-2">
            <input type="number" name="minPrice" min={0} placeholder={t("listing.min")} defaultValue={params.minPrice} aria-label={t("listing.minAria")} className="h-9 w-full rounded-control border border-line px-2" />
            <span className="text-muted">–</span>
            <input type="number" name="maxPrice" min={0} placeholder={t("listing.max")} defaultValue={params.maxPrice} aria-label={t("listing.maxAria")} className="h-9 w-full rounded-control border border-line px-2" />
          </div>
          <button type="submit" className="mt-2 text-xs font-medium text-primary">
            Apply price
          </button>
        </FilterGroup>
      )}
      {f.deployment && (
        <FilterGroup title={t("listing.deployment")}>
          {deploymentOptions(t).map(([k, label]) => (
            <CheckOption key={k} name="deployment" value={k} checked={has(params.deployment, k)} label={label} count={listing.facets.deployment[k] ?? 0} />
          ))}
        </FilterGroup>
      )}
      {f.rating && (
        <FilterGroup title={t("listing.rating")}>
          {[4, 3].map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2">
              <input type="radio" name="rating" value={r} defaultChecked={params.rating === r} className="h-4 w-4 border-line text-primary" />
              {t("listing.ratingAbove", { stars: r })}
            </label>
          ))}
        </FilterGroup>
      )}
      {f.attributes &&
        attributes.map((a) => (
          <FilterGroup key={a.id} title={a.label}>
            {a.options.map((o) => (
              <CheckOption key={o.id} name="opt" value={o.id} checked={has(params.opt, o.id)} label={o.label} count={listing.facets.options[o.id] ?? 0} />
            ))}
          </FilterGroup>
        ))}
      <noscript>
        <button type="submit" className="mt-4 h-9 w-full rounded-control bg-primary text-primary-fg">
          {t("listing.apply")}
        </button>
      </noscript>
    </AutoSubmitForm>
  );
}

export function activeFilterCount(p: SearchParams) {
  return p.pricing.length + p.deployment.length + p.opt.length + p.term.length + (p.trial ? 1 : 0) + (p.free ? 1 : 0) + (p.rating ? 1 : 0) + (p.minPrice !== undefined ? 1 : 0) + (p.maxPrice !== undefined ? 1 : 0);
}

export async function ListingResults({ listing, params, settings, basePath, rawParams, view = "rows", clearHref }: { listing: Listing; params: SearchParams; settings: Settings; basePath: string; rawParams: Record<string, string | string[] | undefined>; view?: "rows" | "grid"; clearHref: string }) {
  const sorts = params.q ? Object.keys(SORT_LABEL) : Object.keys(SORT_LABEL).filter((s) => s !== "relevance");
  const scores = view === "rows" ? await subRatings(listing.items.map((sw) => sw.id)) : null;
  const from = (listing.page - 1) * listing.perPage + 1;
  const to = from + listing.items.length - 1;
  const t = makeT(settings.texts);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {listing.items.length > 0 ? (
            <>
              {t("listing.showing", { from: formatNumber(from), to: formatNumber(to), total: formatNumber(listing.total), noun: listing.total === 1 ? t("listing.product") : t("listing.products") })}
            </>
          ) : (
            <>
              {t("listing.none")}
            </>
          )}
          {activeFilterCount(params) > 0 && (
            <>
              {" · "}
              <Link href={clearHref} className="text-primary hover:underline">
                {t("listing.clear")}
              </Link>
            </>
          )}
        </p>
        <SortSelect value={listing.sort} options={sorts.map((s) => ({ value: s, label: t(SORT_LABEL[s] as string) }))} />
      </div>
      {listing.items.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface">
          <EmptyState title={t("listing.emptyTitle")}>
            {t("listing.emptyText")}{" "}
            <Link href={clearHref} className="text-primary hover:underline">
              {t("listing.clearAll")}
            </Link>
          </EmptyState>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listing.items.map((sw) => (
            <SoftwareTile key={sw.id} sw={sw} labels={settings.labels} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {listing.items.map((sw) => (
            <SoftwareRow key={sw.id} sw={sw} labels={settings.labels} opts={settings.listing} scores={scores?.get(sw.id)} />
          ))}
        </div>
      )}
      <div className="mt-8">
        <Pagination page={listing.page} pages={listing.pages} basePath={basePath} params={rawParams} />
      </div>
    </div>
  );
}

/** Two-column listing layout with collapsible filters on small screens. */
export async function ListingLayout({ filters, results, filterCount }: { filters: React.ReactNode; results: React.ReactNode; filterCount: number }) {
  const tx = await getT();
  return (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <aside aria-label={tx("listing.filters")}>
        <details className="group rounded-panel border border-line bg-surface lg:sticky lg:top-32" open>
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold lg:pointer-events-none">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> {tx("listing.filters")} {filterCount > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-fg">{filterCount}</span>}
            </span>
          </summary>
          <div className="border-t border-line px-4">{filters}</div>
        </details>
      </aside>
      <div className="min-w-0">{results}</div>
    </div>
  );
}
