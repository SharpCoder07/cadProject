import type { Metadata } from "next";
import { getSettings } from "@/server/settings";
import { filterAttributes, runListing } from "@/server/services/catalog";
import Link from "next/link";
import { Tags } from "lucide-react";
import { logSearch, matchingTerms, searchParamsSchema } from "@/server/services/search";
import { normaliseParams, type RawParams } from "@/lib/search-params";
import { ListingFilters, ListingLayout, ListingResults, activeFilterCount } from "@/components/site/listing";
import { SearchBox } from "@/components/site/search-box";
import { makeT } from "@/lib/site-texts";
import { getT } from "@/server/texts";
import { EditRegion } from "@/components/site/edit-mode";
import { SearchHighlight } from "@/components/site/search-feed";
import { searchExamples } from "@/lib/search-examples";

type Props = { searchParams: Promise<RawParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = searchParamsSchema.parse(normaliseParams(await searchParams));
  const t = await getT();
  return { title: q ? t("search.seoTitleQuery", { query: q }) : t("search.seoTitle"), robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
  const raw = await searchParams;
  const sp = searchParamsSchema.parse(normaliseParams(raw));
  const [settings, listing, attributes, pages] = await Promise.all([getSettings(), runListing(sp), filterAttributes(), sp.q ? matchingTerms(sp.q, 6) : Promise.resolve([])]);
  if (sp.q && sp.page === 1) void logSearch(sp.q, listing.total);
  const t = makeT(settings.texts);
  return (
    <EditRegion label="Search results" actions={[{ label: "Listing settings", href: "/admin/settings?tab=listing" }, { label: "Wording", href: "/admin/cms/texts?group=listing" }]}>
    <div className="container py-8">
      <h1 className="text-3xl font-semibold">{sp.q ? t("search.headingQuery", { query: sp.q }) : t("search.heading")}</h1>
      <SearchBox placeholder={t("header.searchPlaceholder", { placeholder: settings.labels.searchPlaceholder })} defaultValue={sp.q ?? ""} className="cg-sbox mt-5 max-w-2xl" size="lg" live hints={searchExamples(settings.labels)} />
      {pages.length > 0 && (
        <nav aria-label="Related pages" className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">{t("search.compareOn")}</span>
          {pages.map((p) => (
            <Link key={p.href} href={p.href} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft px-3.5 py-1.5 text-sm font-medium text-primary hover:bg-primary hover:text-primary-fg">
              <Tags className="h-3.5 w-3.5" aria-hidden />
              {p.label}
              <span className="text-xs opacity-75">{p.count}</span>
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-8">
        <ListingLayout
          filterCount={activeFilterCount(sp)}
          filters={<ListingFilters params={sp} listing={listing} settings={settings} attributes={attributes} hidden={{ q: sp.q, category: sp.category }} action="/search" />}
          results={
            // Design concept 11 "Live results feed": shimmer placeholders while typing, results drop in, matches get a highlighter sweep.
            <div className="relative">
              <div aria-hidden className="cg-skel">
                {[0, 1, 2, 3].map((i) => <span key={i} />)}
              </div>
              <div key={JSON.stringify(raw)} className="cg-sfeed">
                <ListingResults listing={listing} params={sp} settings={settings} basePath="/search" rawParams={raw} clearHref={sp.q ? `/search?q=${encodeURIComponent(sp.q)}` : "/search"} />
                {sp.q && <SearchHighlight q={sp.q} />}
              </div>
            </div>
          }
        />
      </div>
    </div>
    </EditRegion>
  );
}
