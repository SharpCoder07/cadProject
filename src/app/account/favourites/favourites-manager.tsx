"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Heart, HeartOff, Plus, Search, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button, buttonClass } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { ListPanel, PILL_TRACK, PanelEmpty, PANEL, pillTab, showingAll } from "@/components/admin/list-panel";
import { AdminTable } from "@/components/admin/page-header";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { cn } from "@/lib/utils";
import { useServerAction } from "@/components/admin/use-action";
import { removeFavouriteAction, searchFavouritesAction, setFavouriteAction, setOfferEmailsAction } from "../actions";

interface Item {
  softwareId: string;
  name: string;
  slug: string;
  tagline: string | null;
  vendor: string | null;
  logoUrl: string | null;
  available: boolean;
  offers: { id: string; title: string; discount: string; couponCode: string | null; endsAt: string | null }[];
}
type Hit = { id: string; name: string; slug: string; vendor: { name: string } | null; logo: { url: string } | null };

function Logo({ url, name }: { url: string | null; name: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- small uploaded logo
    <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-line bg-white object-contain p-1" />
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink/5 text-sm font-semibold text-muted">{name.slice(0, 1)}</span>
  );
}

export function FavouritesManager({ items, offerEmails }: { items: Item[]; offerEmails: boolean }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [emails, setEmails] = useState(offerEmails);
  const search = useServerAction(searchFavouritesAction, { refresh: false });
  const fav = useServerAction(setFavouriteAction);
  const pref = useServerAction(setOfferEmailsAction, { refresh: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const have = new Set(items.map((i) => i.softwareId));
  const [tab, setTab] = useState<"all" | "offer">("all");
  const [find, setFind] = useState("");
  const shown = useMemo(() => {
    const t = find.trim().toLowerCase();
    return items.filter((i) => (tab === "all" || i.offers.length > 0) && (!t || [i.name, i.vendor ?? "", i.tagline ?? ""].some((x) => x.toLowerCase().includes(t))));
  }, [items, tab, find]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) return setHits([]);
    timer.current = setTimeout(() => {
      void search.run({ q }).then((r) => r.ok && setHits(r.data));
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on query change only
  }, [q]);

  return (
    <SelectionProvider>
    <div className="space-y-4">
      <div className={cn(PANEL, "space-y-4 p-4 sm:p-5")}>
        <Switch
          label={<span className="font-medium">Email me when a favourite launches an offer</span>}
          hint="One email per offer, when it goes live."
          checked={emails}
          disabled={pref.pending}
          onChange={(e) => { const on = e.target.checked; setEmails(on); void pref.run({ on }).then((r) => !r.ok && setEmails(!on)); }}
        />
        <div className="relative border-t border-line pt-4">
          <Search className="pointer-events-none absolute left-3 top-[1.65rem] h-4 w-4 text-muted" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a product: search by name…" className="pl-9" aria-label="Search products to add" />
          {hits.length > 0 && (
            <ul className="mt-2 divide-y divide-line rounded-xl ring-1 ring-line">
              {hits.map((h) => (
                <li key={h.id} className="flex items-center gap-3 px-3 py-2">
                  <Logo url={h.logo?.url ?? null} name={h.name} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{h.name}</p>{h.vendor && <p className="truncate text-xs text-muted">{h.vendor.name}</p>}</div>
                  {have.has(h.id) ? (
                    <Badge tone="success"><Heart className="mr-1 h-3 w-3 fill-current" aria-hidden />Saved</Badge>
                  ) : (
                    <Button size="sm" variant="secondary" loading={fav.pending} onClick={() => void fav.run({ softwareId: h.id, on: true })}><Plus className="h-3.5 w-3.5" aria-hidden /> Add</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {q.trim().length >= 2 && !search.pending && hits.length === 0 && <p className="mt-2 text-sm text-muted">No published products match “{q}”.</p>}
        </div>
      </div>

      <BulkActionBar noun="favourite" items={[{ label: "Remove from favourites", action: removeFavouriteAction, done: "Removed", danger: true, recycleBin: false }]} />
      <ListPanel
        tabs={
          <nav aria-label="Filter favourites" className={PILL_TRACK}>
            {([["all", "All", items.length], ["offer", "On offer", items.filter((i) => i.offers.length > 0).length]] as const).map(([key, label, n]) => (
              <button key={key} type="button" onClick={() => setTab(key)} aria-pressed={tab === key} className={pillTab(tab === key)}>
                {label}
                <span className={cn("rounded-full px-1.5 text-[11px] font-semibold tabular-nums", tab === key ? "bg-mint-soft text-mint-ink" : "bg-surface text-muted")}>{n}</span>
              </button>
            ))}
          </nav>
        }
        meta={showingAll(shown.length)}
        actions={
          items.length > 0 && (
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Search your favourites</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={find}
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setFind("")}
                placeholder="Search your favourites…"
                autoComplete="off"
                className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-8 text-sm text-ink outline-none transition placeholder:text-muted focus:border-mint focus:ring-4 focus:ring-mint-soft"
              />
              {find && (
                <button type="button" onClick={() => setFind("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-ink/5 hover:text-ink">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              )}
            </label>
          )
        }
      >
      {shown.length === 0 ? (
        <PanelEmpty title={items.length === 0 ? "No favourites yet" : find ? "No matching favourites" : "None on offer right now"} icon={<Heart className="h-5 w-5" />}>
          {items.length === 0 ? "Search above, or tap the heart on any product page." : find ? "Try a different search." : "We'll email you as soon as one of your favourites launches an offer."}
        </PanelEmpty>
      ) : (
        <AdminTable bare minWidth={52}>
          <thead><tr><th className="w-10"><AllCheckbox ids={shown.map((i) => i.softwareId)} /></th><th>Product</th><th>Live offers</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.softwareId}>
                <td><RowCheckbox id={i.softwareId} label={i.name} /></td>
                <td>
                  <div className="flex items-center gap-3">
                    <Logo url={i.logoUrl} name={i.name} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{i.name}</span>
                      <span className="block truncate text-xs text-muted">{i.vendor ?? i.tagline ?? ""}</span>
                    </span>
                  </div>
                </td>
                <td className="max-w-[22rem]">
                  {i.offers.length > 0 ? (
                    <ul className="space-y-1">
                      {i.offers.map((o) => (
                        <li key={o.id} className="text-sm">
                          <Badge tone="success">{o.discount}</Badge> <span className="text-ink">{o.title}</span>
                          <span className="block text-xs text-muted">{o.couponCode && <>Code <span className="font-mono text-ink">{o.couponCode}</span>{o.endsAt && " · "}</>}{o.endsAt && `until ${formatDate(o.endsAt)}`}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>{i.available ? <Badge tone="success">Listed</Badge> : <Badge tone="neutral">Not listed right now</Badge>}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-1.5">
                    {i.available && (
                      <Link href={`/software/${i.slug}`} target="_blank" title="View product" aria-label={`View ${i.name}`} className={buttonClass("secondary", "sm", "w-8 px-0")}>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    )}
                    <Button size="sm" variant="secondary" className="w-8 px-0 text-danger hover:border-danger/40 hover:bg-danger/5" title="Remove from favourites" aria-label={`Remove ${i.name} from favourites`} onClick={() => void fav.run({ softwareId: i.softwareId, on: false })}>
                      <HeartOff className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      )}
      </ListPanel>
    </div>
    </SelectionProvider>
  );
}
