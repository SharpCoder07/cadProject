import { requirePermission } from "@/server/auth/session";
import { getStoredSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/page-header";
import { CaseList, type CaseSP } from "../_cases/list";

export const metadata = { title: "Grievances" };

export default async function Page({ searchParams }: { searchParams: Promise<CaseSP> }) {
  const user = await requirePermission("compliance.view", "/admin/compliance/grievances");
  const c = (await getStoredSettings()).compliance;
  const missing = !c.grievanceAckDays && !c.grievanceResolveDays;
  return (
    <>
      <PageHeader title="Grievances" description="Complaints for the grievance officer about personal data, accounts, content, listings or partners." />
      <CaseList user={user} kind="GRIEVANCE" sp={await searchParams} base="/admin/compliance/grievances" settingsMissing={missing} />
    </>
  );
}
