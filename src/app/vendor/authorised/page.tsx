import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { listMyAuthorised } from "@/server/services/resellers";
import { PageHeader } from "@/components/admin/page-header";
import { AuthorisedProducts } from "@/components/vendor/authorised-products";
import { requireVendor } from "../_lib";
import { proposeAuthorisedAction, proposeAuthorisedRemovalAction } from "./actions";

export const metadata = { title: "Authorised products" };
export const dynamic = "force-dynamic";

export default async function AuthorisedPage() {
  const user = await requireVendor("vendor.portal", "/reseller/authorised");
  const company = await db.vendor.findUniqueOrThrow({ where: { id: user.vendorId }, select: { kind: true } });
  if (company.kind !== "RESELLER") redirect("/vendor/listings");
  const { items, pendingNew } = await listMyAuthorised(user);
  // Products asked for but not approved yet are shown too, marked “waiting for approval”.
  const waiting = pendingNew.length
    ? await db.software.findMany({
        where: { id: { in: pendingNew.map((p) => p.entityId.split(":")[1] ?? "") } },
        select: { id: true, name: true, slug: true, logo: { select: { url: true } }, vendor: { select: { name: true } } },
      })
    : [];
  const rows = [
    ...items.map((i) => ({ softwareId: i.software.id, name: i.software.name, slug: i.software.slug, vendorName: i.software.vendor?.name ?? null, logoUrl: i.software.logo?.url ?? null, partnerLevel: i.partnerLevel, pending: (i.pending?.action ?? null) as "UPDATE" | "DELETE" | null })),
    ...waiting.map((w) => ({
      softwareId: w.id,
      name: w.name,
      slug: w.slug,
      vendorName: w.vendor?.name ?? null,
      logoUrl: w.logo?.url ?? null,
      partnerLevel: ((pendingNew.find((p) => p.entityId.endsWith(`:${w.id}`))?.payload ?? null) as { partnerLevel?: string | null } | null)?.partnerLevel ?? null,
      pending: "CREATE" as const,
    })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <>
      <PageHeader title="Authorised products" description="Choose the products you resell. Each one is checked by our team before it goes live." />
      <div className="max-w-4xl">
        <AuthorisedProducts mode="portal" rows={rows} canEdit={user.permissions.has("vendor.authorised")} save={proposeAuthorisedAction} remove={proposeAuthorisedRemovalAction} />
      </div>
    </>
  );
}
