import Link from "next/link";
import { cookies } from "next/headers";
import { REJECTED_SEEN_COOKIE, rejectedSeenAt } from "./rejected-seen";
import { BadgeCheck, BarChart3, Boxes, Clock, Columns3, Eye, Globe, Inbox, MapPin, ShieldCheck, Star, Tag, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { db } from "@/server/db";
import { currentSubscription } from "@/server/services/billing";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { LEAD_STATUS_LABEL } from "@/lib/validation/leads";
import { cn } from "@/lib/utils";
import { Alert, Badge, EmptyState, Panel, PanelHeader } from "@/components/ui/misc";
import { AttentionTile, GlanceItem, StatCard, type Tone } from "@/components/admin/dashboard-cards";
import { EnquiriesDonut, LeadsChart, ViewsChart } from "@/components/admin/dashboard-charts";
import { ENTITY_NAME, actionLabel } from "@/components/admin/approval-badges";
import { requireVendor } from "./_lib";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function VendorHome({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireVendor("vendor.portal", "/vendor");
  const { denied } = await searchParams;
  const vendorId = user.vendorId;
  const canLeads = user.permissions.has("vendor.leads");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const newRejections = await rejectedSince(user.id, since);
  const kind = (await db.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { kind: true } })).kind;
  if (kind === "RESELLER") return <ResellerHome user={user} denied={Boolean(denied)} />;
  const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const today = istDay(new Date());
  const startOfToday = new Date(`${today}T00:00:00+05:30`);
  const since60 = new Date(Date.now() - 60 * 86_400_000);
  const since15 = new Date(Date.now() - 15 * 86_400_000);
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const startOfMonth = new Date(`${today.slice(0, 8)}01T00:00:00+05:30`);
  // The company's leads: exactly what its Leads list shows (spam never counts).
  const scope = { OR: [{ vendorId }, { resellers: { some: { resellerId: vendorId } } }], status: { not: "SPAM" as const } };
  const showLeads = canLeads;
  const [vendor, byStatus, pending, rejected, plan, leadStatus, leadsToday, leadsMonth, last15, prev15, leadDays, statDays, topProducts, recentLeads, recentRequests, reviews, offers] = await Promise.all([
    db.vendor.findUniqueOrThrow({ where: { id: vendorId }, select: { name: true, verification: true, receivesLeads: true } }),
    db.software.groupBy({ by: ["status"], where: { vendorId }, _count: { _all: true }, orderBy: { status: "asc" } }),
    db.approvalRequest.count({ where: { vendorId, status: "PENDING" } }),
    db.approvalRequest.count({ where: { vendorId, status: "REJECTED", decidedAt: newRejections } }),
    currentSubscription(vendorId),
    showLeads ? db.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true }, orderBy: { status: "asc" } }) : Promise.resolve([]),
    showLeads ? db.lead.count({ where: { ...scope, createdAt: { gte: startOfToday } } }) : Promise.resolve(0),
    showLeads ? db.lead.count({ where: { ...scope, createdAt: { gte: startOfMonth } } }) : Promise.resolve(0),
    showLeads ? db.lead.count({ where: { ...scope, createdAt: { gte: since15 } } }) : Promise.resolve(0),
    showLeads ? db.lead.count({ where: { ...scope, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000), lt: since15 } } }) : Promise.resolve(0),
    showLeads ? db.lead.findMany({ where: { ...scope, createdAt: { gte: since60 } }, select: { createdAt: true } }) : Promise.resolve([]),
    db.softwareDailyStat.findMany({ where: { software: { vendorId }, date: { gte: since60 } }, select: { date: true, views: true, enquiries: true } }),
    db.software.findMany({ where: { vendorId, enquiryCount: { gt: 0 } }, orderBy: { enquiryCount: "desc" }, take: 6, select: { id: true, name: true, enquiryCount: true, viewCount: true } }),
    showLeads ? db.lead.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, company: true, status: true, createdAt: true, software: { take: 1, select: { software: { select: { name: true } } } } } }) : Promise.resolve([]),
    db.approvalRequest.findMany({ where: { vendorId }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, action: true, entityType: true, entityLabel: true, status: true, createdAt: true, decidedAt: true } }),
    db.review.count({ where: { status: "APPROVED", software: { vendorId } } }),
    db.productOffer.count({ where: { status: "PUBLISHED", software: { vendorId }, startsAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } }),
  ]);
  const count = (s: string) => { const c = byStatus.find((b) => b.status === s)?._count; return typeof c === "object" && c ? c._all ?? 0 : 0; };
  const leadCount = (keys: string[]) => leadStatus.filter((l) => keys.includes(l.status)).reduce((n, l) => n + (typeof l._count === "object" && l._count ? l._count._all ?? 0 : 0), 0);
  const totalLeads = leadCount(["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL", "WON", "LOST"]);
  const newLeads = leadCount(["NEW"]);
  const openLeads = leadCount([...OPEN]);
  const won = leadCount(["WON"]);
  const lost = leadCount(["LOST"]);
  const conversion = won + lost ? `${((won / (won + lost)) * 100).toFixed(1)}%` : "—";
  const delta = prev15 ? Math.round(((last15 - prev15) / prev15) * 100) : last15 ? null : 0;
  // 60 days of leads and product views for the charts (the views chart compares with the period before).
  const leadMap = new Map<string, number>();
  for (const l of leadDays) leadMap.set(istDay(l.createdAt), (leadMap.get(istDay(l.createdAt)) ?? 0) + 1);
  const viewMap = new Map<string, number>();
  let views30 = 0, enquiries30 = 0;
  for (const st of statDays) {
    const d = st.date.toISOString().slice(0, 10);
    viewMap.set(d, (viewMap.get(d) ?? 0) + st.views);
    if (st.date >= since30) { views30 += st.views; enquiries30 += st.enquiries; }
  }
  const trend = Array.from({ length: 60 }, (_, i) => { const d = istDay(new Date(Date.now() - (59 - i) * 86_400_000)); return { day: d, leads: leadMap.get(d) ?? 0, views: viewMap.get(d) ?? 0 }; });
  const attention: { count: number; label: string; href: string; tone: Tone }[] = [
    { count: pending, label: "Requests waiting for approval", href: "/vendor/requests?status=PENDING", tone: "violet" },
    { count: rejected, label: "Requests rejected recently", href: "/vendor/requests?status=REJECTED", tone: "rose" },
    ...(showLeads ? [{ count: newLeads, label: "New leads to review", href: "/vendor/leads?status=NEW", tone: "blue" as Tone }] : []),
    ...(showLeads ? [{ count: openLeads, label: "Open leads", href: "/vendor/leads?status=OPEN", tone: "amber" as Tone }] : []),
    { count: count("DRAFT"), label: "Draft products", href: "/vendor/listings?status=DRAFT", tone: "slate" },
    { count: count("IN_REVIEW"), label: "Products in review", href: "/vendor/listings?status=IN_REVIEW", tone: "slate" },
  ];
  const waiting = attention.filter((a) => a.count > 0).length;
  const glance = [
    { label: "Live products", value: count("PUBLISHED"), icon: Globe, tint: "bg-[#F0FAF7] text-[#047857] dark:bg-emerald-500/10 dark:text-emerald-300", href: "/vendor/listings?status=PUBLISHED" },
    { label: "Product views (30 days)", value: views30, icon: Eye, tint: "bg-mint-soft text-mint-ink" },
    { label: "Product enquiries (30 days)", value: enquiries30, icon: Inbox, tint: "bg-[#FFF8EB] text-[#B45309] dark:bg-amber-500/10 dark:text-amber-300" },
    { label: "Published reviews", value: reviews, icon: Star, tint: "bg-[#FFF6F6] text-primary dark:bg-rose-500/10", href: user.permissions.has("vendor.reviews") ? "/vendor/reviews" : undefined },
    { label: "Live offers", value: offers, icon: Tag, tint: "bg-success/10 text-success", href: user.permissions.has("vendor.offers") ? "/vendor/offers" : undefined },
    { label: "Archived products", value: count("ARCHIVED"), icon: Boxes, tint: "bg-bg text-ink/70 ring-1 ring-line", href: "/vendor/listings?status=ARCHIVED" },
  ];
  const REQ_STATUS: Record<string, { label: string; tone: "accent" | "success" | "danger" | "neutral" }> = { PENDING: { label: "Pending", tone: "accent" }, APPROVED: { label: "Approved", tone: "success" }, REJECTED: { label: "Rejected", tone: "danger" }, WITHDRAWN: { label: "Withdrawn", tone: "neutral" } };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[1.375rem] font-bold leading-tight tracking-[-0.015em] sm:text-2xl">Welcome back, <span className="text-[#0F766E] dark:text-teal-300">{user.name}</span></h1>
        <p className="mt-1 text-sm text-muted">{vendor.name} · your products and leads at a glance.</p>
      </div>
      {denied && <Alert tone="warning" className="mb-4" title="You don't have access to that page">Ask the Super Admin if your role should include it.</Alert>}
      {vendor.verification !== "VERIFIED" && <Alert tone="info" className="mb-4" title="Your company isn't verified yet">Verified vendors get a badge on every product. Keep your <Link href="/vendor/profile" className="underline">company profile</Link> complete and our team will review it.</Alert>}
      {canLeads && vendor.receivesLeads && !plan && (
        <Alert tone="info" className="mb-4" title="Buyer contact details are hidden">
          You can see every lead, but emails and phone numbers stay masked until you <Link href="/vendor/plans" className="font-medium underline">buy a plan</Link>.
        </Alert>
      )}
      {plan && plan.periodEnd && plan.periodEnd.getTime() - Date.now() < 14 * 86_400_000 && (
        <Alert tone="warning" className="mb-4" title={`Your ${plan.planName} plan ends on ${formatDate(plan.periodEnd)}`}>
          <Link href="/vendor/plans" className="font-medium underline">Renew now</Link> to keep seeing buyer contact details.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {showLeads ? (
          <>
            <StatCard
              label="Total leads"
              value={formatNumber(totalLeads)}
              icon={Inbox}
              href="/vendor/leads"
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
              sub={`${formatNumber(leadsMonth)} this month · trend vs previous 15 days`}
            />
            <StatCard label="New today" value={formatNumber(leadsToday)} valueClass="text-primary" chip="red" icon={Star} href="/vendor/leads?status=NEW" sub={`${formatNumber(newLeads)} waiting to be reviewed`} />
            <StatCard label="Open leads" value={formatNumber(openLeads)} icon={Columns3} href="/vendor/leads?status=OPEN" sub="Not yet won or lost" />
            <StatCard label="Conversion rate" value={conversion} valueClass="text-success" chip="green" icon={BarChart3} href="/vendor/leads/reports" sub={`${won} won · ${lost} lost`} />
          </>
        ) : (
          <>
            <StatCard label="Live products" value={formatNumber(count("PUBLISHED"))} icon={Globe} chip="green" href="/vendor/listings" sub="Visible to buyers" />
            <StatCard label="Waiting for approval" value={formatNumber(pending)} icon={Clock} href="/vendor/requests?status=PENDING" sub={pending ? "Being reviewed" : "Nothing waiting"} />
            <StatCard label="Product views" value={formatNumber(views30)} icon={Eye} sub="Last 30 days" />
            <StatCard label="Product enquiries" value={formatNumber(enquiries30)} icon={Inbox} chip="red" sub="Last 30 days" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Panel>
          <PanelHeader title="Needs attention" description={waiting ? `${waiting} ${waiting === 1 ? "item needs" : "items need"} action` : "You're all caught up"} actions={<Clock className="h-[18px] w-[18px] text-muted" aria-hidden />} />
          <div className="grid content-start gap-2.5 p-4 sm:grid-cols-2">
            {attention.map((a) => <AttentionTile key={a.label} {...a} />)}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Your products at a glance" description="What buyers can see and how they respond" />
          <ul className="grid gap-2.5 p-4 sm:grid-cols-2">
            {glance.map((g) => <li key={g.label}><GlanceItem {...g} /></li>)}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {showLeads && <LeadsChart trend={trend} />}
        <div className={cn(!showLeads && "xl:col-span-2")}>
          <ViewsChart trend={trend} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {showLeads && (
          <Panel>
            <PanelHeader title="Latest leads" actions={<Link href="/vendor/leads" className="text-sm font-semibold text-ink hover:underline">View all</Link>} />
            <ul className="p-2">
              {recentLeads.length === 0 && <li><EmptyState title="No leads yet">Quote and demo requests for your products appear here.</EmptyState></li>}
              {recentLeads.map((l) => (
                <li key={l.id}>
                  <Link href={`/vendor/leads/${l.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-bg">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-xs font-bold text-ink ring-1 ring-line" aria-hidden>{l.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.name}{l.company && <span className="font-normal text-muted"> · {l.company}</span>}</span>
                      <span className="block truncate text-xs text-muted">{l.software[0]?.software.name ?? "General enquiry"} · {formatDateTime(l.createdAt)}</span>
                    </span>
                    <Badge tone={l.status === "NEW" ? "accent" : "neutral"}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <EnquiriesDonut items={topProducts} />
        <Panel className={cn(!showLeads && "xl:col-span-2")}>
          <PanelHeader title="Recent requests" actions={<Link href="/vendor/requests" className="text-sm font-semibold text-ink hover:underline">View all</Link>} />
          <ul className="p-2">
            {recentRequests.length === 0 && <li><EmptyState title="No requests yet">Changes you send to the Super Admin appear here.</EmptyState></li>}
            {recentRequests.map((r) => (
              <li key={r.id}>
                <Link href={`/vendor/requests?status=${r.status}`} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-bg">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg text-muted ring-1 ring-line" aria-hidden><ShieldCheck className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.entityLabel}</span>
                    <span className="block truncate text-xs text-muted">{actionLabel(r.action)} · {ENTITY_NAME[r.entityType]} · {formatDateTime(r.decidedAt ?? r.createdAt)}</span>
                  </span>
                  <Badge tone={REQ_STATUS[r.status]?.tone ?? "neutral"}>{REQ_STATUS[r.status]?.label ?? r.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="mt-6 text-sm text-muted">Every new product, edit, unpublish, deletion, profile change and review reply is reviewed by the Super Admin before it appears on the website, usually within one business day.</p>
    </>
  );
}

/** Rejections from the last 30 days that came in after the user last opened their rejected requests. */
async function rejectedSince(userId: string, since: Date) {
  const seen = rejectedSeenAt((await cookies()).get(REJECTED_SEEN_COOKIE)?.value, userId);
  return seen && seen > since ? { gt: seen } : { gte: since };
}

const OPEN = ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL"] as const;

/** Reseller overview: authorised products and the leads the team forwarded. */
async function ResellerHome({ user, denied }: { user: Awaited<ReturnType<typeof requireVendor>>; denied: boolean }) {
  const resellerId = user.vendorId;
  const canLeads = user.permissions.has("vendor.leads");
  const since = new Date(Date.now() - 30 * 86_400_000);
  const newRejections = await rejectedSince(user.id, since);
  const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  const today = istDay(new Date());
  const startOfToday = new Date(`${today}T00:00:00+05:30`);
  const startOfMonth = new Date(`${today.slice(0, 8)}01T00:00:00+05:30`);
  const since15 = new Date(Date.now() - 15 * 86_400_000);
  const since60 = new Date(Date.now() - 60 * 86_400_000);
  // Leads shared with this reseller, as in their Leads list (spam never counts).
  const scope = { resellers: { some: { resellerId } }, status: { not: "SPAM" as const } };
  const [r, authorised, pending, rejected, plan, leadStatus, leadsToday, leadsMonth, last15, prev15, leadDays, recent, recentRequests] = await Promise.all([
    db.vendor.findUniqueOrThrow({ where: { id: resellerId }, select: { name: true, verification: true, receivesLeads: true, serviceCities: true } }),
    db.resellerProduct.count({ where: { resellerId } }),
    db.approvalRequest.count({ where: { vendorId: resellerId, status: "PENDING" } }),
    db.approvalRequest.count({ where: { vendorId: resellerId, status: "REJECTED", decidedAt: newRejections } }),
    currentSubscription(resellerId),
    canLeads ? db.lead.groupBy({ by: ["status"], where: scope, _count: { _all: true }, orderBy: { status: "asc" } }) : Promise.resolve([]),
    canLeads ? db.lead.count({ where: { ...scope, createdAt: { gte: startOfToday } } }) : Promise.resolve(0),
    canLeads ? db.lead.count({ where: { ...scope, createdAt: { gte: startOfMonth } } }) : Promise.resolve(0),
    canLeads ? db.lead.count({ where: { ...scope, createdAt: { gte: since15 } } }) : Promise.resolve(0),
    canLeads ? db.lead.count({ where: { ...scope, createdAt: { gte: since, lt: since15 } } }) : Promise.resolve(0),
    canLeads ? db.lead.findMany({ where: { ...scope, createdAt: { gte: since60 } }, select: { createdAt: true } }) : Promise.resolve([]),
    canLeads ? db.lead.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, company: true, status: true, createdAt: true, software: { take: 1, select: { software: { select: { name: true } } } } } }) : Promise.resolve([]),
    db.approvalRequest.findMany({ where: { vendorId: resellerId }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, action: true, entityType: true, entityLabel: true, status: true, createdAt: true, decidedAt: true } }),
  ]);
  const leadCount = (keys: string[]) => leadStatus.filter((l) => keys.includes(l.status)).reduce((n, l) => n + (typeof l._count === "object" && l._count ? l._count._all ?? 0 : 0), 0);
  const totalLeads = leadCount(["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL", "WON", "LOST"]);
  const newLeads = leadCount(["NEW"]);
  const openLeads = leadCount([...OPEN]);
  const won = leadCount(["WON"]);
  const lost = leadCount(["LOST"]);
  const conversion = won + lost ? `${((won / (won + lost)) * 100).toFixed(1)}%` : "—";
  const delta = prev15 ? Math.round(((last15 - prev15) / prev15) * 100) : last15 ? null : 0;
  const leadMap = new Map<string, number>();
  for (const l of leadDays) leadMap.set(istDay(l.createdAt), (leadMap.get(istDay(l.createdAt)) ?? 0) + 1);
  const trend = Array.from({ length: 60 }, (_, i) => { const d = istDay(new Date(Date.now() - (59 - i) * 86_400_000)); return { day: d, leads: leadMap.get(d) ?? 0, views: 0 }; });
  const attention: { count: number; label: string; href: string; tone: Tone }[] = [
    { count: pending, label: "Requests waiting for approval", href: "/reseller/requests?status=PENDING", tone: "violet" },
    { count: rejected, label: "Requests rejected recently", href: "/reseller/requests?status=REJECTED", tone: "rose" },
    ...(canLeads ? [{ count: newLeads, label: "New leads to review", href: "/reseller/leads?status=NEW", tone: "blue" as Tone }, { count: openLeads, label: "Open leads", href: "/reseller/leads?status=OPEN", tone: "amber" as Tone }] : []),
  ];
  const waiting = attention.filter((a) => a.count > 0).length;
  const glance = [
    { label: "Authorised products", value: authorised, icon: BadgeCheck, tint: "bg-[#F0FAF7] text-[#047857] dark:bg-emerald-500/10 dark:text-emerald-300", href: "/reseller/authorised" },
    { label: "Cities you serve", value: r.serviceCities.length, icon: MapPin, tint: "bg-mint-soft text-mint-ink", href: "/reseller/profile" },
    { label: "Leads this month", value: leadsMonth, icon: Inbox, tint: "bg-[#FFF8EB] text-[#B45309] dark:bg-amber-500/10 dark:text-amber-300", href: canLeads ? "/reseller/leads" : undefined },
    { label: "Leads won", value: won, icon: Trophy, tint: "bg-success/10 text-success", href: canLeads ? "/reseller/leads?status=WON" : undefined },
  ];
  const REQ_STATUS: Record<string, { label: string; tone: "accent" | "success" | "danger" | "neutral" }> = { PENDING: { label: "Pending", tone: "accent" }, APPROVED: { label: "Approved", tone: "success" }, REJECTED: { label: "Rejected", tone: "danger" }, WITHDRAWN: { label: "Withdrawn", tone: "neutral" } };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-[1.375rem] font-bold leading-tight tracking-[-0.015em] sm:text-2xl">Welcome back, <span className="text-[#0F766E] dark:text-teal-300">{user.name}</span></h1>
        <p className="mt-1 text-sm text-muted">{r.name} · your authorised products and leads at a glance.</p>
      </div>
      {denied && <Alert tone="warning" className="mb-4" title="You don't have access to that page">Ask the Super Admin if your role should include it.</Alert>}
      {r.verification !== "VERIFIED" && <Alert tone="info" className="mb-4" title="Your company isn't verified yet">Verified resellers get a badge on every product page. Keep your <Link href="/reseller/profile" className="underline">company profile</Link> complete and our team will review it.</Alert>}
      {authorised === 0 && <Alert tone="info" className="mb-4" title="Choose the products you sell">Go to <Link href="/reseller/browse" className="font-medium underline">Browse products</Link> and click “Become a reseller”. Once approved, you&apos;re listed as an authorised reseller on that product page.</Alert>}
      {r.serviceCities.length === 0 && <Alert tone="info" className="mb-4" title="Add the cities you serve">Set them in your <Link href="/reseller/profile" className="font-medium underline">company profile</Link> so buyers and our team know where you work.</Alert>}
      {canLeads && r.receivesLeads && !plan && (
        <Alert tone="info" className="mb-4" title="Buyer contact details are hidden">
          You can see every lead we forward, but emails and phone numbers stay masked until you <Link href="/reseller/plans" className="font-medium underline">buy a plan</Link>.
        </Alert>
      )}
      {plan && plan.periodEnd && plan.periodEnd.getTime() - Date.now() < 14 * 86_400_000 && (
        <Alert tone="warning" className="mb-4" title={`Your ${plan.planName} plan ends on ${formatDate(plan.periodEnd)}`}>
          <Link href="/reseller/plans" className="font-medium underline">Renew now</Link> to keep seeing buyer contact details.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {canLeads ? (
          <>
            <StatCard
              label="Total leads"
              value={formatNumber(totalLeads)}
              icon={Inbox}
              href="/reseller/leads"
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
              sub={`${formatNumber(leadsMonth)} this month · trend vs previous 15 days`}
            />
            <StatCard label="New today" value={formatNumber(leadsToday)} valueClass="text-primary" chip="red" icon={Star} href="/reseller/leads?status=NEW" sub={`${formatNumber(newLeads)} waiting to be reviewed`} />
            <StatCard label="Open leads" value={formatNumber(openLeads)} icon={Columns3} href="/reseller/leads?status=OPEN" sub="Not yet won or lost" />
            <StatCard label="Conversion rate" value={conversion} valueClass="text-success" chip="green" icon={BarChart3} href="/reseller/leads/reports" sub={`${won} won · ${lost} lost`} />
          </>
        ) : (
          <>
            <StatCard label="Authorised products" value={formatNumber(authorised)} icon={BadgeCheck} chip="green" href="/reseller/authorised" sub="You're listed on these" />
            <StatCard label="Waiting for approval" value={formatNumber(pending)} icon={Clock} href="/reseller/requests?status=PENDING" sub={pending ? "Being reviewed" : "Nothing waiting"} />
            <StatCard label="Cities you serve" value={formatNumber(r.serviceCities.length)} icon={MapPin} href="/reseller/profile" sub="From your company profile" />
            <StatCard label="Requests rejected" value={formatNumber(rejected)} icon={ShieldCheck} chip="red" href="/reseller/requests?status=REJECTED" sub="Recently" />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Panel>
          <PanelHeader title="Needs attention" description={waiting ? `${waiting} ${waiting === 1 ? "item needs" : "items need"} action` : "You're all caught up"} actions={<Clock className="h-[18px] w-[18px] text-muted" aria-hidden />} />
          <div className="grid content-start gap-2.5 p-4 sm:grid-cols-2">
            {attention.map((a) => <AttentionTile key={a.label} {...a} />)}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="At a glance" description={r.serviceCities.length ? `You serve ${r.serviceCities.slice(0, 3).join(", ")}${r.serviceCities.length > 3 ? ` and ${r.serviceCities.length - 3} more` : ""}` : "Your reseller profile"} />
          <ul className="grid gap-2.5 p-4 sm:grid-cols-2">
            {glance.map((g) => <li key={g.label}><GlanceItem {...g} /></li>)}
          </ul>
        </Panel>
      </div>

      {canLeads && <div className="mt-4"><LeadsChart trend={trend} /></div>}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {canLeads && (
          <Panel>
            <PanelHeader title="Latest leads" actions={<Link href="/reseller/leads" className="text-sm font-semibold text-ink hover:underline">View all</Link>} />
            <ul className="p-2">
              {recent.length === 0 && <li><EmptyState title="No leads yet">When a buyer enquires about a product you resell, it appears here and you get an email.</EmptyState></li>}
              {recent.map((l) => (
                <li key={l.id}>
                  <Link href={`/reseller/leads/${l.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-bg">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-xs font-bold text-ink ring-1 ring-line" aria-hidden>{l.name.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{l.name}{l.company && <span className="font-normal text-muted"> · {l.company}</span>}</span>
                      <span className="block truncate text-xs text-muted">{l.software[0]?.software.name ?? "General enquiry"} · {formatDateTime(l.createdAt)}</span>
                    </span>
                    <Badge tone={l.status === "NEW" ? "accent" : "neutral"}>{LEAD_STATUS_LABEL[l.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
        <Panel className={cn(!canLeads && "xl:col-span-2")}>
          <PanelHeader title="Recent requests" actions={<Link href="/reseller/requests" className="text-sm font-semibold text-ink hover:underline">View all</Link>} />
          <ul className="p-2">
            {recentRequests.length === 0 && <li><EmptyState title="No requests yet">Products you ask to resell and profile changes appear here.</EmptyState></li>}
            {recentRequests.map((q) => (
              <li key={q.id}>
                <Link href={`/reseller/requests?status=${q.status}`} className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-bg">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-bg text-muted ring-1 ring-line" aria-hidden><ShieldCheck className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{q.entityLabel}</span>
                    <span className="block truncate text-xs text-muted">{actionLabel(q.action)} · {ENTITY_NAME[q.entityType]} · {formatDateTime(q.decidedAt ?? q.createdAt)}</span>
                  </span>
                  <Badge tone={REQ_STATUS[q.status]?.tone ?? "neutral"}>{REQ_STATUS[q.status]?.label ?? q.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      <p className="mt-6 text-sm text-muted">Product requests, profile changes and team changes are reviewed by the Super Admin before they take effect, usually within one business day.</p>
    </>
  );
}
