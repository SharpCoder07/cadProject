import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { SoftwareEditor } from "@/components/admin/software-editor";
import { loadEditor } from "../load";

export const metadata = { title: "Add software" };

export default async function NewSoftware() {
  const user = await requirePermission("software.create", "/admin/software/new");
  const props = await loadEditor(user, null, "/admin/software");
  return (
    <>
      <PageHeader title="Add software" description="Add a new listing; it stays a draft until you publish." back={{ href: "/admin/software", label: "Software" }} />
      <SoftwareEditor {...props} />
    </>
  );
}
