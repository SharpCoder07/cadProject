import Link from "next/link";
import { Activity, BarChart3, Clock, Boxes, Building2, Columns3, FolderTree, Handshake, Inbox, Star, Tags, TrendingDown, TrendingUp } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { dashboardData } from "@/server/services/dashboard";
import { getSettings } from "@/server/settings";
import { db } from "@/server/db";
import { formatNumber, formatDateTime } from "@/lib/format";
import { LEAD_STATUS_LABEL } from "@/lib/validation/leads";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader, Badge, EmptyState } from "@/components/ui/misc";
import { EnquiriesDonut, LeadsChart, ViewsChart } from "@/components/admin/dashboard-charts";
import { AttentionTile, StatCard, type Tone } from "@/components/admin/dashboard-cards";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requirePermission("dashboard.view", "/admin");
  const d = await dashboardData(user);
  const has = (p: Parameters<typeof user.permissions.has>[0]) => user.permissions.has(p);
  const canLeads = has("leads.view");
  const delta = d.leads.prev15 ? Math.round(((d.leads.last15 - d.leads.prev15) / d.leads.prev15) * 100) : d.leads.last15 ? null : 0;
  const closed = d.leads.won + d.leads.lost;
  const conversion = closed ? `${((d.leads.won / closed) * 100).toFixed(1)}%` : "—";
  const siteName = (await getSettings()).site.name;

  const pendingApprovals = has("approvals.manage") ? await db.approvalRequest.count({ where: { status: "PENDING" } }) : 0;
  const attention = [
    has("approvals.manage") && { count: pendingApprovals, label: "Vendor approval requests", href: "/admin/approvals", tone: "rose" as Tone },
    canLeads && { count: d.leads.unassigned, label: "Unassigned leads", href: "/admin/leads?assignee=none", tone: "amber" as Tone },
    canLeads && { count: d.leads.followUpsDue, label: "Follow-ups due", href: "/admin/leads?followUp=due", tone: "rose" as Tone },
    canLeads && { count: d.leads.new, label: "New leads to review", href: "/admin/leads?status=NEW", tone: "blue" as Tone },
    has("software.view") && { count: d.software.inReview, label: "Products awaiting review", href: "/admin/software?status=IN_REVIEW", tone: "violet" as Tone },
    has("reviews.view") && { count: d.pendingReviews, label: "Reviews to moderate", href: "/admin/reviews", tone: "amber" as Tone },
    has("software.view") && { count: d.software.draft, label: "Draft products", href: "/admin/software?status=DRAFT", tone: "slate" as Tone },
    has("cms.pages.view") && { count: d.drafts.pages, label: "Draft pages", href: "/admin/cms/pages", tone: "slate" as Tone },
    has("blog.view") && { count: d.drafts.posts, label: "Draft blog posts", href: "/admin/blog?status=DRAFT", tone: "slate" as Tone },
  ].filter((x): x is { count: number; label: string; href: string; tone: Tone } => Boolean(x));
  const waiting = attention.filter((a) => a.count > 0).length;
  const [resellers, brands, approvedReviews] = await Promise.all([
    db.vendor.count({ where: { isActive: true, kind: "RESELLER" } }),
    db.brand.count({ where: { isActive: true } }),
    db.review.count({ where: { status: "APPROVED" } }),
  ]);
  const catalogue = [
    { label: "Published products", value: d.software.published, icon: Boxes, tint: "bg-[#F0FAF7] text-[#047857] dark:bg-emerald-500/10 dark:text-emerald-300", href: has("software.view") ? "/admin/software?status=PUBLISHED" : undefined },
    { label: "Categories", value: d.categories, icon: FolderTree, tint: "bg-[#FFF8EB] text-[#B45309] dark:bg-amber-500/10 dark:text-amber-300", href: has("categories.view") ? "/admin/categories" : undefined },
    { label: "Vendors", value: d.vendors, icon: Building2, tint: "bg-mint-soft text-mint-ink", href: has("vendors.view") ? "/admin/vendors" : undefined },
    { label: "Resellers", value: resellers, icon: Handshake, tint: "bg-success/10 text-success", href: has("vendors.view") ? "/admin/resellers" : undefined },
    { label: "Brands", value: brands, icon: Tags, tint: "bg-[#FFFBF2] text-[#C26A00] dark:bg-amber-500/10 dark:text-amber-300", href: has("vendors.view") ? "/admin/brands" : undefined },
    { label: "Published reviews", value: approvedReviews, icon: Star, tint: "bg-[#FFF6F6] text-primary dark:bg-rose-500/10", href: has("reviews.view") ? "/admin/reviews" : undefined },
  ];

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[1.375rem] font-bold leading-tight tracking-[-0.015em] sm:text-2xl">Welcome back, <span className="text-[#0F766E] dark:text-teal-300">{user.name}</span></h1>
        <p className="mt-1 text-sm text-muted">Monitor your {siteName} platform and manage daily operations.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canLeads ? (
          <>
            <StatCard
              label="Total leads"
              value={formatNumber(d.leads.total)}
              icon={Inbox}
              href="/admin/leads?status=ALL"
              aside={
                delta === null ? (
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">New</span>
                ) : (
                  <span title="Last 15 days vs the 15 before" className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", delta >= 0 ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
                    {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" aria-hidden /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden />}
                    {delta >= 0 ? "+" : ""}
                    {delta}%
                  </span>
                )
              }
              sub={`${formatNumber(d.leads.thisMonth)} this month · trend vs previous 15 days`}
            />
            <StatCard label="New today" value={formatNumber(d.leads.today)} valueClass="text-primary" chip="red" icon={Star} href="/admin/leads?status=NEW" sub={`${formatNumber(d.leads.new)} waiting to be reviewed`} />
            <StatCard label="Open pipeline" value={formatNumber(d.leads.open)} icon={Columns3} href="/admin/leads" sub={`${formatNumber(d.leads.qualified)} qualified`} />
            <StatCard label="Conversion rate" value={conversion} valueClass="text-success" chip="green" icon={BarChart3} href={has("analytics.view") ? "/admin/leads/reports" : undefined} sub={`${d.leads.won} won · ${d.leads.lost} lost`} />
          </>
        ) : (
          <>
            <StatCard label="Published products" value={formatNumber(d.software.published)} icon={Boxes} href={has("software.view") ? "/admin/software" : undefined} sub={`${d.software.draft} drafts · ${d.software.inReview} in review`} />
            <StatCard label="Categories" value={formatNumber(d.categories)} icon={FolderTree} sub="Active categories" />
            <StatCard label="Vendors" value={formatNumber(d.vendors)} icon={Building2} sub="Active vendors" />
            <StatCard label="Reviews to moderate" value={formatNumber(d.pendingReviews)} chip="red" icon={Star} href={has("reviews.view") ? "/admin/reviews" : undefined} />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Panel>
          <PanelHeader title="Needs attention" description={waiting ? `${waiting} ${waiting === 1 ? "item needs" : "items need"} action` : "You're all caught up"} actions={<Clock className="h-[18px] w-[18px] text-muted" aria-hidden />} />
          <div className="grid content-start gap-2.5 p-4 sm:grid-cols-2">
            {attention.map((a) => (
              <AttentionTile key={a.label} {...a} />
            ))}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Catalogue at a glance" description="What visitors can browse on the website right now" />
          <ul className="grid gap-2.5 p-4 sm:grid-cols-2">
            {catalogue.map((c) => {
              const inner = (
                <>
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", c.tint)}>
                    <c.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink/75">{c.label}</span>
                  <span className="text-[15px] font-bold tabular-nums text-ink">{formatNumber(c.value)}</span>
                </>
              );
              const cls = "flex h-full items-center gap-3 rounded-xl border border-line bg-bg/50 px-3 py-2.5";
              return (
                <li key={c.label}>
                  {c.href ? <Link href={c.href} title={`${c.label}: ${formatNumber(c.value)}`} className={cn(cls, "transition hover:border-primary/40 hover:bg-primary-soft/40")}>{inner}</Link> : <div title={`${c.label}: ${formatNumber(c.value)}`} className={cls}>{inner}</div>}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {canLeads && <LeadsChart trend={d.trend} />}
        <div className={cn(!canLeads && "xl:col-span-2")}>
          <ViewsChart trend={d.trend} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {canLeads && (
          <Panel>
            <PanelHeader title="Latest leads" actions={<Link href="/admin/leads" className="text-sm font-semibold text-ink hover:underline">View all</Link>} />
            <ul className="p-2">
              {d.recentLeads.length === 0 && (
                <li>
                  <EmptyState title="No leads yet">Quote and demo requests from the website appear here.</EmptyState>
                </li>
              )}
              {d.recentLeads.map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/leads/${l.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-bg">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-xs font-bold text-ink ring-1 ring-line" aria-hidden>
                      {l.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {l.name}
                        {l.company && <span className="font-normal text-muted"> · {l.company}</span>}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {l.software[0]?.software.name ?? "General enquiry"} · {formatDateTime(l.createdAt)}
                      </span>
                    </span>
                    <Badge tone={l.status === "NEW" ? "accent" : "neutral"}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <EnquiriesDonut items={d.topByEnquiries.map((t) => ({ id: t.id, name: t.name, enquiryCount: t.enquiryCount, viewCount: t.viewCount }))} />
        <Panel className={cn(!canLeads && "xl:col-span-2")}>
          <PanelHeader title="Recent activity" actions={has("audit.view") ? <Link href="/admin/audit-log" className="text-sm font-semibold text-ink hover:underline">View all</Link> : undefined} />
          <ul className="p-2">
            {d.recentActivity.length === 0 && (
              <li>
                <EmptyState title="Nothing yet">Changes made in the admin appear here.</EmptyState>
              </li>
            )}
            {d.recentActivity.slice(0, 7).map((a) => (
              <li key={a.id} className="flex items-start gap-3 rounded-xl px-3 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg text-muted ring-1 ring-line" aria-hidden>
                  <Activity className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    <span className="font-semibold">{a.actor?.name ?? "System"}</span> <span className="text-muted">{a.summary ?? a.action}</span>
                  </span>
                  <span className="text-xs text-muted">{formatDateTime(a.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
