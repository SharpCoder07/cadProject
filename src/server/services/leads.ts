import "server-only";
import { randomBytes } from "node:crypto";
import type { LeadStatus, Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, forbidden, notFound } from "@/server/errors";
import { hashIp } from "@/server/request";
import { notifyLeadAssigned, notifyLeadCreated } from "@/server/notifications/leads";
import { notify, type Recipients } from "@/server/notifications/notify";
import { getSettings } from "@/server/settings";
import { assertNoBlockedWords } from "@/server/moderation";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { LEAD_TYPE_LABEL, leadListQuery, type LeadSubmission, type LeadListQuery, type LeadTypeKey, defaultLeadType } from "@/lib/validation/leads";
import { maskContactsInText, maskEmail, maskPhone } from "@/lib/mask";
import { hasLeadContactAccess } from "@/server/services/billing";
import { recordFormConsents } from "@/server/services/compliance/consent";

const OPEN_STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL"];
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function referenceNo(prefix = "CG"): string {
  const bytes = randomBytes(6);
  return `${prefix}-${[...bytes].map((b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("")}`;
}

/** Spam heuristics that run after schema validation. Returns a reason when the submission should be dropped. */
export function spamReason(input: LeadSubmission, now = Date.now(), rules: { spamMinSeconds: number; spamMaxLinks: number } = { spamMinSeconds: 2.5, spamMaxLinks: 2 }): string | null {
  if (input.website) return "honeypot";
  if (input.startedAt && now - input.startedAt < rules.spamMinSeconds * 1000) return "too-fast";
  const links = `${input.message ?? ""} ${input.requirement ?? ""}`.match(/https?:\/\//g)?.length ?? 0;
  if (links > rules.spamMaxLinks) return "links";
  return null;
}

/** Picks the next sales user in round-robin order (least recently assigned). */
async function nextAssignee(roleKey: string): Promise<string | null> {
  const users = await db.user.findMany({ where: { status: "ACTIVE", role: { key: roleKey } }, select: { id: true } });
  if (!users.length) return null;
  const last = await db.lead.groupBy({
    by: ["assignedToId"],
    where: { assignedToId: { in: users.map((u) => u.id) } },
    _max: { createdAt: true },
    orderBy: { assignedToId: "asc" },
  });
  const lastAt = new Map(last.map((l) => [l.assignedToId, l._max?.createdAt?.getTime() ?? 0]));
  return [...users].sort((a, b) => (lastAt.get(a.id) ?? 0) - (lastAt.get(b.id) ?? 0))[0]?.id ?? null;
}

export async function createLead(input: LeadSubmission, meta: { ip: string | null; userAgent: string | null }, opts: { formChecked?: boolean } = {}) {
  const settings = await getSettings();
  await assertNoBlockedWords({ name: input.name, company: input.company, city: input.city, requirement: input.requirement, message: input.message });
  // Forms set up in Admin › Pages › Forms have already checked their own required fields.
  if (!opts.formChecked && settings.leads.requireCompany && !input.company) {
    throw new AppError("Check the highlighted fields.", "BAD_REQUEST", { company: ["Company is required"] });
  }
  const software = input.softwareSlugs.length
    ? await db.software.findMany({ where: { slug: { in: input.softwareSlugs }, status: "PUBLISHED" }, select: { id: true, vendorId: true, name: true } })
    : [];
  const vendorIds = [...new Set(software.map((s) => s.vendorId).filter(Boolean))];
  // Every active reseller of an enquired product gets the lead in their portal (masked until they have a plan).
  const resellers = software.length
    ? await db.resellerProduct.findMany({
        where: { softwareId: { in: software.map((s) => s.id) }, reseller: { kind: "RESELLER", isActive: true, receivesLeads: true } },
        distinct: ["resellerId"],
        select: { resellerId: true },
      })
    : [];
  const assignedToId = settings.leads.autoAssign === "round_robin" ? await nextAssignee(settings.leads.autoAssignRoleKey) : null;
  const today = new Date(new Date().toISOString().slice(0, 10));

  const lead = await db.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        referenceNo: referenceNo(settings.rules.leadReferencePrefix),
        name: input.name,
        email: input.email,
        phone: input.phone,
        company: input.company,
        companySize: input.companySize,
        city: input.city,
        requirement: input.requirement,
        message: input.message,
        source: input.source,
        type: input.type ?? defaultLeadType(input.source),
        sourceUrl: input.sourceUrl?.slice(0, 500),
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        consent: input.consent,
        ipHash: hashIp(meta.ip),
        userAgent: meta.userAgent,
        // A lead about one vendor's products is visible to that vendor in the portal.
        vendorId: vendorIds.length === 1 ? (vendorIds[0] as string) : null,
        assignedToId,
        software: { create: software.map((s) => ({ softwareId: s.id })) },
        resellers: { create: resellers.map((r) => ({ resellerId: r.resellerId })) },
        activities: {
          create: [
            { type: "CREATED", toValue: input.source },
            ...(assignedToId ? [{ type: "ASSIGNED" as const, toValue: assignedToId }] : []),
          ],
        },
      },
    });
    for (const s of software) {
      await tx.software.update({ where: { id: s.id }, data: { enquiryCount: { increment: 1 }, popularityScore: { increment: settings.rules.enquiryPopularityPoints } } });
      await tx.softwareDailyStat.upsert({
        where: { softwareId_date: { softwareId: s.id, date: today } },
        create: { softwareId: s.id, date: today, enquiries: 1 },
        update: { enquiries: { increment: 1 } },
      });
    }
    return created;
  });

  // Consent record for sharing the enquiry with the matching vendors (Compliance & Privacy › Consent).
  // Kept outside the transaction so an enquiry is never lost over its consent record.
  if (input.consent) await recordFormConsents("enquiry", { userId: null, email: input.email, ipHash: lead.ipHash }, []).catch((e) => console.error("[consent] enquiry consent not recorded", e));
  await notifyLeadCreated(lead.id);
  pushLeadCreated(lead, software.map((s) => s.name), [...vendorIds, ...resellers.map((r) => r.resellerId)] as string[]);
  return { id: lead.id, referenceNo: lead.referenceNo };
}

