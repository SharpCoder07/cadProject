import { db } from "@/server/db";
import { pendingProfileProposal, requestStateFor } from "@/server/services/approvals";
import { Alert, Panel } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { VendorForm } from "@/components/admin/vendor-form";
import { requireVendor } from "../_lib";

export const metadata = { title: "Company profile" };
export const dynamic = "force-dynamic";

export default async function VendorProfile() {
  const user = await requireVendor("vendor.portal", "/vendor/profile");
  const canEdit = user.permissions.has("vendor.profile");
  const [v, proposal, states] = await Promise.all([
    db.vendor.findUniqueOrThrow({ where: { id: user.vendorId }, include: { logo: true } }),
    pendingProfileProposal(user.vendorId),
    requestStateFor(user.vendorId, "VENDOR_PROFILE", [user.vendorId]),
  ]);
  const state = states.get(user.vendorId);
  const live = {
    name: v.name, slug: v.slug, legalName: v.legalName, description: v.description, website: v.website, email: v.email, phone: v.phone, addressLine: v.addressLine,
    city: v.city, state: v.state, country: v.country, foundedYear: v.foundedYear, employeeRange: v.employeeRange, logoId: v.logoId, isActive: v.isActive, receivesLeads: v.receivesLeads, serviceCities: v.serviceCities,
    seo: { title: null, description: null, keywords: null, canonicalUrl: null, noIndex: false, ogImageId: null },
  };
  const defaults = proposal ? { ...live, ...proposal, seo: live.seo } : live;
  const logoPreview = proposal?.logoId && proposal.logoId !== v.logoId ? (await db.mediaAsset.findUnique({ where: { id: proposal.logoId }, select: { url: true } }))?.url : v.logo?.url;
  return (
    <>
      <PageHeader title="Company profile" description="Manage how your company appears on the website." />
      {state?.status === "PENDING" && <Alert tone="warning" className="mb-4 max-w-4xl" title="Changes waiting for approval">The form shows your proposed version. The public profile stays as it is until it&apos;s approved.</Alert>}
      {state?.status === "REJECTED" && <Alert tone="danger" className="mb-4 max-w-4xl" title="Your last profile change was rejected">{state.decisionNote ?? "No reason given."}</Alert>}
      <Panel className="max-w-4xl p-5">
        <VendorForm key={state?.id ?? "live"} id={v.id} mode="vendor" kind={v.kind} readOnly={!canEdit} logoPreview={logoPreview} defaults={defaults} />
      </Panel>
    </>
  );
}
