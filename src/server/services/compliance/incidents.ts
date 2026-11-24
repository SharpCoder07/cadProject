import "server-only";
import { z } from "zod";
import type { IncidentSeverity, IncidentStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { getSettings } from "@/server/settings";
import { notify } from "@/server/notifications/notify";
import { referenceNo } from "@/server/services/leads";
import { assertCan, type Principal } from "@/server/rbac/policy";

export const SEVERITIES: IncidentSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
export const INCIDENT_STATUSES: IncidentStatus[] = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"];

const optDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.date().nullable());
export const incidentInput = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(5).max(10_000),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  status: z.enum(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"]),
  detectedAt: z.coerce.date(),
  occurredAt: optDate,
  containedAt: optDate,
  resolvedAt: optDate,
  personalDataAffected: z.boolean(),
  dataCategories: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  affectedCount: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().int().min(0).max(1_000_000_000).nullable()),
  reportable: z.enum(["undecided", "yes", "no"]),
  decisionNote: z.string().trim().max(5000).nullable().optional(),
  reportedToBoardAt: optDate,
  reportedToCertInAt: optDate,
  usersNotifiedAt: optDate,
  rootCause: z.string().trim().max(10_000).nullable().optional(),
  remediation: z.string().trim().max(10_000).nullable().optional(),
  assignedToId: z.string().cuid().nullable().optional(),
});
export type IncidentInput = z.infer<typeof incidentInput>;

export async function listIncidents(user: Principal, q: { status?: string; page?: number }) {
  assertCan(user, "compliance.incidents");
  const page = Math.max(1, q.page ?? 1);
  const where: Prisma.SecurityIncidentWhereInput =
    q.status === "ALL" ? {} : q.status && INCIDENT_STATUSES.includes(q.status as IncidentStatus) ? { status: q.status as IncidentStatus } : { status: { in: ["OPEN", "INVESTIGATING", "CONTAINED"] } };
  const [total, rows, open, undecided] = await Promise.all([
    db.securityIncident.count({ where }),
    db.securityIncident.findMany({ where, orderBy: { detectedAt: "desc" }, skip: (page - 1) * 30, take: 30, include: { assignedTo: { select: { name: true } } } }),
    db.securityIncident.count({ where: { status: { in: ["OPEN", "INVESTIGATING", "CONTAINED"] } } }),
    db.securityIncident.count({ where: { reportable: "undecided", personalDataAffected: true } }),
  ]);
  return { total, page, pages: Math.max(1, Math.ceil(total / 30)), rows, open, undecided };
}

export async function getIncident(user: Principal, id: string) {
  assertCan(user, "compliance.incidents");
  const i = await db.securityIncident.findUnique({ where: { id }, include: { reportedBy: { select: { name: true } }, assignedTo: { select: { id: true, name: true } }, events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } } } });
  if (!i) throw notFound("Incident");
  return i;
}

/** Records an incident. The decision target comes from Compliance settings (none when not set). */
export async function createIncident(user: Principal, data: IncidentInput) {
  assertCan(user, "compliance.incidents");
  const hours = (await getSettings()).compliance.incidentReportHours;
  const i = await db.securityIncident.create({
    data: {
      ...data,
      referenceNo: referenceNo("IN"),
      decisionDueAt: hours ? new Date(data.detectedAt.getTime() + hours * 3_600_000) : null,
      reportedById: user.id,
      events: { create: { type: "created", actorId: user.id, message: `Recorded (${data.severity.toLowerCase()} severity)` } },
    },
  });
  await audit({ actorId: user.id, action: "compliance.incident_created", entityType: "securityIncident", entityId: i.id, summary: `Incident ${i.referenceNo}: ${data.title} (${data.severity})` });
  notify({ superAdmins: true }, { type: "privacy.case", title: `Security incident recorded: ${data.title}`, body: `${i.referenceNo} · ${data.severity.toLowerCase()} severity`, href: `/admin/compliance/incidents/${i.id}`, except: user.id });
  return i.id;
}

const TRACKED: (keyof IncidentInput)[] = ["title", "severity", "status", "detectedAt", "occurredAt", "containedAt", "resolvedAt", "personalDataAffected", "dataCategories", "affectedCount", "reportable", "decisionNote", "reportedToBoardAt", "reportedToCertInAt", "usersNotifiedAt", "rootCause", "remediation", "assignedToId", "description"];
const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.join(", ") : v ?? null);

/** Saves changes; every changed field is written to the incident's history. */
export async function updateIncident(user: Principal, id: string, data: IncidentInput, note?: string | null) {
  assertCan(user, "compliance.incidents");
  const before = await db.securityIncident.findUnique({ where: { id } });
  if (!before) throw notFound("Incident");
  if ((data.status === "RESOLVED" || data.status === "CLOSED") && data.personalDataAffected && data.reportable === "undecided") {
    throw new AppError("Record whether this has to be reported before resolving it.", "BAD_REQUEST", { reportable: ["Decide first"] });
  }
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of TRACKED) {
    const a = norm((before as Record<string, unknown>)[k]);
    const b = norm(data[k]);
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[k] = { from: a, to: b };
  }
  if (!Object.keys(changes).length && !note) return;
  await db.$transaction(async (tx) => {
    await tx.securityIncident.update({ where: { id }, data: { ...data, ...(data.status === "RESOLVED" && !data.resolvedAt ? { resolvedAt: new Date() } : {}) } });
    if (Object.keys(changes).length) await tx.incidentEvent.create({ data: { incidentId: id, type: "update", actorId: user.id, changes: changes as Prisma.InputJsonValue, message: Object.keys(changes).join(", ") } });
    if (note) await tx.incidentEvent.create({ data: { incidentId: id, type: "note", actorId: user.id, message: note } });
    await audit({ actorId: user.id, action: "compliance.incident_updated", entityType: "securityIncident", entityId: id, summary: `Incident ${before.referenceNo}: ${Object.keys(changes).join(", ") || "note"}` }, tx);
  });
}
