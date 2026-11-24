import { notFound } from "next/navigation";
import { AppError } from "@/server/errors";
import { pendingSoftwareProposal, requestStateFor } from "@/server/services/approvals";
import { PageHeader } from "@/components/admin/page-header";
import { SoftwareEditor } from "@/components/admin/software-editor";
import { loadEditor } from "@/app/admin/software/load";
import { requireVendor } from "../../_lib";

export const metadata = { title: "Edit product" };
export const dynamic = "force-dynamic";

export default async function VendorEditListing({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireVendor("vendor.listings", `/vendor/listings/${id}`);
  // A pending edit is shown instead of the live values, so the vendor keeps working on their proposal.
  const [proposal, states] = await Promise.all([pendingSoftwareProposal(user, id), requestStateFor(user.vendorId, "SOFTWARE", [id])]);
  const props = await loadEditor(user, id, "/vendor/listings", proposal).catch((e) => {
    if (e instanceof AppError && (e.code === "NOT_FOUND" || e.code === "FORBIDDEN")) notFound();
    throw e;
  });
  const state = states.get(id);
  return (
    <>
      <PageHeader title={props.defaults.name} back={{ href: "/vendor/listings", label: "Products" }} />
      <SoftwareEditor key={`${id}-${state?.id ?? "none"}`} {...props} approval={state ? { ...state, updatedAt: state.updatedAt.toISOString() } : null} />
    </>
  );
}
