import { requirePermission } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/page-header";
import { GeoSettingsForm } from "./geo-settings-form";

export const metadata = { title: "Geo settings" };
export const dynamic = "force-dynamic";

export default async function GeoSettingsPage() {
  await requirePermission("geo.manage", "/admin/geo/settings");
  const { geo } = await getSettings();
  return (
    <>
      <PageHeader title="Geo settings" description="Set up local page URLs and default content." />
      <div className="max-w-4xl"><GeoSettingsForm initial={geo} /></div>
    </>
  );
}
