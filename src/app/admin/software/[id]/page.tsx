import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { Alert } from "@/components/ui/misc";
import { requirePermission } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { PageHeader } from "@/components/admin/page-header";
import { SoftwareEditor } from "@/components/admin/software-editor";
import { loadEditor } from "../load";
import { DuplicateButton } from "./duplicate-button";

export const metadata = { title: "Edit software" };

export default async function EditSoftware({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("software.edit", `/admin/software/${id}`);
  const props = await loadEditor(user, id, "/admin/software").catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  const pending = await db.approvalRequest.findFirst({ where: { entityType: "SOFTWARE", entityId: id, status: "PENDING" }, select: { id: true, action: true, vendor: { select: { name: true } } } });
  return (
    <>
      {pending && (
        <Alert tone="warning" className="mb-4" title={`${pending.vendor.name} has a request waiting for this product`}>
          {user.permissions.has("approvals.manage") ? <Link href={`/admin/approvals/${pending.id}`} className="font-semibold underline">Review the request</Link> : "A Super Admin needs to review it."} Edits you save here may be replaced if that request is approved.
        </Alert>
      )}
      <PageHeader
        title={props.defaults.name}
        back={{ href: "/admin/software", label: "Software" }}
        actions={user.permissions.has("software.create") && <DuplicateButton id={id} />}
      />
      <SoftwareEditor key={id} {...props} />
    </>
  );
}
