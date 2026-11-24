import { requirePermission } from "@/server/auth/session";
import { CategoryFormPage } from "../form-page";

export const metadata = { title: "Add category" };
export default async function NewCategory() {
  const user = await requirePermission("categories.create", "/admin/categories/new");
  return <CategoryFormPage user={user} id={null} />;
}
