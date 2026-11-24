import { CalendarClock, FilePen, Heart, Zap } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listOffersAdmin, offerPhase } from "@/server/services/offers";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { PillTabs } from "@/components/admin/list-panel";
import { NewOfferButton, OffersManager } from "./offers-manager";

export const metadata = { title: "Offers" };
export const dynamic = "force-dynamic";

const TABS = [["", "All"], ["live", "Live"], ["scheduled", "Scheduled"], ["draft", "Drafts"], ["ended", "Ended"]] as const;

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  const user = await requirePermission("offers.view", "/admin/offers");
  const { phase } = await searchParams;
  const [offers, products, favCounts] = await Promise.all([
    listOffersAdmin(user, {}),
    db.software.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true } }),
    db.productFavourite.groupBy({ by: ["softwareId"], _count: { _all: true } }),
  ]);
  const favOf = new Map(favCounts.map((f) => [f.softwareId, typeof f._count === "object" ? f._count._all ?? 0 : 0]));
  const now = new Date();
  const all = offers.map((o) => ({ o, phase: offerPhase(o, now) }));
  const count = (p?: string) => all.filter((x) => !p || x.phase === p).length;
  const shown = all.filter((x) => !phase || x.phase === phase).map((x) => x.o);
  const reach = new Set(all.filter((x) => x.phase === "live").map((x) => x.o.softwareId));
  const watchers = [...reach].reduce((n, id) => n + (favOf.get(id) ?? 0), 0);
  return (
    <>
      <PageHeader title="Offers" description="Manage every discount and deal on your marketplace." actions={<NewOfferButton />} />
      <PageStats
        items={[
          { label: "Live offers", value: formatNumber(count("live")), icon: Zap, tone: "green", sub: "Shown to buyers now", href: "/admin/offers?phase=live" },
          { label: "Scheduled", value: formatNumber(count("scheduled")), icon: CalendarClock, sub: "Start automatically", href: "/admin/offers?phase=scheduled" },
          { label: "Drafts", value: formatNumber(count("draft")), icon: FilePen, tone: count("draft") ? "amber" : "neutral", sub: count("draft") ? "Not published yet" : "Nothing in progress", href: "/admin/offers?phase=draft" },
          { label: "Buyers watching", value: formatNumber(watchers), icon: Heart, tone: "red", sub: "Favourited a product on offer" },
        ]}
      />
      <OffersManager
        tabs={<PillTabs label="Filter offers" items={TABS.map(([key, label]) => ({ href: key ? `/admin/offers?phase=${key}` : "/admin/offers", label, count: count(key || undefined), active: (phase ?? "") === key }))} />}
        products={products.map((p) => ({ id: p.id, name: p.name, note: p.status === "PUBLISHED" ? undefined : p.status.toLowerCase().replace("_", " ") }))}
        offers={shown.map((o) => ({
          id: o.id,
          softwareId: o.softwareId,
          product: o.software.name,
          productSlug: o.software.slug,
          vendor: o.software.vendor?.name ?? null,
          title: o.title,
          discount: o.discount,
          description: o.description ?? "",
          couponCode: o.couponCode ?? "",
          terms: o.terms ?? "",
          url: o.url ?? "",
          startsAt: o.startsAt.toISOString(),
          endsAt: o.endsAt?.toISOString() ?? null,
          phase: offerPhase(o, now),
          createdBy: o.createdBy ? `${o.createdBy.name}${o.createdBy.vendorId ? " (vendor)" : ""}` : null,
          announced: Boolean(o.launchNotifiedAt),
          favourites: favOf.get(o.softwareId) ?? 0,
        }))}
      />
    </>
  );
}
