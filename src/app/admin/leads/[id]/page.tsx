import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { getLead } from "@/server/services/leads";
import { AppError } from "@/server/errors";
import { PageHeader } from "@/components/admin/page-header";
import { LeadSummary, LeadTimeline } from "@/components/admin/lead-detail";
import { AddNote, LeadControls } from "./lead-controls";
import { ResellerPanel } from "./reseller-panel";

export const metadata = { title: "Lead" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("leads.view", `/admin/leads/${id}`);
  const lead = await getLead(user, id).catch((e) => { if (e instanceof AppError && e.code === "NOT_FOUND") notFound(); throw e; });
  const staff = await db.user.findMany({ where: { status: "ACTIVE", vendorId: null }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const canManage = user.permissions.has("leads.manage");
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  return (
    <>
      <PageHeader title={lead.name} description={`Lead ${lead.referenceNo}`} back={{ href: "/admin/leads", label: "Leads" }} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <LeadSummary lead={lead} staffNames={names} showInternal noteForm={canManage ? <AddNote id={lead.id} /> : undefined}
          besideNotes={canManage ? <LeadControls id={lead.id} status={lead.status} priority={lead.priority} type={lead.type} assignedToId={lead.assignedToId} nextFollowUpAt={lead.nextFollowUpAt?.toISOString() ?? null} staff={staff} /> : undefined}
        />
        <aside className="space-y-5 xl:self-start">
          {canManage && <LeadTimeline lead={lead} staffNames={names} className="" />}
          <ResellerPanel rows={lead.resellers} />
        </aside>
      </div>
    </>
  );
}