/** Bell + browser push for a new lead: staff who see leads, the assignee, and the vendor/reseller companies. */
function pushLeadCreated(
  lead: { id: string; referenceNo: string; type: LeadTypeKey; name: string; company: string | null; city: string | null; assignedToId: string | null },
  products: string[],
  companies: string[],
) {
  const kind = LEAD_TYPE_LABEL[lead.type] ?? "Lead";
  const about = products.length ? products.slice(0, 2).join(", ") + (products.length > 2 ? ` +${products.length - 2}` : "") : "General enquiry";
  notify({ staff: "leads.view" }, {
    type: "lead.new",
    title: `New lead: ${kind} · ${about}`,
    body: [lead.name, lead.company, lead.city].filter(Boolean).join(" · ") + ` (${lead.referenceNo})`,
    href: `/admin/leads/${lead.id}`,
    except: lead.assignedToId,
  });
  if (lead.assignedToId) {
    notify({ users: [lead.assignedToId] }, { type: "lead.assigned", title: `New lead assigned to you: ${kind} · ${about}`, body: [lead.name, lead.company].filter(Boolean).join(" · "), href: `/admin/leads/${lead.id}` });
  }
  const partners: Recipients[] = [...new Set(companies)].map((company) => ({ company, permission: "vendor.leads" }));
  // Partners get no buyer details in the pop-up (contacts depend on their plan).
  if (partners.length) notify(partners, { type: "lead.new", title: `New lead: ${kind} · ${about}`, body: lead.city ? `From ${lead.city} (${lead.referenceNo})` : lead.referenceNo, href: `/vendor/leads/${lead.id}` });
}

// ─── Admin / vendor portal ───────────────────────────────────────────────────

function scopeFor(user: Principal): Prisma.LeadWhereInput {
  if (user.vendorId) {
    assertCan(user, "vendor.leads");
    // Vendors see enquiries for their own products; resellers see enquiries for the products they resell.
    return { OR: [{ vendorId: user.vendorId }, { resellers: { some: { resellerId: user.vendorId } } }], status: { not: "SPAM" } };
  }
  assertCan(user, "leads.view");
  return {};
}

/**
 * Vendor users: the company must receive leads, and buyer email/phone are only shown with an
 * active plan. Returns null for staff (who always see everything).
 */
export async function vendorLeadAccess(user: Principal): Promise<{ unlocked: boolean } | null> {
  if (!user.vendorId) return null;
  assertCan(user, "vendor.leads");
  const vendor = await db.vendor.findUnique({ where: { id: user.vendorId }, select: { receivesLeads: true } });
  if (!vendor?.receivesLeads) throw forbidden("Leads aren't switched on for your company.");
  return { unlocked: await hasLeadContactAccess(user.vendorId) };
}

/**
 * Replaces email and phone with masked versions (also inside the buyer's own text);
 * the real values never reach the browser.
 */
