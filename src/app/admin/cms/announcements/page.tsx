import { CalendarClock, CircleOff, Megaphone, Radio } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { PageStats } from "@/components/admin/page-stats";
import { ItemTitle } from "@/components/admin/list-panel";

import { deleteAnnouncementAction, reorderAnnouncementsAction, saveAnnouncementAction, toggleAnnouncementAction } from "../actions";

export const metadata = { title: "Announcements" };
const local = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

export default async function AnnouncementsPage() {
  await requirePermission("cms.navigation.view", "/admin/cms/announcements");
  const items = await db.announcement.findMany({ orderBy: { sortOrder: "asc" } });
  const now = new Date();
  const live = items.filter((a) => a.isActive && (!a.startsAt || a.startsAt <= now) && (!a.endsAt || a.endsAt > now)).length;
  const scheduled = items.filter((a) => a.isActive && a.startsAt && a.startsAt > now).length;
  const ended = items.filter((a) => a.endsAt && a.endsAt <= now).length;
  return (
    <>
      <PageHeader title="Announcements" description="Manage the announcement bar above your site header." actions={<CrudAddButton entity="announcement" label="Add announcement" />} />
      <PageStats
        items={[
          { label: "Announcements", value: items.length, icon: Megaphone, tone: "red", sub: "In total" },
          { label: "Showing now", value: live, icon: Radio, tone: "green", sub: "Visible to visitors" },
          { label: "Scheduled", value: scheduled, icon: CalendarClock, tone: scheduled ? "amber" : "neutral", sub: "Start automatically" },
          { label: "Ended", value: ended, icon: CircleOff, sub: "Past their end date" },
        ]}
      />
      <CrudManager
        addInHeader
        entity="announcement"
        newLabel="Add announcement"
        columns={["Message", "Style", "Ends"]}
        rows={items.map((a) => ({
          id: a.id,
          active: a.isActive,
          name: a.message, searchText: a.message, cells: [<ItemTitle key="t" icon={<Megaphone className="h-4 w-4" />} title={a.message} sub={a.linkUrl ?? undefined} />, a.variant, a.endsAt ? formatDateTime(a.endsAt) : "Never"],
          values: { message: a.message, linkLabel: a.linkLabel, linkUrl: a.linkUrl, variant: a.variant, startsAt: local(a.startsAt), endsAt: local(a.endsAt), isActive: a.isActive },
        }))}
        fields={[
          { name: "message", label: "Message", type: "text", required: true, wide: true },
          { name: "linkLabel", label: "Link label", type: "text" },
          { name: "linkUrl", label: "Link", type: "text", placeholder: "/offers" },
          { name: "variant", label: "Style", type: "select", options: [{ value: "info", label: "Information" }, { value: "promo", label: "Promotion" }, { value: "warning", label: "Warning" }] },
          { name: "startsAt", label: "Show from (IST)", type: "datetime" },
          { name: "endsAt", label: "Show until (IST)", type: "datetime" },
          { name: "isActive", label: "Active", type: "switch" },
        ]}
        emptyValues={{ message: "", variant: "info", isActive: true }}
        save={saveAnnouncementAction}
        remove={deleteAnnouncementAction}
        reorder={reorderAnnouncementsAction}
        toggle={toggleAnnouncementAction}
      />
    </>
  );
}
