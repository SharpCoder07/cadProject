import { requirePermission } from "@/server/auth/session";
import { CaseDetail } from "../../_cases/detail";

export const metadata = { title: "Data requests" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("compliance.view", "/admin/compliance/requests/" + id);
  return <CaseDetail user={user} id={id} kind="DATA_REQUEST" base="/admin/compliance/requests" title="Data requests" />;
}