function redactContact<T extends { email: string; phone: string; requirement?: string | null; message?: string | null }>(row: T, access: { unlocked: boolean } | null): T & { contactLocked: boolean } {
  if (!access || access.unlocked) return { ...row, contactLocked: false };
  return {
    ...row,
    email: maskEmail(row.email),
    phone: maskPhone(row.phone),
    ...("requirement" in row ? { requirement: row.requirement ? maskContactsInText(row.requirement) : row.requirement } : {}),
    ...("message" in row ? { message: row.message ? maskContactsInText(row.message) : row.message } : {}),
    contactLocked: true,
  } as T & { contactLocked: boolean };
}

export function leadWhere(user: Principal, q: LeadListQuery): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = [scopeFor(user)];
  if (q.status === "OPEN") and.push({ status: { in: OPEN_STATUSES } });
  else if (q.status !== "ALL") and.push({ status: q.status });
  if (q.source !== "ALL") and.push({ source: q.source });
  if (q.type !== "ALL") and.push({ type: q.type });
  if (q.assignee === "me") and.push({ assignedToId: user.id });
  else if (q.assignee === "none") and.push({ assignedToId: null });
  // "r:<id>" / "r:any": leads forwarded to a reseller (staff only).
  else if (q.assignee?.startsWith("r:")) { if (!user.vendorId) and.push(q.assignee === "r:any" ? { resellers: { some: {} } } : { resellers: { some: { resellerId: q.assignee.slice(2) } } }); }
  else if (q.assignee) and.push({ assignedToId: q.assignee });
  if (q.softwareId) and.push({ software: { some: { softwareId: q.softwareId } } });
  if (q.reseller && !user.vendorId) and.push(q.reseller === "any" ? { resellers: { some: {} } } : { resellers: { some: { resellerId: q.reseller } } });
  if (q.from) and.push({ createdAt: { gte: q.from } });
  if (q.to) and.push({ createdAt: { lte: new Date(q.to.getTime() + 86_399_999) } });
  if (q.followUp === "due") and.push({ nextFollowUpAt: { lte: new Date() }, status: { in: OPEN_STATUSES } });
  if (q.followUp === "upcoming") and.push({ nextFollowUpAt: { gt: new Date() } });
  if (q.q) {
    and.push({
      OR: [
        { name: { contains: q.q, mode: "insensitive" } },
        // Vendors can't search by email/phone (it would reveal hidden contact details).
        ...(user.vendorId
          ? []
          : [{ email: { contains: q.q, mode: "insensitive" as const } }, { phone: { contains: q.q.replace(/\s/g, "") } }]),
        { company: { contains: q.q, mode: "insensitive" } },
        { referenceNo: { equals: q.q.toUpperCase() } },
      ],
    });
  }
  return { AND: and };
}

export async function listLeads(user: Principal, raw: unknown) {
  const q = leadListQuery.parse(raw);
  const access = await vendorLeadAccess(user);
  const where = leadWhere(user, q);
  const [items, total] = await db.$transaction([
    db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.perPage,
      take: q.perPage,
      select: {
        id: true, referenceNo: true, name: true, email: true, phone: true, company: true, status: true, priority: true,
        source: true, type: true, createdAt: true, nextFollowUpAt: true,
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { resellers: true } },
        software: { select: { software: { select: { name: true, slug: true } } } },
      },
    }),
    db.lead.count({ where }),
  ]);
  return {
    items: items.map((i) => redactContact(i, access)),
    contactLocked: Boolean(access && !access.unlocked),
    total,
    page: q.page,
    perPage: q.perPage,
    pages: Math.max(1, Math.ceil(total / q.perPage)),
    query: q,
  };
}

