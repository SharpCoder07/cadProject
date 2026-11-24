import { BellRing, BellOff, Heart, Tag } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listFavourites } from "@/server/services/offers";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { FavouritesManager } from "./favourites-manager";

export const metadata = { title: "Favourites" };

export default async function FavouritesPage() {
  const user = await requireUser("/account/favourites");
  const { favourites, offerEmails } = await listFavourites(user);
  return (
    <>
      <PageHeader title="Favourite products" description="Follow the products you like and get their offers by email." />
      <PageStats
        items={[
          { label: "Favourites", value: favourites.length, icon: Heart, tone: "red", sub: "Products you follow" },
          { label: "On offer now", value: favourites.filter((f) => f.software.offers.length > 0).length, icon: Tag, tone: "green", sub: "Have a live deal" },
          { label: "Offer emails", value: offerEmails ? "On" : "Off", icon: offerEmails ? BellRing : BellOff, tone: offerEmails ? "neutral" : "amber", sub: offerEmails ? "We'll email you new deals" : "You won't hear about deals" },
        ]}
      />
      <FavouritesManager
        offerEmails={offerEmails}
        items={favourites.map((f) => ({
          softwareId: f.software.id,
          name: f.software.name,
          slug: f.software.slug,
          tagline: f.software.tagline,
          vendor: f.software.vendor?.name ?? null,
          logoUrl: f.software.logo?.url ?? null,
          available: f.software.status === "PUBLISHED",
          offers: f.software.offers.map((o) => ({ id: o.id, title: o.title, discount: o.discount, couponCode: o.couponCode, endsAt: o.endsAt?.toISOString() ?? null })),
        }))}
      />
    </>
  );
}
