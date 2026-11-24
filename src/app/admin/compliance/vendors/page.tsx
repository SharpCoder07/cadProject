import { BadgeCheck, CalendarClock, FileSignature, Handshake } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/rbac/policy";
import { DATA_ROLES, KYC_STATUSES, listVendorCompliance } from "@/server/services/compliance/vendors";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { CrudManager } from "@/components/admin/crud-manager";
import { saveVendorComplianceAction } from "../actions";

export const metadata = { title: "Vendor compliance" };

const local = (d: Date | null | undefined) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : null);
const KYC = Object.fromEntries(KYC_STATUSES.map((k) => [k.value, k.label]));

/** Compliance & Privacy › Vendor compliance: agreements, KYC, data processing terms and reviews per company. */
export default async function VendorCompliancePage() {
  const user = await requirePermission("compliance.view", "/admin/compliance/vendors");
  const rows = await listVendorCompliance(user);
  const editable = can(user, "compliance.manage");
  const now = new Date();
  const leadsNoDpa = rows.filter((r) => r.isActive && r.receivesLeads && !r.compliance?.dpaSigned).length;
  return (
    <>
      <PageHeader title="Vendor compliance" description="For each vendor and reseller: partner agreement accepted, identity/KYC checks, data processing terms for the leads they receive, and periodic reviews." />
      <PageStats
        items={[
          { label: "Agreement accepted", value: rows.filter((r) => r.agreement?.accepted).length, icon: FileSignature, tone: "green", sub: rows.some((r) => r.agreement) ? "Current version" : "No agreement in force yet" },
          { label: "KYC verified", value: rows.filter((r) => r.compliance?.kycStatus === "verified").length, icon: BadgeCheck, sub: `of ${rows.length} companies` },
          { label: "Get leads, no data terms", value: leadsNoDpa, icon: Handshake, tone: leadsNoDpa ? "red" : "neutral", sub: "Active and receiving leads" },
          { label: "Review due", value: rows.filter((r) => r.compliance?.nextReviewAt && r.compliance.nextReviewAt < now).length, icon: CalendarClock, sub: "Past the next review date" },
        ]}
      />
      <div className="mb-5 rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-muted">
        <span className="font-semibold text-ink">Legal review: </span>
        whether vendors receive leads as independent businesses or process data for you decides which terms you need with them. The agreements themselves are in Legal documents (Vendor listing agreement, Reseller partner agreement).
      </div>
      <CrudManager
        addInHeader
        entity="compliance record"
        columns={["Company", "Agreement", "KYC", "Data terms", "Next review"]}
        rows={rows.map((r) => {
          const c = r.compliance;
          return {
            id: r.id,
            name: r.name,
            searchText: `${r.name} ${r.kind}`,
            cells: [
              <span key="n"><span className="block font-medium text-ink">{r.name}</span><span className="block text-xs text-muted">{r.kind === "RESELLER" ? "Reseller" : "Vendor"}{r.isActive ? "" : " · inactive"}{r.receivesLeads ? " · gets leads" : ""}</span></span>,
              r.agreement ? (r.agreement.accepted ? `Accepted v${r.agreement.version}` : `Not accepted (v${r.agreement.version})`) : "None in force",
              KYC[c?.kycStatus ?? "not_started"] ?? "Not started",
              c?.dpaSigned ? `Signed${c.dpaSignedAt ? ` ${formatDate(c.dpaSignedAt)}` : ""}` : "Not signed",
              c?.nextReviewAt ? formatDate(c.nextReviewAt) : "—",
            ],
            values: {
              kycStatus: c?.kycStatus ?? "not_started",
              kycNote: c?.kycNote ?? "",
              gstinVerified: c?.gstinVerified ?? false,
              dpaSigned: c?.dpaSigned ?? false,
              dpaSignedAt: local(c?.dpaSignedAt),
              dataRole: c?.dataRole ?? "undecided",
              lastReviewedAt: local(c?.lastReviewedAt),
              nextReviewAt: local(c?.nextReviewAt),
              notes: c?.notes ?? "",
            },
          };
        })}
        fields={[
          { name: "kycStatus", label: "Identity / KYC check", type: "select", options: [...KYC_STATUSES] },
          { name: "gstinVerified", label: "GSTIN checked", type: "switch" },
          { name: "kycNote", label: "KYC note", type: "text", hint: "What was checked (documents are kept outside the platform)." },
          { name: "dataRole", label: "Role for the leads they receive", type: "select", options: [...DATA_ROLES] },
          { name: "dpaSigned", label: "Data processing terms signed", type: "switch" },
          { name: "dpaSignedAt", label: "Signed on", type: "datetime" },
          { name: "lastReviewedAt", label: "Last reviewed", type: "datetime" },
          { name: "nextReviewAt", label: "Next review", type: "datetime" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        emptyValues={{}}
        save={saveVendorComplianceAction}
        emptyText="No vendors or resellers yet."
      />
    </>
  );
}
