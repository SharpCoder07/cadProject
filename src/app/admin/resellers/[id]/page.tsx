import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { formatDate } from "@/lib/format";
import { Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { VendorForm } from "@/components/admin/vendor-form";
import { NextSteps } from "@/components/admin/next-steps";
import { AuthorisedProducts } from "@/components/vendor/authorised-products";
import { VerificationPanel } from "../../vendors/verification";
import { DeleteVendor } from "../../vendors/[id]/delete-vendor";
import { removeAuthorisedProductAction, setAuthorisedProductAction } from "../actions";

export const metadata = { title: "Reseller" };

export default async function ResellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("vendors.view", `/admin/resellers/${id}`);
  const isNew = id === "new";
  const now = new Date();
  const v = isNew
    ? null
    : await db.vendor.findUnique({
        where: { id },
        include: {
          logo: true,
          seo: true,
          users: { select: { id: true, name: true, email: true, status: true } },
          authorisedProducts: { orderBy: { software: { name: "asc" } }, include: { software: { select: { id: true, name: true, slug: true, logo: { select: { url: true } }, vendor: { select: { name: true } } } } } },
          subscriptions: { where: { status: "ACTIVE", periodStart: { lte: now }, periodEnd: { gt: now } }, orderBy: { periodEnd: "desc" }, take: 1, select: { planName: true, periodEnd: true } },
          _count: { select: { resellerLeads: true } },
        },
      });
  if (!isNew && !v) notFound();
  if (v && v.kind !== "RESELLER") redirect(`/admin/vendors/${v.id}`);
  const plan = v?.subscriptions[0];
  // Server actions bound to this reseller.
  async function save(input: { softwareId: string; partnerLevel: string | null }) {
    "use server";
    return setAuthorisedProductAction({ resellerId: id, ...input });
  }
  async function remove(input: { softwareId: string }) {
    "use server";
    return removeAuthorisedProductAction({ resellerId: id, ...input });
  }
  return (
    <>
      <PageHeader
        title={v?.name ?? "Add reseller"}
        description={v ? undefined : "A channel partner that resells vendors' products."}
        back={{ href: "/admin/resellers", label: "Resellers" }}
        size="sm"
        actions={v && <Link href={`/resellers/${v.slug}`} target="_blank" className={buttonClass("secondary", "sm")}>Public page <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Panel className="p-5">
            <VendorForm
              id={v?.id ?? null}
              kind="RESELLER"
              logoPreview={v?.logo?.url}
              defaults={{
                name: v?.name ?? "", slug: v?.slug ?? "", legalName: v?.legalName ?? null, description: v?.description ?? null, website: v?.website ?? null, email: v?.email ?? null, phone: v?.phone ?? null,
                addressLine: v?.addressLine ?? null, city: v?.city ?? null, state: v?.state ?? null, country: v?.country ?? "India", foundedYear: v?.foundedYear ?? null, employeeRange: v?.employeeRange ?? null,
                logoId: v?.logoId ?? null, isActive: v?.isActive ?? true, receivesLeads: v?.receivesLeads ?? true, serviceCities: v?.serviceCities ?? [],
                seo: { title: v?.seo?.title ?? null, description: v?.seo?.description ?? null, keywords: v?.seo?.keywords ?? null, canonicalUrl: v?.seo?.canonicalUrl ?? null, noIndex: v?.seo?.noIndex ?? false, ogImageId: v?.seo?.ogImageId ?? null },
              }}
            />
          </Panel>
          {v && (
            <AuthorisedProducts
              mode="admin"
              rows={v.authorisedProducts.map((a) => ({ softwareId: a.software.id, name: a.software.name, slug: a.software.slug, vendorName: a.software.vendor?.name ?? null, logoUrl: a.software.logo?.url ?? null, partnerLevel: a.partnerLevel }))}
              save={save}
              remove={remove}
            />
          )}
        </div>
        {v && (
          <aside className="space-y-4">
            <Panel>
              <PanelHeader title="Verification" />
              <VerificationPanel id={v.id} verification={v.verification} canPublish={v.canPublish} allowed={user.permissions.has("vendors.verify")} />
            </Panel>
            <Panel>
              <PanelHeader title="Plan & leads" />
              <dl className="space-y-3 p-5 text-sm">
                <div className="flex items-center justify-between gap-3"><dt className="text-muted">Plan</dt><dd>{plan ? <Badge tone="success">{plan.planName}</Badge> : <span className="text-muted">None (contacts masked)</span>}</dd></div>
                {plan?.periodEnd && <div className="flex justify-between gap-3"><dt className="text-muted">Renews by</dt><dd>{formatDate(plan.periodEnd)}</dd></div>}
                <div className="flex justify-between gap-3"><dt className="text-muted">Leads received</dt><dd><Link href={`/admin/leads?status=ALL&reseller=${v.id}`} className="font-medium hover:underline">{v._count.resellerLeads}</Link></dd></div>
              </dl>
            </Panel>
            <Panel>
              <PanelHeader title="Portal users" description="Invite from Users with the Reseller Admin role." />
              <ul className="divide-y divide-line text-sm">
                {v.users.length === 0 && <li className="px-4 py-3 text-muted">No portal users yet.</li>}
                {v.users.map((u) => <li key={u.id} className="px-4 py-2.5"><Link href={`/admin/users/${u.id}`} className="hover:text-mint-ink">{u.name}</Link><span className="block text-xs text-muted">{u.email} · {u.status.toLowerCase()}</span></li>)}
              </ul>
            </Panel>
            <DeleteVendor id={v.id} reseller />
          </aside>
        )}
        {!v && (
          <aside>
            <NextSteps
              steps={[
                { title: "Create the reseller", text: "Fill in the company details and the cities they serve." },
                { title: "Invite their team", text: "Users → Invite, with the Reseller Admin role and this company." },
                { title: "They choose products", text: "In their portal they browse products and click Become a reseller; you approve each one." },
                { title: "Leads arrive automatically", text: "Every enquiry for those products is emailed to them and shown in their portal, masked until they buy a plan." },
              ]}
              note="You can also add authorised products yourself on the reseller's page after creating it."
            />
          </aside>
        )}
      </div>
    </>
  );
}
