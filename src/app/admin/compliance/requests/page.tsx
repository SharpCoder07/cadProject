import { requirePermission } from "@/server/auth/session";
import { getStoredSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/page-header";
import { CaseList, type CaseSP } from "../_cases/list";

export const metadata = { title: "Data requests" };

export default async function Page({ searchParams }: { searchParams: Promise<CaseSP> }) {
  const user = await requirePermission("compliance.view", "/admin/compliance/requests");
  const c = (await getStoredSettings()).compliance;
  const missing = !c.dataRequestDays;
  return (
    <>
      <PageHeader title="Data requests" description="Requests to access, correct or delete personal data, withdraw consent or nominate someone. Signed-out requests count once the requester confirms their email." />
      <CaseList user={user} kind="DATA_REQUEST" sp={await searchParams} base="/admin/compliance/requests" settingsMissing={missing} />
    </>
  );
}