export async function getLead(user: Principal, id: string) {
  const access = await vendorLeadAccess(user);
  const lead = await db.lead.findFirst({
    where: { AND: [{ id }, scopeFor(user)] },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      vendor: { select: { id: true, name: true } },
      resellers: { orderBy: { createdAt: "asc" }, select: { createdAt: true, reseller: { select: { id: true, name: true, city: true } } } },
      software: { include: { software: { select: { id: true, name: true, slug: true, vendor: { select: { name: true } } } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      activities: { orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } }, take: 100 },
      notifications: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) throw notFound("Lead");
  if (!access) return { ...lead, contactLocked: false };
  // Vendors never receive internal notes, the staff timeline, notification targets or the assignee.
  return { ...redactContact(lead, access), notes: [], activities: [], notifications: [], assignedTo: null, assignedToId: null, resellers: [] };
}

export async function updateLead(
  user: Principal,
  input: { id: string; status?: LeadStatus; priority?: "LOW" | "NORMAL" | "HIGH"; type?: LeadTypeKey; assignedToId?: string | null; nextFollowUpAt?: Date | null },
) {
  assertCan(user, "leads.manage");
  const lead = await db.lead.findUnique({ where: { id: input.id } });
  if (!lead) throw notFound("Lead");
  if (input.assignedToId) {
    const assignee = await db.user.findFirst({ where: { id: input.assignedToId, status: "ACTIVE", vendorId: null } });
    if (!assignee) throw new AppError("Choose an active staff member.");
  }
  const activities: Prisma.LeadActivityCreateManyInput[] = [];
  const data: Prisma.LeadUpdateInput = {};
  if (input.status && input.status !== lead.status) {
    data.status = input.status;
    activities.push({ leadId: lead.id, type: "STATUS_CHANGED", fromValue: lead.status, toValue: input.status, actorId: user.id });
  }
  if (input.priority && input.priority !== lead.priority) {
    data.priority = input.priority;
    activities.push({ leadId: lead.id, type: "PRIORITY_CHANGED", fromValue: lead.priority, toValue: input.priority, actorId: user.id });
  }
  if (input.assignedToId !== undefined && input.assignedToId !== lead.assignedToId) {
    data.assignedTo = input.assignedToId ? { connect: { id: input.assignedToId } } : { disconnect: true };
    activities.push({ leadId: lead.id, type: "ASSIGNED", fromValue: lead.assignedToId, toValue: input.assignedToId, actorId: user.id });
  }
  if (input.nextFollowUpAt !== undefined && input.nextFollowUpAt?.getTime() !== lead.nextFollowUpAt?.getTime()) {
    data.nextFollowUpAt = input.nextFollowUpAt;
    activities.push({ leadId: lead.id, type: "FOLLOW_UP_SET", fromValue: lead.nextFollowUpAt?.toISOString() ?? null, toValue: input.nextFollowUpAt?.toISOString() ?? null, actorId: user.id });
  }
  // The lead type (enquiry, quote, demo…) can be corrected by staff; it isn't a timeline event.
  const typeChanged = Boolean(input.type && input.type !== lead.type);
  if (typeChanged) data.type = input.type;
  if (!activities.length && !typeChanged) return lead;
  const updated = await db.$transaction(async (tx) => {
    const u = await tx.lead.update({ where: { id: lead.id }, data });
    if (activities.length) await tx.leadActivity.createMany({ data: activities });
    return u;
  });
  if (input.assignedToId && input.assignedToId !== lead.assignedToId) await notifyLeadAssigned(lead.id, input.assignedToId, user.id);
  if (input.assignedToId && input.assignedToId !== lead.assignedToId && input.assignedToId !== user.id) {
    notify({ users: [input.assignedToId] }, {
      type: "lead.assigned",
      title: `Lead assigned to you by ${user.name}`,
      body: [lead.name, lead.company, LEAD_TYPE_LABEL[lead.type]].filter(Boolean).join(" · ") + ` (${lead.referenceNo})`,
      href: `/admin/leads/${lead.id}`,
    });
  }
  return updated;
}

export async function addLeadNote(user: Principal, leadId: string, body: string) {
  assertCan(user, "leads.manage");
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true } });
  if (!lead) throw notFound("Lead");
  return db.$transaction(async (tx) => {
    const note = await tx.leadNote.create({ data: { leadId, authorId: user.id, body } });
    await tx.leadActivity.create({ data: { leadId, type: "NOTE_ADDED", actorId: user.id } });
    return note;
  });
}

export async function bulkUpdateLeads(user: Principal, ids: string[], patch: { status?: LeadStatus; assignedToId?: string | null }) {
  for (const id of ids) await updateLead(user, { id, ...patch });
  return ids.length;
}

// ─── CSV export ──────────────────────────────────────────────────────────────

const CSV_COLUMNS = [
  "Reference", "Created (IST)", "Type", "Status", "Priority", "Name", "Email", "Phone", "Company", "Company size", "City",
  "Software", "Requirement", "Message", "Source", "Source URL", "UTM source", "UTM medium", "UTM campaign", "Assigned to", "Next follow-up",
] as const;

