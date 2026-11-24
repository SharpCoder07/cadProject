import Link from "next/link";
import { Package } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { notFound, redirect } from "next/navigation";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { VendorForm } from "@/components/admin/vendor-form";
import { NextSteps } from "@/components/admin/next-steps";
import { CrudManager } from "@/components/admin/crud-manager";
import { deleteBrandAction, saveBrandAction } from "../actions";
import { VerificationPanel } from "../verification";
import { DeleteVendor } from "./delete-vendor";

export const metadata = { title: "Vendor" };

export default async function VendorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("vendors.view", `/admin/vendors/${id}`);
  const isNew = id === "new";
  const v = isNew ? null : await db.vendor.findUnique({ where: { id }, include: { logo: true, seo: true, brands: { orderBy: { name: "asc" }, include: { logo: true } }, users: { select: { id: true, name: true, email: true, status: true } }, _count: { select: { software: true } } } });
  if (!isNew && !v) notFound();
  if (v?.kind === "RESELLER") redirect(`/admin/resellers/${v.id}`);
  return (
    <>
      <PageHeader title={v?.name ?? "Add vendor"} back={{ href: "/admin/vendors", label: "Vendors" }} actions={v && <Link href={`/admin/software?vendorId=${v.id}`} className={buttonClass("secondary", "sm")}><Package className="h-4 w-4" aria-hidden /> View products<span className="rounded-full bg-mint-soft px-2 text-xs font-semibold tabular-nums text-mint-ink">{v._count.software}</span></Link>} />
      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Panel className="p-5">
            <VendorForm
              id={v?.id ?? null}
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
            <Panel>
              <div className="border-b border-line px-5 py-4 sm:px-6">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-sans text-[15px] font-bold text-ink">Brands</h2>
                  <Link href="/admin/brands" className={buttonClass("secondary", "sm")}>All brands</Link>
                </div>
                <p className="mt-3 text-sm text-muted">Brands owned by this company. All brands, including ones not owned by a vendor, are under Products.</p>
              </div>
              <div className="p-5">
                <CrudManager
                  entity="brand"
                  newLabel="Add brand"
                  columns={["Brand", "Slug"]}
                  rows={v.brands.map((b) => ({ id: b.id, cells: [b.name, b.slug], values: { name: b.name, slug: b.slug, description: b.description, website: b.website, vendorId: v.id, logoId: b.logoId, _logo: b.logo?.url, isActive: b.isActive, sortOrder: b.sortOrder } }))}
                  fields={[
                    { name: "name", label: "Name", type: "text", required: true },
                    { name: "slug", label: "Slug", type: "text", required: true },
                    { name: "website", label: "Website", type: "text" },
                    { name: "logoId", label: "Logo", type: "media", previewKey: "_logo" },
                    { name: "description", label: "Description", type: "textarea" },
                  ]}
                  emptyValues={{ name: "", slug: "", vendorId: v.id }}
                  save={saveBrandAction}
                  remove={deleteBrandAction}
                />
              </div>
            </Panel>
          )}
        </div>
        {v && (
          <aside className="space-y-4">
            <Panel>
              <PanelHeader title="Verification" />
              <VerificationPanel id={v.id} verification={v.verification} canPublish={v.canPublish} allowed={user.permissions.has("vendors.verify")} />
            </Panel>
            <Panel>
              <PanelHeader title="Portal users" description="Invite from Users with the Vendor role." />
              <ul className="divide-y divide-line text-sm">
                {v.users.length === 0 && <li className="px-4 py-3 text-muted">No portal users yet.</li>}
                {v.users.map((u) => <li key={u.id} className="px-4 py-2.5"><Link href={`/admin/users/${u.id}`} className="hover:text-mint-ink">{u.name}</Link><span className="block text-xs text-muted">{u.email} · {u.status.toLowerCase()}</span></li>)}
              </ul>
            </Panel>
            <DeleteVendor id={v.id} />
          </aside>
        )}
        {!v && (
          <aside>
            <NextSteps
              steps={[
                { title: "Create the vendor", text: "Fill in the company details and upload their logo." },
                { title: "Add brands and products", text: "Add the brands they own on this page, then assign their products under Products." },
                { title: "Invite their team", text: "Users → Invite, with a Vendor role and this company." },
                { title: "Leads arrive automatically", text: "Every enquiry for their products is emailed to them and shown in their portal, masked until they buy a plan." },
              ]}
            />
          </aside>
        )}
      </div>
    </>
  );
}
