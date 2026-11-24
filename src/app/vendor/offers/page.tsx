import { CalendarClock, Clock, Tag, Zap } from "lucide-react";
import { listVendorOffers, offerPhase } from "@/server/services/offers";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { requireVendor } from "../_lib";
import { NewVendorOfferButton, VendorOffers } from "./vendor-offers";

export const metadata = { title: "Offers" };
export const dynamic = "force-dynamic";

export default async function VendorOffersPage() {
  const user = await requireVendor("vendor.offers", "/vendor/offers");
  const { offers, products, requests } = await listVendorOffers(user);
  const now = new Date();
  // Latest request per offer decides the badge (pending / rejected).
  const latest = new Map<string, (typeof requests)[number]>();
  for (const r of requests) if (!latest.has(r.entityId)) latest.set(r.entityId, r);
  const phases = offers.map((o) => offerPhase(o, now));
  const pending = requests.filter((r) => r.status === "PENDING").length;
  return (
    <>
      <PageHeader title="Offers" description="Manage every discount and deal on your products." actions={<NewVendorOfferButton disabled={!products.length} />} />
      <PageStats
        items={[
          { label: "Offers", value: offers.length, icon: Tag, tone: "red", sub: "On your products" },
          { label: "Live", value: phases.filter((p) => p === "live").length, icon: Zap, tone: "green", sub: "Shown to buyers now" },
          { label: "Scheduled", value: phases.filter((p) => p === "scheduled").length, icon: CalendarClock, sub: "Start automatically" },
          { label: "Awaiting approval", value: pending, icon: Clock, tone: pending ? "amber" : "neutral", sub: pending ? "Being reviewed" : "Nothing waiting" },
        ]}
      />
      <VendorOffers
        products={products.map((p) => ({ id: p.id, name: p.name, note: p.status === "PUBLISHED" ? undefined : `${p.status.toLowerCase().replace("_", " ")} — offer shows once it's live` }))}
        offers={offers.map((o) => {
          const req = latest.get(o.id);
          return {
            id: o.id,
            softwareId: o.softwareId,
            product: o.software.name,
            productSlug: o.software.slug,
            title: o.title,
            discount: o.discount,
            description: o.description ?? "",
            couponCode: o.couponCode ?? "",
            terms: o.terms ?? "",
            url: o.url ?? "",
            startsAt: o.startsAt.toISOString(),
            endsAt: o.endsAt?.toISOString() ?? null,
            phase: offerPhase(o, now),
            request: req && (req.status === "PENDING" || req.status === "REJECTED") ? { action: req.action, status: req.status, note: req.decisionNote } : null,
          };
        })}
      />
    </>
  );
}