/** Escapes a CSV cell and neutralises spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Streams matching leads as CSV in batches (bounded memory for large exports). */
export async function* exportLeadsCsv(user: Principal, raw: unknown): AsyncGenerator<string> {
  if (!user.vendorId) assertCan(user, "leads.export");
  const access = await vendorLeadAccess(user);
  const q = leadListQuery.parse(raw);
  const where = leadWhere(user, q);
  const ist = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "short" }).format(d) : "");

  await audit({ actorId: user.id, action: "leads.export", entityType: "lead", summary: "Exported leads to CSV", diff: JSON.parse(JSON.stringify(q)) as Prisma.InputJsonValue });

  yield "﻿" + CSV_COLUMNS.join(",") + "\n";
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.lead.findMany({
      where,
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { assignedTo: { select: { name: true } }, software: { include: { software: { select: { name: true } } } } },
    });
    if (!batch.length) break;
    for (const raw of batch) {
      const l = redactContact(raw, access);
      yield [
        l.referenceNo, ist(l.createdAt), LEAD_TYPE_LABEL[l.type] ?? l.type, l.status, l.priority, l.name, l.email, l.phone, l.company, l.companySize, l.city,
        l.software.map((s) => s.software.name).join("; "), l.requirement, l.message, l.source, l.sourceUrl, l.utmSource, l.utmMedium,
        l.utmCampaign, access ? "" : l.assignedTo?.name, ist(l.nextFollowUpAt),
      ].map(csvCell).join(",") + "\n";
    }
    cursor = batch[batch.length - 1]?.id;
  }
}

// ─── Reports ─────────────────────────────────────────────────────────────────

/**
 * Lead figures for a period: the last `days` days, or a custom range of calendar days in India time
 * (`from` and `to` as YYYY-MM-DD, both included).
 */
export async function leadReport(user: Principal, period: number | { from: string; to: string } = 30) {
  if (user.vendorId) assertCan(user, "vendor.leads");
  else assertCan(user, "leads.view");
  const custom = typeof period === "object";
  const since = custom ? new Date(`${period.from}T00:00:00+05:30`) : new Date(Date.now() - period * 86_400_000);
  // The day after `to`, so the whole last day counts.
  const until = custom ? new Date(new Date(`${period.to}T00:00:00+05:30`).getTime() + 86_400_000) : new Date(Date.now() + 60_000);
  const days = custom ? Math.max(1, Math.round((until.getTime() - since.getTime()) / 86_400_000)) : period;
  const created = { gte: since, lt: until };
  // Vendors and resellers: the same leads as their Leads list (their own, plus ones shared with a reseller).
  const scope: Prisma.LeadWhereInput = user.vendorId ? { OR: [{ vendorId: user.vendorId }, { resellers: { some: { resellerId: user.vendorId } } }], status: { not: "SPAM" } } : {};
  const vendorFilter = user.vendorId
    ? db.lead.findMany({ where: { ...scope, createdAt: created }, select: { createdAt: true } }).then((rows) => {
        const byDay = new Map<string, number>();
        for (const r of rows) {
          const day = new Date(r.createdAt.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
          byDay.set(day, (byDay.get(day) ?? 0) + 1);
        }
        return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day: new Date(`${day}T00:00:00Z`), count: BigInt(count) }));
      })
    : db.$queryRaw<{ day: Date; count: bigint }[]>`
      SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Kolkata') AS day, count(*)::bigint AS count
      FROM "Lead" WHERE "createdAt" >= ${since} AND "createdAt" < ${until} GROUP BY 1 ORDER BY 1`;

  const [byStatus, bySource, perDay, topSoftware, byType] = await Promise.all([
    db.lead.groupBy({ by: ["status"], where: { ...scope, createdAt: created }, _count: { _all: true }, orderBy: { status: "asc" } }),
    db.lead.groupBy({ by: ["source"], where: { ...scope, createdAt: created }, _count: { _all: true }, orderBy: { source: "asc" } }),
    vendorFilter,
    db.leadSoftware.groupBy({
      by: ["softwareId"],
      where: { lead: { ...scope, createdAt: created } },
      _count: { _all: true },
      orderBy: { _count: { softwareId: "desc" } },
      take: 10,
    }),
    db.lead.groupBy({ by: ["type"], where: { ...scope, createdAt: created, status: { not: "SPAM" } }, _count: { _all: true }, orderBy: { type: "asc" } }),
  ]);
  const names = await db.software.findMany({ where: { id: { in: topSoftware.map((t) => t.softwareId) } }, select: { id: true, name: true } });
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  const count = (c: unknown) => (typeof c === "object" && c !== null && "_all" in c ? Number((c as { _all: number })._all) : 0);

  return {
    days,
    byStatus: byStatus.map((r) => ({ key: r.status, count: count(r._count) })),
    bySource: bySource.map((r) => ({ key: r.source, count: count(r._count) })),
    byType: byType.map((r) => ({ key: r.type, count: count(r._count) })).sort((a, b) => b.count - a.count),
    perDay: perDay.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: Number(r.count) })),
    topSoftware: topSoftware.map((t) => ({ name: nameOf.get(t.softwareId) ?? "Deleted", count: count(t._count) })),
  };
}
