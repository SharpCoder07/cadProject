import { requirePermission } from "@/server/auth/session";
import { getStoredSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/page-header";
import { CaseList, type CaseSP } from "../_cases/list";

export const metadata = { title: "Content complaints" };

export default async function Page({ searchParams }: { searchParams: Promise<CaseSP> }) {
  const user = await requirePermission("compliance.view", "/admin/compliance/content");
  const c = (await getStoredSettings()).compliance;
  return (
    <>
      <PageHeader title="Content complaints" description="Notices about content on the website: copyright, trademarks, defamation, personal information or other unlawful content. Record what was done with the content on each one." />
      <CaseList user={user} kind="CONTENT_COMPLAINT" sp={await searchParams} base="/admin/compliance/content" settingsMissing={!c.contentComplaintDays} />
    </>
  );
}
