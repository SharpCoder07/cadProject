import { notFound, redirect } from "next/navigation";
import { getLead } from "@/server/services/leads";
import { AppError } from "@/server/errors";
import { PageHeader } from "@/components/admin/page-header";
import { LeadSummary } from "@/components/admin/lead-detail";
import { ContactValue, LockedBanner, UpgradeProvider, ViewNowButton } from "@/components/vendor/contact-lock";
import { requireVendor } from "../../_lib";
import { upgradeBilling } from "../../_billing";

export const metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

export default async function VendorLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireVendor("vendor.leads", `/vendor/leads/${id}`);
  const lead = await getLead(user, id).catch((e) => {
    if (e instanceof AppError && e.code === "FORBIDDEN") redirect("/vendor?denied=1");
    if (e instanceof AppError) notFound();
    throw e;
  });
  return (
    <UpgradeProvider billing={lead.contactLocked ? await upgradeBilling(user) : undefined}>
      <PageHeader title={lead.name} back={{ href: "/vendor/leads", label: "Leads" }} actions={lead.contactLocked ? <ViewNowButton /> : undefined} />
      <div className="max-w-3xl">
        {lead.contactLocked && <LockedBanner />}
        {/* Internal notes and the staff timeline stay private to the marketplace team. */}
        <LeadSummary
          lead={lead}
          staffNames={{}}
          showInternal={false}
          contact={
            <>
              <ContactValue kind="email" value={lead.email} locked={lead.contactLocked} />
              <ContactValue kind="phone" value={lead.phone} locked={lead.contactLocked} />
            </>
          }
        />
      </div>
    </UpgradeProvider>
  );
}
