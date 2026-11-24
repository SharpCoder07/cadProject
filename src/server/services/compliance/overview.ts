import "server-only";
import { db } from "@/server/db";
import { getStoredSettings } from "@/server/settings";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { securityChecks } from "./security";
import { versionInForce } from "@/lib/compliance/legal";
import { OPEN_STATUSES } from "@/lib/compliance/cases";

export interface AttentionItem { tone: "danger" | "warning"; text: string; href: string }

/** Compliance & Privacy › Overview: one look at what's in place and what needs attention. */
export async function complianceOverview(user: Principal) {
  assertCan(user, "compliance.view");
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const incidents = can(user, "compliance.incidents");
  const [settings, checks, caseCounts, overdueCounts, docs, consents, cookies30, rules, vendorsNoDpa, openIncidents, undecided] = await Promise.all([
    getStoredSettings(),
    securityChecks(user),
    db.privacyCase.groupBy({ by: ["kind"], where: { status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
    db.privacyCase.groupBy({ by: ["kind"], where: { status: { in: OPEN_STATUSES }, OR: [{ dueAt: { lt: now } }, { ackDueAt: { lt: now }, acknowledgedAt: null }] }, _count: { _all: true } }),
    db.legalDocument.findMany({ where: { isActive: true }, include: { versions: { where: { status: "PUBLISHED" }, select: { id: true, status: true, effectiveAt: true, version: true, legalReviewed: true } } } }),
    db.userConsent.count({ where: { status: "GRANTED", purpose: { isNecessary: false } } }),
    db.cookiePreference.groupBy({ by: ["action"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    db.retentionRule.findMany({ select: { isActive: true, retentionDays: true, legalReviewed: true } }),
    db.vendor.count({ where: { isActive: true, receivesLeads: true, OR: [{ compliance: null }, { compliance: { dpaSigned: false } }] } }),
    incidents ? db.securityIncident.count({ where: { status: { in: ["OPEN", "INVESTIGATING", "CONTAINED"] } } }) : Promise.resolve(0),
    incidents ? db.securityIncident.count({ where: { personalDataAffected: true, reportable: "undecided" } }) : Promise.resolve(0),
  ]);
  const c = settings.compliance;
  const open = Object.fromEntries(caseCounts.map((x) => [x.kind, x._count._all])) as Record<string, number>;
  const late = Object.fromEntries(overdueCounts.map((x) => [x.kind, x._count._all])) as Record<string, number>;
  const inForce = docs.map((d) => ({ key: d.key, title: d.title, id: d.id, requiresAcceptance: d.requiresAcceptance, v: versionInForce(d.versions) }));
  const cookieBy = Object.fromEntries(cookies30.map((x) => [x.action, x._count._all])) as Record<string, number>;
  const cookieTotal = Object.values(cookieBy).reduce((a, b) => a + b, 0);
  const timelinesSet = [c.grievanceAckDays, c.grievanceResolveDays, c.dataRequestDays, c.incidentReportHours, c.contentComplaintDays].filter(Boolean).length;

  const attention: AttentionItem[] = [];
  const lateTotal = Object.values(late).reduce((a, b) => a + b, 0);
  if (lateTotal) attention.push({ tone: "danger", text: `${lateTotal} request${lateTotal === 1 ? "" : "s"} or complaint${lateTotal === 1 ? "" : "s"} past the target date`, href: `/admin/compliance/${late.DATA_REQUEST ? "requests" : late.GRIEVANCE ? "grievances" : "content"}?status=OVERDUE` });
  if (undecided) attention.push({ tone: "danger", text: `${undecided} incident${undecided === 1 ? "" : "s"} affecting personal data without a reporting decision`, href: "/admin/compliance/incidents" });
  for (const key of ["privacy-policy", "terms"]) {
    const d = inForce.find((x) => x.key === key);
    if (d && !d.v) attention.push({ tone: "warning", text: `${d.title}: no version in force (the old Website page still shows)`, href: `/admin/compliance/legal/${d.id}` });
  }
  const unreviewedDocs = inForce.filter((d) => d.v && !d.v.legalReviewed).length;
  if (unreviewedDocs) attention.push({ tone: "warning", text: `${unreviewedDocs} legal document${unreviewedDocs === 1 ? "" : "s"} in force not marked as reviewed by a lawyer`, href: "/admin/compliance/legal" });
  if (!c.grievanceOfficerName || !(c.grievanceOfficerEmail || c.privacyEmail)) attention.push({ tone: "warning", text: "Grievance officer details are missing (shown on the Privacy center)", href: "/admin/compliance/settings" });
  if (timelinesSet === 0) attention.push({ tone: "warning", text: "No response timelines set: requests and complaints have no target dates", href: "/admin/compliance/settings" });
  if (!c.legalReviewDone) attention.push({ tone: "warning", text: "Compliance settings not marked as legally reviewed", href: "/admin/compliance/settings" });
  if (!rules.some((r) => r.isActive)) attention.push({ tone: "warning", text: "No data retention rule is switched on", href: "/admin/compliance/retention" });
  if (vendorsNoDpa) attention.push({ tone: "warning", text: `${vendorsNoDpa} active compan${vendorsNoDpa === 1 ? "y receives" : "ies receive"} leads without data processing terms recorded`, href: "/admin/compliance/vendors" });
  const checkIssues = checks.filter((x) => x.status === "attention");
  for (const x of checkIssues) attention.push({ tone: "warning", text: `Security: ${x.title}`, href: "/admin/compliance/security" });

  return {
    attention,
    cases: { open, late },
    legal: { total: inForce.length, inForce: inForce.filter((d) => d.v).length, unreviewed: unreviewedDocs },
    consents,
    cookies: { total: cookieTotal, accepted: cookieBy.accept_all ?? 0, rejected: cookieBy.reject_all ?? 0, custom: cookieBy.custom ?? 0 },
    retention: { active: rules.filter((r) => r.isActive).length, total: rules.length },
    security: { ok: checks.filter((x) => x.status === "ok").length, total: checks.length },
    incidents: incidents ? { open: openIncidents, undecided } : null,
    settings: { legalReviewDone: c.legalReviewDone, timelinesSet },
    vendorsNoDpa,
  };
}
