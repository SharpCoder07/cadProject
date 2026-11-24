import { PageHeader } from "@/components/admin/page-header";
import { SoftwareEditor } from "@/components/admin/software-editor";
import { loadEditor } from "@/app/admin/software/load";
import { requireVendor } from "../../_lib";

export const metadata = { title: "Add a product" };

export default async function VendorNewListing() {
  const user = await requireVendor("vendor.listings.submit", "/vendor/listings/new");
  return (
    <>
      <PageHeader title="Add a product" back={{ href: "/vendor/listings", label: "Products" }} description="Add a new listing; it goes live after approval." />
      <SoftwareEditor {...await loadEditor(user, null, "/vendor/listings")} />
    </>
  );
}
