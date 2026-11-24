import { requirePermission } from "@/server/auth/session";
import { CategoryFormPage } from "../form-page";

export const metadata = { title: "Edit category" };
export default async function EditCategory({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("categories.view", `/admin/categories/${id}`);
  return <CategoryFormPage user={user} id={id} />;
}
