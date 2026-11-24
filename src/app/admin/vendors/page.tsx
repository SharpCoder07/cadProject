import Link from "next/link";
import { BadgeCheck, Building2, Clock, Package, Plus, Store } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { formatNumber } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { AdminTable, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, showing } from "@/components/admin/list-panel";
import { ListSearch } from "@/components/site/list-search";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { deleteVendorAction, setVerificationAction } from "./actions";

export const metadata = { title: "Vendors" };
const V_TONE = { VERIFIED: "success", PENDING: "warning", REJECTED: "danger", UNVERIFIED: "neutral" } as const;
const V_LABEL = { VERIFIED: "Verified", PENDING: "Pending", REJECTED: "Rejected", UNVERIFIED: "Unverified" } as const;
const PER_PAGE = 30;

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ q?: string; v?: string; page?: string }> }) {
  await requirePermission("vendors.view", "/admin/vendors");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const v = sp.v && sp.v in V_TONE ? (sp.v as keyof typeof V_TONE) : undefined;
  const where = {
    kind: "VENDOR" as const,
    ...(sp.q ? { name: { contains: sp.q, mode: "insensitive" as const } } : {}),
    ...(v ? { verification: v } : {}),
  };
  const [vendors, total, byStatus, withPortal, products] = await Promise.all([
    db.vendor.findMany({ where, orderBy: { name: "asc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { logo: { select: { url: true } }, _count: { select: { software: true, brands: true, users: true, leads: true } } } }),
    db.vendor.count({ where }),
    db.vendor.groupBy({ by: ["verification"], where: { kind: "VENDOR" }, _count: { _all: true }, orderBy: { verification: "asc" } }),
    db.vendor.count({ where: { kind: "VENDOR", users: { some: {} } } }),
    db.software.count({ where: { vendorId: { not: null }, status: "PUBLISHED" } }),
  ]);
  const count = (k?: keyof typeof V_TONE) => byStatus.filter((b) => !k || b.verification === k).reduce((n, b) => n + (typeof b._count === "object" ? b._count._all ?? 0 : 0), 0);
  const href = (val?: string) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, v: val }).filter(([, x]) => x) as [string, string][]);
    return p.toString() ? `/admin/vendors?${p}` : "/admin/vendors";
  };
  return (
    <SelectionProvider>
      <PageHeader title="Vendors" description="Manage every software company on your marketplace." actions={<ButtonLink size="sm" href="/admin/vendors/new"><Plus className="h-4 w-4" aria-hidden /> Add vendor</ButtonLink>} />
      <PageStats
        items={[
          { label: "Vendors", value: formatNumber(count()), icon: Building2, tone: "red", sub: "Companies on your platform" },
          { label: "Verified", value: formatNumber(count("VERIFIED")), icon: BadgeCheck, tone: "green", sub: "Shown with a verified badge", href: href("VERIFIED") },
          { label: "Pending verification", value: formatNumber(count("PENDING")), icon: Clock, tone: count("PENDING") ? "amber" : "neutral", sub: count("PENDING") ? "Waiting for your check" : "Nothing waiting", href: href("PENDING") },
          { label: "Using the portal", value: formatNumber(withPortal), icon: Store, sub: `${formatNumber(products)} published products from vendors` },
        ]}
      />
      <BulkActionBar
        noun="vendor"
        items={[
          { label: "Mark verified", action: setVerificationAction, extra: { verification: "VERIFIED" }, done: "Verified" },
          { label: "Mark pending", action: setVerificationAction, extra: { verification: "PENDING" }, done: "Marked pending" },
          { label: "Reject", action: setVerificationAction, extra: { verification: "REJECTED" }, done: "Rejected", confirm: "Rejected vendors lose their verified badge. Their products stay listed." },
          { label: "Delete", action: deleteVendorAction, done: "Deleted", danger: true, confirm: "Vendors that still have products or portal users are skipped." },
        ]}
      />
      <ListPanel
        tabs={
          <PillTabs
            label="Verification"
            items={[
              { href: href(), label: "All", count: count(), active: !v },
              ...(["VERIFIED", "PENDING", "UNVERIFIED", "REJECTED"] as const).map((k) => ({ href: href(k), label: V_LABEL[k], count: count(k), active: v === k })),
            ]}
          />
        }
        meta={showing(page, PER_PAGE, total)}
        actions={<ListSearch panel placeholder="Search vendors…" basePath="/admin/vendors" params={{ v, q: sp.q }} scopeLabel="Vendors" className="w-full sm:w-72" />}
        footer={<PanelPagination page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} basePath="/admin/vendors" params={sp} />}
      >
        {vendors.length === 0 ? (
          <PanelEmpty icon={<Building2 className="h-5 w-5" />} title="No vendors found" action={<ButtonLink size="sm" href="/admin/vendors/new" variant="secondary"><Plus className="h-4 w-4" aria-hidden /> Add vendor</ButtonLink>}>Try another search.</PanelEmpty>
        ) : (
          <AdminTable bare minWidth={52}>
            <thead><tr><th className="w-10"><AllCheckbox ids={vendors.map((x) => x.id)} /></th><th>Vendor</th><th>Verification</th><th className="text-right">Products</th><th className="text-right">Brands</th><th className="text-right">Portal users</th><th className="text-right">Leads</th></tr></thead>
            <tbody>
              {vendors.map((x) => (
                <tr key={x.id}>
                  <td><RowCheckbox id={x.id} label={x.name} /></td>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-white">
                        {x.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- small logo
                          <img src={x.logo.url} alt="" className="h-full w-full object-contain p-1" />
                        ) : (
                          <span className="text-sm font-bold text-primary">{x.name.slice(0, 1)}</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <Link href={`/admin/vendors/${x.id}`} className="font-semibold text-ink hover:text-mint-ink">{x.name}</Link>
                        {!x.isActive && <Badge className="ml-2">Inactive</Badge>}
                        <span className="block truncate text-xs text-muted">{[x.city, x.country].filter(Boolean).join(", ") || "Location not set"}</span>
                      </span>
                    </div>
                  </td>
                  <td><Badge tone={V_TONE[x.verification]}>{V_LABEL[x.verification]}</Badge></td>
                  <td className="text-right font-semibold tabular-nums"><span className="inline-flex items-center gap-1"><Package className="h-3.5 w-3.5 text-muted" aria-hidden />{x._count.software}</span></td>
                  <td className="text-right tabular-nums">{x._count.brands}</td>
                  <td className="text-right tabular-nums">{x._count.users}</td>
                  <td className="text-right tabular-nums">{x._count.leads}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
