import { CalendarClock, GalleryHorizontal, LayoutPanelTop, Radio } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { CrudAddButton, CrudManager, type CrudField } from "@/components/admin/crud-manager";
import { PageStats } from "@/components/admin/page-stats";
import { ItemTitle } from "@/components/admin/list-panel";

import { deleteBannerAction, reorderBannersAction, saveBannerAction, toggleBannerAction } from "../actions";

export const metadata = { title: "Banners" };
const local = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

const FIELDS: CrudField[] = [
  { name: "title", label: "Headline", type: "text", required: true, wide: true },
  { name: "subtitle", label: "Supporting text", type: "textarea" },
  { name: "placement", label: "Placement", type: "text", required: true, hint: "home.hero, category.accounting, … Use the same key in a Banners section or category layout." },
  { name: "theme", label: "Style", type: "select", options: [{ value: "brand", label: "Brand colour" }, { value: "dark", label: "Dark" }, { value: "light", label: "Light" }] },
  { name: "ctaLabel", label: "Button label", type: "text" },
  { name: "ctaUrl", label: "Button link", type: "text", placeholder: "/categories/accounting or https://…" },
  { name: "imageId", label: "Image", type: "media", previewKey: "_image" },
  { name: "mobileImageId", label: "Mobile image (optional)", type: "media", previewKey: "_mobile" },
  { name: "startsAt", label: "Show from (IST)", type: "datetime", hint: "Leave empty to show immediately." },
  { name: "endsAt", label: "Show until (IST)", type: "datetime", hint: "Leave empty to show indefinitely." },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function BannersPage() {
  await requirePermission("cms.navigation.view", "/admin/cms/banners");
  const banners = await db.banner.findMany({ orderBy: [{ placement: "asc" }, { sortOrder: "asc" }], include: { image: { select: { url: true } }, mobileImage: { select: { url: true } } } });
  const now = new Date();
  const live = banners.filter((b) => b.isActive && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now)).length;
  const scheduled = banners.filter((b) => b.isActive && b.startsAt && b.startsAt > now).length;
  return (
    <>
      <PageHeader title="Banners" description="Manage every promotional banner and its schedule." actions={<CrudAddButton entity="banner" label="Add banner" />} />
      <PageStats
        items={[
          { label: "Banners", value: banners.length, icon: GalleryHorizontal, tone: "red", sub: "In total" },
          { label: "Showing now", value: live, icon: Radio, tone: "green", sub: "Visible to visitors" },
          { label: "Scheduled", value: scheduled, icon: CalendarClock, tone: scheduled ? "amber" : "neutral", sub: "Start automatically" },
          { label: "Placements", value: new Set(banners.map((b) => b.placement)).size, icon: LayoutPanelTop, sub: "Different spots used" },
        ]}
      />
      <CrudManager
        addInHeader
        entity="banner"
        newLabel="Add banner"
        columns={["Headline", "Placement", "Schedule"]}
        rows={banners.map((b) => ({
          id: b.id,
          active: b.isActive,
          name: b.title,
          searchText: `${b.title} ${b.placement}`,
          cells: [<ItemTitle key="t" wide image={b.image?.url} icon={<GalleryHorizontal className="h-4 w-4" />} title={b.title} sub={b.subtitle ?? undefined} />, b.placement, b.endsAt && b.endsAt < now ? "Ended" : b.startsAt && b.startsAt > now ? `Starts ${formatDateTime(b.startsAt)}` : b.endsAt ? `Until ${formatDateTime(b.endsAt)}` : "Always"],
          values: { title: b.title, subtitle: b.subtitle, placement: b.placement, theme: b.theme ?? "brand", ctaLabel: b.ctaLabel, ctaUrl: b.ctaUrl, imageId: b.imageId, mobileImageId: b.mobileImageId, _image: b.image?.url, _mobile: b.mobileImage?.url, startsAt: local(b.startsAt), endsAt: local(b.endsAt), isActive: b.isActive },
        }))}
        fields={FIELDS}
        emptyValues={{ title: "", placement: "home.hero", theme: "brand", isActive: true }}
        save={saveBannerAction}
        remove={deleteBannerAction}
        reorder={reorderBannersAction}
        toggle={toggleBannerAction}
      />
    </>
  );
}
