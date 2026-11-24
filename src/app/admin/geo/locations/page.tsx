import { Building, Globe2, MapPinned, Map } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { listLocations } from "@/server/services/geo";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { LocationsHeaderActions, LocationsManager } from "./locations-manager";

export const metadata = { title: "Geo locations" };
export const dynamic = "force-dynamic";

export default async function GeoLocationsPage() {
  const user = await requirePermission("geo.view", "/admin/geo/locations");
  const rows = await listLocations(user);
  return (
    <>
      <PageHeader title="Geo locations" description="Manage every country, state, city and area for local pages." actions={<LocationsHeaderActions />} />
      <PageStats
        items={[
          { label: "Countries", value: rows.filter((r) => r.level === "COUNTRY").length, icon: Globe2, tone: "red", sub: `${rows.filter((r) => r.level === "STATE").length} states` },
          { label: "Cities", value: rows.filter((r) => r.level === "CITY").length, icon: Building, tone: "green", sub: `${rows.filter((r) => r.level === "AREA").length} areas inside them` },
          { label: "Published", value: rows.filter((r) => r.isPublished).length, icon: Map, sub: `of ${rows.length} locations` },
          { label: "With geo pages", value: rows.filter((r) => r._count.pages > 0).length, icon: MapPinned, sub: "Have a local landing page" },
        ]}
      />
      <LocationsManager
        rows={rows.map((r) => ({
          id: r.id, name: r.name, slug: r.slug, level: r.level, parentId: r.parentId, path: r.path, isPublished: r.isPublished, priority: r.priority,
          latitude: r.latitude, longitude: r.longitude, pinCodes: r.pinCodes, businessZones: r.businessZones, children: r._count.children, pages: r._count.pages,
        }))}
      />
    </>
  );
}
