import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { allAreaPrefixes, auditArea, auditAreaPrefixes } from "@/lib/audit-labels";

export async function dashboardData(user: Principal) {
  assertCan(user, "dashboard.view");
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const since60 = new Date(Date.now() - 60 * 86_400_000);
  const canLeads = user.permissions.has("leads.view");
  const since15 = new Date(Date.now() - 15 * 86_400_000);
  // Calendar boundaries are taken in India time (UTC+05:30).
  const IST = 330 * 60_000;
  const nowIst = new Date(Date.now() + IST);
  const todayStart = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - IST);
  const monthStart = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), 1) - IST);

  const [
    softwareByStatus, categories, vendors, users, leads30, leadsPrev30, openLeads, pendingReviews, followUpsDue,
    leadsPerDay, viewsPerDay, topByEnquiries, recentActivity, recentLeads, newLeads, unassignedLeads, draftPages, draftPosts,
    leadsByStatus, leads15, leadsPrev15, leadsMonth, leadsToday,
  ] = await Promise.all([
    db.software.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    db.category.count({ where: { isActive: true } }),
    db.vendor.count({ where: { isActive: true, kind: "VENDOR" } }),
    db.user.count({ where: { status: "ACTIVE" } }),
    db.lead.count({ where: { createdAt: { gte: since30 }, status: { not: "SPAM" } } }),
    db.lead.count({ where: { createdAt: { gte: since60, lt: since30 }, status: { not: "SPAM" } } }),
    db.lead.count({ where: { status: { in: ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL"] } } }),
    db.review.count({ where: { status: "PENDING" } }),
    db.lead.count({ where: { nextFollowUpAt: { lte: new Date() }, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL"] } } }),
    db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, count(*)::bigint AS count
      FROM "Lead" WHERE "createdAt" >= ${since30} AND "status" <> 'SPAM' GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ day: Date; views: bigint }[]>`
      SELECT "date" AS day, sum("views")::bigint AS views FROM "SoftwareDailyStat" WHERE "date" >= ${since30} GROUP BY 1 ORDER BY 1`,
    db.software.findMany({ where: { status: "PUBLISHED" }, orderBy: { enquiryCount: "desc" }, take: 6, select: { id: true, name: true, slug: true, enquiryCount: true, viewCount: true, logo: { select: { url: true } }, primaryCategory: { select: { name: true } } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { actor: { select: { name: true } } } }),
    canLeads
      ? db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, referenceNo: true, name: true, company: true, status: true, createdAt: true, software: { take: 1, select: { software: { select: { name: true } } } } } })
      : Promise.resolve([]),
    db.lead.count({ where: { status: "NEW" } }),
    db.lead.count({ where: { assignedToId: null, status: { in: ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL"] } } }),
    db.page.count({ where: { status: "DRAFT" } }),
    db.post.count({ where: { status: "DRAFT" } }),
    db.lead.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    db.lead.count({ where: { createdAt: { gte: since15 }, status: { not: "SPAM" } } }),
    db.lead.count({ where: { createdAt: { gte: since30, lt: since15 }, status: { not: "SPAM" } } }),
    db.lead.count({ where: { createdAt: { gte: monthStart }, status: { not: "SPAM" } } }),
    db.lead.count({ where: { createdAt: { gte: todayStart }, status: { not: "SPAM" } } }),
  ]);
  const leadStatus = (st: string) => {
    const c = leadsByStatus.find((r) => r.status === st)?._count;
    return typeof c === "object" && c ? Number(c._all ?? 0) : 0;
  };
  const leadTotal = leadsByStatus.reduce((n, r) => (r.status === "SPAM" ? n : n + (typeof r._count === "object" && r._count ? Number(r._count._all ?? 0) : 0)), 0);

  const statusCount = (s: string) => {
    const row = softwareByStatus.find((r) => r.status === s);
    const c = row?._count;
    return typeof c === "object" && c ? Number(c._all ?? 0) : 0;
  };

  // Fill missing days so charts have a continuous axis.
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) days.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  const leadMap = new Map(leadsPerDay.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
  const viewMap = new Map(viewsPerDay.map((r) => [new Date(r.day).toISOString().slice(0, 10), Number(r.views)]));

  return {
    software: { published: statusCount("PUBLISHED"), draft: statusCount("DRAFT"), inReview: statusCount("IN_REVIEW"), archived: statusCount("ARCHIVED") },
    categories, vendors, users,
    leads: {
      last30: leads30, prev30: leadsPrev30, open: openLeads, followUpsDue, new: newLeads, unassigned: unassignedLeads,
      total: leadTotal, last15: leads15, prev15: leadsPrev15, thisMonth: leadsMonth, today: leadsToday,
      qualified: leadStatus("QUALIFIED"), won: leadStatus("WON"), lost: leadStatus("LOST"),
    },
    drafts: { pages: draftPages, posts: draftPosts },
    pendingReviews,
    trend: days.map((d) => ({ day: d, leads: leadMap.get(d) ?? 0, views: viewMap.get(d) ?? 0 })),
    topByEnquiries,
    recentActivity,
    recentLeads,
  };
}

export type AuditPeriod = "today" | "week" | "30d" | "deletions";

/** India-time midnight `days` days ago (0 = today). */
function istMidnight(daysAgo: number) {
  const ist = new Date(Date.now() + 330 * 60_000);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - daysAgo) - 330 * 60_000);
}

export async function listAuditLog(user: Principal, opts: { q?: string; area?: string; actorId?: string; action?: string; from?: string; to?: string; period?: AuditPeriod; page?: number }) {
  assertCan(user, "audit.view");
  const page = opts.page ?? 1;
  const and: Prisma.AuditLogWhereInput[] = [];
  if (opts.area) {
    const prefixes = auditAreaPrefixes(opts.area);
    if (prefixes.length) and.push({ OR: prefixes.map((p) => ({ action: { startsWith: p } })) });
    else and.push({ NOT: { OR: allAreaPrefixes().map((p) => ({ action: { startsWith: p } })) } });
  }
  if (opts.actorId) and.push(opts.actorId === "system" ? { actorId: null } : { actorId: opts.actorId });
  if (opts.action) and.push({ action: opts.action });
  if (opts.q) {
    and.push({
      OR: [
        { action: { contains: opts.q, mode: "insensitive" } },
        { summary: { contains: opts.q, mode: "insensitive" } },
        { actor: { email: { contains: opts.q, mode: "insensitive" } } },
        { actor: { name: { contains: opts.q, mode: "insensitive" } } },
      ],
    });
  }
  // From and To are whole days in India time, both included.
  const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00+05:30`) : null);
  const from = day(opts.from);
  const to = day(opts.to);
  if (from) and.push({ createdAt: { gte: from } });
  if (to) and.push({ createdAt: { lt: new Date(to.getTime() + 86_400_000) } });
  if (opts.period === "today") and.push({ createdAt: { gte: istMidnight(0) } });
  if (opts.period === "week") and.push({ createdAt: { gte: istMidnight(6) } });
  if (opts.period === "30d") and.push({ createdAt: { gte: istMidnight(29) } });
  if (opts.period === "deletions") and.push({ OR: [{ action: { contains: "delete" } }, { action: "bin.empty" }] });
  const where: Prisma.AuditLogWhereInput = and.length ? { AND: and } : {};
  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { actor: { select: { name: true, email: true } } } }),
    db.auditLog.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 50)) };
}

/** Choices for the audit log's filter drop-downs: people, actions and record types that appear in it. */
export async function auditFilterOptions(user: Principal) {
  assertCan(user, "audit.view");
  const [actions, actorIds] = await Promise.all([
    db.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
    db.auditLog.groupBy({ by: ["actorId"], where: { actorId: { not: null } } }),
  ]);
  const people = await db.user.findMany({ where: { id: { in: actorIds.map((a) => a.actorId!).slice(0, 500) } }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  const areas = new Map<string, number>();
  for (const a of actions) areas.set(auditArea(a.action), (areas.get(auditArea(a.action)) ?? 0) + a._count._all);
  return {
    actions: actions.map((a) => a.action),
    areas: [...areas.entries()].sort((a, b) => b[1] - a[1]).map(([area, count]) => ({ area, count })),
    people,
  };
}
