import { FilePen, Globe, MapPin, MapPinned } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listGeoPages, listLocations } from "@/server/services/geo";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { GeoPagesHeaderActions, GeoPagesManager } from "./geo-pages-manager";

export const metadata = { title: "Geo pages" };
export const dynamic = "force-dynamic";

type Sections = { hero?: string; introduction?: string; guide?: string; faqs?: { question: string; answer: string }[] };

export default async function GeoPagesAdmin({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requirePermission("geo.view", "/admin/geo/pages");
  const sp = await searchParams;
  const [pages, locations, settings, total, published, cities] = await Promise.all([
    listGeoPages(user, { search: sp.q?.trim() || undefined, status: sp.status }),
    listLocations(user),
    getSettings(),
    db.geoPage.count(),
    db.geoPage.count({ where: { isPublished: true } }),
    db.geoPage.findMany({ distinct: ["locationId"], select: { locationId: true } }),
  ]);
  return (
    <>
      <PageHeader title="Geo pages" description="Manage every local landing page for products and brands." actions={<GeoPagesHeaderActions />} />
      <PageStats
        items={[
          { label: "Geo pages", value: total, icon: MapPinned, tone: "red", sub: "Local landing pages" },
          { label: "Published", value: published, icon: Globe, tone: "green", sub: "Live on the website", href: "/admin/geo/pages?status=published" },
          { label: "Drafts", value: total - published, icon: FilePen, tone: total - published ? "amber" : "neutral", sub: total - published ? "Not published yet" : "Nothing waiting", href: "/admin/geo/pages?status=draft" },
          { label: "Locations covered", value: cities.length, icon: MapPin, sub: "Cities and areas with a page" },
        ]}
      />
      <GeoPagesManager
        enabled={settings.geo.enabled}
        base={settings.geo.productRouteBase}
        template={settings.geo.template}
        search={sp.q ?? ""}
        status={sp.status ?? ""}
        locations={locations.filter((l) => l.level === "CITY" || l.level === "AREA").map((l) => ({ id: l.id, name: l.name, slug: l.slug, level: l.level, path: l.path, isPublished: l.isPublished }))}
        pages={pages.map((p) => {
          const s = (p.sections ?? {}) as Sections;
          return {
            id: p.id,
            locationId: p.locationId,
            location: p.location.name,
            locationSlug: p.location.slug,
            targetType: p.softwareId ? ("software" as const) : ("vendor" as const),
            targetId: (p.softwareId ?? p.vendorId)!,
            targetName: p.software?.name ?? p.vendor?.name ?? "—",
            targetSlug: p.software?.slug ?? p.vendor?.slug ?? "",
            targetLive: p.software ? p.software.status === "PUBLISHED" : true,
            isPublished: p.isPublished,
            noIndex: p.noIndex,
            hero: s.hero ?? "",
            introduction: s.introduction ?? "",
            guide: s.guide ?? "",
            faqs: s.faqs ?? [],
            inherit: p.inherit,
            seoTitle: p.seoTitle ?? "",
            seoDescription: p.seoDescription ?? "",
            updatedAt: p.updatedAt.toISOString(),
          };
        })}
      />
    </>
  );
}
