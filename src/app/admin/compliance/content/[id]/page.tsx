import { requirePermission } from "@/server/auth/session";
import { CaseDetail } from "../../_cases/detail";

export const metadata = { title: "Content complaint" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("compliance.view", `/admin/compliance/content/${id}`);
  return <CaseDetail user={user} id={id} kind="CONTENT_COMPLAINT" base="/admin/compliance/content" title="Content complaints" />;
}
