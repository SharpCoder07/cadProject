import { requirePermission } from "@/server/auth/session";
import { CaseDetail } from "../../_cases/detail";

export const metadata = { title: "Grievances" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("compliance.view", "/admin/compliance/grievances/" + id);
  return <CaseDetail user={user} id={id} kind="GRIEVANCE" base="/admin/compliance/grievances" title="Grievances" />;
}
