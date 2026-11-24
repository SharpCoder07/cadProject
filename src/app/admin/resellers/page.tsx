import Link from "next/link";
import { BadgeCheck, Clock, Handshake, Inbox, MapPin, Plus } from "lucide-react";
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
import { deleteVendorAction, setVerificationAction } from "../vendors/actions";

export const metadata = { title: "Resellers" };
const V_TONE = { VERIFIED: "success", PENDING: "warning", REJECTED: "danger", UNVERIFIED: "neutral" } as const;
const V_LABEL = { VERIFIED: "Verified", PENDING: "Pending", REJECTED: "Rejected", UNVERIFIED: "Unverified" } as const;
const PER_PAGE = 30;

export default async function ResellersPage({ searchParams }: { searchParams: Promise<{ q?: string; v?: string; page?: string }> }) {
  await requirePermission("vendors.view", "/admin/resellers");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const v = sp.v && sp.v in V_TONE ? (sp.v as keyof typeof V_TONE) : undefined;
  const where = {
    kind: "RESELLER" as const,
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" as const } }, { city: { contains: sp.q, mode: "insensitive" as const } }, { serviceCities: { has: sp.q } }] } : {}),
    ...(v ? { verification: v } : {}),
  };
  const now = new Date();
  const [rows, total, byStatus, authorised, forwarded, applications] = await Promise.all([
    db.vendor.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        logo: { select: { url: true } },
        _count: { select: { authorisedProducts: true, users: true, resellerLeads: true } },
        subscriptions: { where: { status: "ACTIVE", periodStart: { lte: now }, periodEnd: { gt: now } }, select: { planName: true }, take: 1 },
      },
    }),
    db.vendor.count({ where }),
    db.vendor.groupBy({ by: ["verification"], where: { kind: "RESELLER" }, _count: { _all: true }, orderBy: { verification: "asc" } }),
    db.resellerProduct.count(),
    db.lead.count({ where: { resellers: { some: {} }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
    db.lead.count({ where: { source: "BECOME_RESELLER", status: "NEW" } }),
  ]);
  const count = (k?: keyof typeof V_TONE) => byStatus.filter((b) => !k || b.verification === k).reduce((n, b) => n + (typeof b._count === "object" ? b._count._all ?? 0 : 0), 0);
  const href = (val?: string) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, v: val }).filter(([, x]) => x) as [string, string][]);
    return p.toString() ? `/admin/resellers?${p}` : "/admin/resellers";
  };
  return (
    <SelectionProvider>
      <PageHeader title="Resellers" description="Manage every reseller partner and the products they sell." actions={<ButtonLink size="sm" href="/admin/resellers/new"><Plus className="h-4 w-4" aria-hidden /> Add reseller</ButtonLink>} />
      <PageStats
        items={[
          { label: "Resellers", value: formatNumber(count()), icon: Handshake, tone: "red", sub: `${formatNumber(count("VERIFIED"))} verified` },
          { label: "Authorised products", value: formatNumber(authorised), icon: BadgeCheck, tone: "green", sub: "Reseller–product links" },
          { label: "Leads shared", value: formatNumber(forwarded), icon: Inbox, sub: "Enquiries sent to resellers, last 30 days" },
          { label: "New applications", value: formatNumber(applications), icon: Clock, tone: applications ? "amber" : "neutral", sub: applications ? "From “Become a reseller”" : "Nothing waiting", href: "/admin/leads?source=BECOME_RESELLER&status=ALL" },
        ]}
      />
      <BulkActionBar
        noun="reseller"
        items={[
          { label: "Mark verified", action: setVerificationAction, extra: { verification: "VERIFIED" }, done: "Verified" },
          { label: "Mark pending", action: setVerificationAction, extra: { verification: "PENDING" }, done: "Marked pending" },
          { label: "Reject", action: setVerificationAction, extra: { verification: "REJECTED" }, done: "Rejected", confirm: "Rejected resellers lose their verified badge." },
          { label: "Delete", action: deleteVendorAction, done: "Deleted", danger: true, confirm: "Resellers that still have portal users are skipped." },
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
        actions={<ListSearch panel placeholder="Search resellers or cities…" basePath="/admin/resellers" params={{ v, q: sp.q }} scopeLabel="Resellers" className="w-full sm:w-72" />}
        footer={<PanelPagination page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} basePath="/admin/resellers" params={sp} />}
      >
        {rows.length === 0 ? (
          <PanelEmpty icon={<Handshake className="h-5 w-5" />} title={sp.q || v ? "No resellers found" : "No resellers yet"} action={<ButtonLink size="sm" href="/admin/resellers/new" variant="secondary"><Plus className="h-4 w-4" aria-hidden /> Add reseller</ButtonLink>}>
            {sp.q || v ? "Try another search." : "Add your first reseller partner, then invite their team from Users with the Reseller Admin role."}
          </PanelEmpty>
        ) : (
          <AdminTable bare minWidth={56}>
            <thead><tr><th className="w-10"><AllCheckbox ids={rows.map((x) => x.id)} /></th><th>Reseller</th><th>Verification</th><th>Cities served</th><th>Plan</th><th className="text-right">Products</th><th className="text-right">Users</th><th className="text-right">Leads</th></tr></thead>
            <tbody>
              {rows.map((x) => (
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
                        <Link href={`/admin/resellers/${x.id}`} className="font-semibold text-ink hover:text-mint-ink">{x.name}</Link>
                        {!x.isActive && <Badge className="ml-2">Inactive</Badge>}
                        <span className="block truncate text-xs text-muted">{[x.city, x.state].filter(Boolean).join(", ") || "Location not set"}</span>
                      </span>
                    </div>
                  </td>
                  <td><Badge tone={V_TONE[x.verification]}>{V_LABEL[x.verification]}</Badge></td>
                  <td className="max-w-[14rem]">
                    {x.serviceCities.length ? (
                      <span className="inline-flex items-start gap-1 text-sm"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden /><span className="line-clamp-2">{x.serviceCities.join(", ")}</span></span>
                    ) : <span className="text-sm text-muted">—</span>}
                  </td>
                  <td>{x.subscriptions[0] ? <Badge tone="success">{x.subscriptions[0].planName}</Badge> : <span className="text-sm text-muted">Free</span>}</td>
                  <td className="text-right font-semibold tabular-nums">{x._count.authorisedProducts}</td>
                  <td className="text-right tabular-nums">{x._count.users}</td>
                  <td className="text-right tabular-nums">{x._count.resellerLeads}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
