import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { ApprovalStatus, Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, forbidden, notFound, queued } from "@/server/errors";
import { notify } from "@/server/notifications/notify";
import { sanitizePlain } from "@/server/sanitize";
import { PERMISSIONS, VIEW_ONLY_MESSAGE, moduleOf, type Permission } from "./permissions";
import { NO_DELETE_MESSAGE } from "@/lib/delete-permission";
import { can, isSuperAdmin, type Principal } from "./policy";

/**
 * Deletion control (enforced here, on the server, whatever the screens show).
 *
 * - Only the Super Admin deletes freely. Staff (Admin, Content Editor…) need the module's Delete permission,
 *   which only the Super Admin can grant (Roles page); without it they get "You don't have permission to delete
 *   this item." That covers deleting a record (guardDelete) and removing elements inside one: a page section,
 *   a widget, a button, a list item, a menu item, a plan… (guardRemovals).
 * - The approval flow is only for vendor and reseller users: a deletion they ask for becomes a DeletionRequest
 *   (or, for products, offers, team…, a vendor ApprovalRequest) for the Super Admin.
 * - Approving runs the deletion with the Super Admin's authority. Every request, approval, rejection and
 *   withdrawal is in the audit log.
 * - Vendors and resellers never delete directly: their portal sends every change to the approval queue, and
 *   approving a vendor deletion (or a change that removes something) also needs the Super Admin.
 */

// ─── What can be deleted, and how to run it once approved ────────────────────

type Args = Record<string, unknown>;
interface Kind {
  permission: Permission;
  /** "product", "page section"… for messages. */
  what: string;
  /** Model to read names from when no label is given. */
  model?: string;
  run: (approver: Principal, args: Args) => Promise<unknown>;
}

const ids = (a: Args) => (Array.isArray(a.ids) ? (a.ids as string[]) : [String(a.id)]);
const str = (v: unknown) => String(v);

export const DELETION_KINDS = {
  software: { permission: "software.delete", what: "product", model: "software", run: async (u, a) => (await import("@/server/services/software")).deleteSoftware(u, ids(a)) },
  category: { permission: "categories.delete", what: "category", model: "category", run: async (u, a) => (await import("@/server/services/categories")).deleteCategory(u, str(a.id)) },
  page: { permission: "cms.pages.delete", what: "page", model: "page", run: async (u, a) => (await import("@/server/services/cms")).deletePage(u, str(a.id)) },
  reusableBlock: { permission: "cms.blocks.delete", what: "reusable block", model: "reusableBlock", run: async (u, a) => (await import("@/server/services/cms")).deleteReusableBlock(u, str(a.id)) },
  template: { permission: "cms.pages.delete", what: "website-editor template", model: "editTemplate", run: async (u, a) => (await import("@/server/services/edit-templates")).deleteTemplate(u, str(a.id)) },
  comparison: { permission: "comparisons.delete", what: "comparison", model: "comparisonPage", run: async (u, a) => (await import("@/server/services/comparisons")).deleteComparison(u, str(a.id)) },
  geoLocation: { permission: "geo.delete", what: "location", model: "geoLocation", run: async (u, a) => (await import("@/server/services/geo")).deleteLocation(u, str(a.id)) },
  geoPages: { permission: "geo.delete", what: "local landing page", model: "geoPage", run: async (u, a) => (await import("@/server/services/geo")).deleteGeoPages(u, ids(a)) },
  media: { permission: "media.delete", what: "file", model: "mediaAsset", run: async (u, a) => (await import("@/server/services/media")).deleteMedia(u, str(a.id), Boolean(a.force)) },
  banner: { permission: "cms.navigation.delete", what: "banner", model: "banner", run: async (u, a) => (await import("@/server/services/navigation")).deleteItem(u, "banner", str(a.id)) },
  announcement: { permission: "cms.navigation.delete", what: "announcement", model: "announcement", run: async (u, a) => (await import("@/server/services/navigation")).deleteItem(u, "announcement", str(a.id)) },
  testimonial: { permission: "cms.blocks.delete", what: "testimonial", model: "testimonial", run: async (u, a) => (await import("@/server/services/navigation")).deleteItem(u, "testimonial", str(a.id)) },
  redirect: { permission: "seo.delete", what: "redirect", model: "redirect", run: async (u, a) => (await import("@/server/services/navigation")).deleteRedirect(u, str(a.id)) },
  offer: { permission: "offers.delete", what: "offer", model: "productOffer", run: async (u, a) => (await import("@/server/services/offers")).deleteOffer(u, str(a.id)) },
  question: { permission: "reviews.delete", what: "question", model: "productQuestion", run: async (u, a) => (await import("@/server/services/questions")).deleteQuestion(u, str(a.id)) },
  reviews: { permission: "reviews.delete", what: "review", model: "review", run: async (u, a) => (await import("@/server/services/reviews")).deleteReviews(u, ids(a)) },
  resellerProduct: { permission: "vendors.delete", what: "authorised product", run: async (u, a) => (await import("@/server/services/resellers")).removeAuthorisedProduct(u, str(a.resellerId), str(a.softwareId)) },
  terms: { permission: "taxonomy.delete", what: "term", model: "taxonomyTerm", run: async (u, a) => (await import("@/server/services/taxonomies")).deleteTerms(u, a.kind as never, ids(a)) },
  vendor: { permission: "vendors.delete", what: "vendor", model: "vendor", run: async (u, a) => (await import("@/server/services/taxonomy")).deleteVendor(u, str(a.id)) },
  brand: { permission: "vendors.delete", what: "brand", model: "brand", run: async (u, a) => (await import("@/server/services/taxonomy")).deleteBrand(u, str(a.id)) },
  industry: { permission: "taxonomy.delete", what: "industry", model: "industry", run: async (u, a) => (await import("@/server/services/taxonomy")).deleteIndustry(u, str(a.id)) },
  attribute: { permission: "taxonomy.delete", what: "attribute", model: "attribute", run: async (u, a) => (await import("@/server/services/taxonomy")).deleteAttribute(u, str(a.id)) },
  plan: { permission: "billing.delete", what: "plan", model: "vendorPlan", run: async (u, a) => (await import("@/server/services/billing")).deletePlan(u, str(a.id)) },
  post: { permission: "blog.delete", what: "blog post", model: "post", run: async (u, a) => (await import("@/server/services/blog")).deletePost(u, str(a.id)) },
  author: { permission: "blog.delete", what: "blog author", model: "author", run: async (u, a) => (await import("@/server/services/blog")).deleteAuthor(u, str(a.id)) },
  faqGroup: { permission: "cms.blocks.delete", what: "FAQ group", model: "faqGroup", run: async (u, a) => (await import("@/server/services/navigation")).deleteFaqGroup(u, str(a.id)) },
  blogCategory: { permission: "blog.delete", what: "blog category", model: "blogCategory", run: async (u, a) => (await import("@/server/services/blog")).deleteBlogCategory(u, str(a.id)) },

  // Changes that remove elements inside a record: approval saves the whole proposed change.
  "page.sections": { permission: "cms.pages.delete", what: "page change", run: async (u, a) => (await import("@/server/services/cms")).saveSections(u, str(a.pageId), a.sections as never, (a.message as string | null) ?? null) },
  "page.section": { permission: "cms.pages.delete", what: "section change", run: async (u, a) => (await import("@/server/services/cms")).savePageSectionData(u, str(a.sectionId), a.data as never) },
  "block.save": { permission: "cms.blocks.delete", what: "reusable block change", run: async (u, a) => (await import("@/server/services/cms")).saveReusableBlock(u, str(a.id), a.input as never) },
  "menu.save": { permission: "cms.navigation.delete", what: "menu change", run: async (u, a) => (await import("@/server/services/navigation")).saveMenu(u, str(a.key), str(a.name), a.items as never) },
  "faq.save": { permission: "cms.blocks.delete", what: "FAQ change", run: async (u, a) => (await import("@/server/services/navigation")).saveFaqGroup(u, str(a.id), a.input as never) },
  "comparison.save": { permission: "comparisons.delete", what: "comparison change", run: async (u, a) => (await import("@/server/services/comparisons")).saveComparison(u, str(a.id), a.input as never) },
  "software.save": { permission: "software.delete", what: "product change", run: async (u, a) => (await import("@/server/services/software")).updateSoftware(u, str(a.id), a.input as never) },
  "attribute.save": { permission: "taxonomy.delete", what: "attribute change", run: async (u, a) => (await import("@/server/services/taxonomy")).saveAttribute(u, str(a.id), a.input as never) },
  "setting.save": { permission: "settings.delete", what: "settings change", run: async (u, a) => (await import("@/server/settings")).updateSetting(u, a.key as never, a.value) },
} satisfies Record<string, Kind>;
export type DeletionKind = keyof typeof DELETION_KINDS;
const kindOf = (k: string): Kind | undefined => (DELETION_KINDS as Record<string, Kind>)[k];
export const deletionWhat = (k: string) => kindOf(k)?.what ?? "item";

// ─── Context: approving a request, or applying a vendor request ──────────────

interface Ctx { approving?: { baseline: string | null }; noQueue?: string }
const als = new AsyncLocalStorage<Ctx>();

/** Runs a vendor approval: a removal the approver may not make is refused (not queued as a second request). */
export const withoutQueue = <T>(reason: string, fn: () => Promise<T>): Promise<T> => als.run({ ...als.getStore(), noQueue: reason }, fn);

/** May this person delete with this permission right now (no approval needed)? */
export function canDelete(user: Principal | null | undefined, permission: Permission): boolean {
  if (!user || user.readOnly) return false;
  if (isSuperAdmin(user)) return true;
  // Vendor and reseller users never delete directly.
  if (user.vendorId) return false;
  return can(user, permission);
}

/** May this person send a deletion request for this module (they can at least see or edit it)? */
function mayRequest(user: Principal, permission: Permission): boolean {
  if (user.readOnly) return false;
  if (user.vendorId) return permission === "media.delete" && can(user, "media.manage");
  const m = moduleOf(permission);
  return [m?.view, m?.create, m?.edit].some((p) => p && can(user, p));
}

// ─── Guards used by every delete and save ────────────────────────────────────

/**
 * Call before deleting a record. Returns when the user may delete; otherwise sends a request to the Super
 * Admin and throws a QUEUED notice (server actions show it as a success message; nothing was deleted).
 */
export async function guardDelete(user: Principal, kind: DeletionKind, args: Args, label?: string, note?: string | null): Promise<void> {
  const k = DELETION_KINDS[kind] as Kind;
  if (als.getStore()?.approving || canDelete(user, k.permission)) return;
  refuseOrAsk(user, k);
  const name = label ?? (await labelFor(k, args));
  await openDeletionRequest(user, { kind, permission: k.permission, args, label: name, detail: null, baseline: null, note });
  throw queued(`Deleting ${k.what === "item" ? "this" : `the ${k.what}`} “${name}” needs the Super Admin's approval. Request sent; nothing is deleted until they approve it.`);
}

/**
 * Call before saving a change to a record. If the change removes elements (array items such as sections,
 * widgets, buttons, list items, menu items, plans, FAQs) and the user may not delete, the whole change goes to
 * the Super Admin instead and a QUEUED notice is thrown. Plain edits pass straight through.
 */
export async function guardRemovals(user: Principal, spec: { kind: DeletionKind; args: Args; label: string; before: unknown; after: unknown; root?: string }): Promise<void> {
  const removed = findRemovals(spec.before, spec.after);
  if (!removed.length) return;
  const ctx = als.getStore();
  if (ctx?.approving) {
    if (ctx.approving.baseline && fingerprint(spec.before) !== ctx.approving.baseline) {
      throw new AppError("This changed after the request was made, so approving it would undo newer work. Reject it and ask them to make the change again.", "CONFLICT");
    }
    return;
  }
  const k = DELETION_KINDS[spec.kind] as Kind;
  if (canDelete(user, k.permission)) return;
  const detail = describeRemovals(removed, spec.root);
  // Removing elements inside a record: staff without Delete are refused (nothing is saved).
  if (!user.vendorId) {
    if (user.readOnly) throw forbidden(VIEW_ONLY_MESSAGE);
    throw forbidden(als.getStore()?.noQueue ?? `${NO_DELETE_MESSAGE} This change removes ${detail}. Hide it instead, or keep it and save your other changes.`);
  }
  refuseOrAsk(user, k);
  await openDeletionRequest(user, { kind: spec.kind, permission: k.permission, args: spec.args, label: spec.label, detail, baseline: fingerprint(spec.before) });
  throw queued(`This change removes ${detail}. Removing needs the Super Admin's approval, so the whole change was sent to them. Nothing has changed yet.`);
}

/**
 * Without Delete permission: staff (Admin, Content Editor…) are simply refused. Only vendor and reseller users
 * get the approval flow; everything else they do is already a vendor approval request (services/approvals.ts).
 */
function refuseOrAsk(user: Principal, k: Kind) {
  if (user.readOnly) throw forbidden(VIEW_ONLY_MESSAGE);
  const reason = als.getStore()?.noQueue;
  if (reason) throw forbidden(reason);
  if (!user.vendorId || !mayRequest(user, k.permission)) throw forbidden(NO_DELETE_MESSAGE);
}

/** Backstop for the recycle bin (every deletion passes through it): a delete nobody authorised is refused. */
const MODEL_PERMISSION: Record<string, Permission> = {
  Software: "software.delete", Category: "categories.delete", Page: "cms.pages.delete", ReusableBlock: "cms.blocks.delete",
  ComparisonPage: "comparisons.delete", GeoLocation: "geo.delete", GeoPage: "geo.delete", MediaAsset: "media.delete",
  Banner: "cms.navigation.delete", Announcement: "cms.navigation.delete", Testimonial: "cms.blocks.delete", Redirect: "seo.delete",
  ProductOffer: "offers.delete", ProductQuestion: "reviews.delete", Review: "reviews.delete", ResellerProduct: "vendors.delete",
  TaxonomyTerm: "taxonomy.delete", Vendor: "vendors.delete", Brand: "vendors.delete", Industry: "taxonomy.delete", Attribute: "taxonomy.delete",
  FaqGroup: "cms.blocks.delete", EditTemplate: "cms.pages.delete", PageSection: "cms.pages.delete", AttributeOption: "taxonomy.delete",
  VendorPlan: "billing.delete", Post: "blog.delete", Author: "blog.delete", BlogCategory: "blog.delete", Role: "roles.manage",
};
export function assertMayDeleteModel(user: Principal | null, modelName: string) {
  if (!user || als.getStore()?.approving) return; // system jobs; approved requests
  const perm = MODEL_PERMISSION[modelName];
  if (perm ? canDelete(user, perm) : isSuperAdmin(user)) return;
  throw forbidden("Only the Super Admin (or a role they gave Delete permission) can delete this.");
}

// ─── Finding removed elements ────────────────────────────────────────────────

interface Removal { path: string[]; count: number; names: string[] }
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const nameOf = (o: Record<string, unknown>) => {
  const n = o.label ?? o.title ?? o.name ?? o.question ?? o.text ?? o.heading ?? o.type;
  return typeof n === "string" && n.trim() ? n.trim().slice(0, 40) : "";
};

/**
 * Objects that were in a list before and aren't after (matched by id when items have one, otherwise by
 * count), at any depth. Lists of plain values (ids, tags) are links, not elements, so they don't count.
 * A field missing from the change isn't part of it and is ignored.
 */
export function findRemovals(before: unknown, after: unknown, path: string[] = [], out: Removal[] = []): Removal[] {
  if (after === undefined) return out;
  if (Array.isArray(before)) {
    const objs = before.filter(isObj);
    if (!objs.length) return out;
    const next = Array.isArray(after) ? after.filter(isObj) : [];
    if (objs.every((o) => typeof o.id === "string" && o.id)) {
      const byId = new Map(next.filter((o) => typeof o.id === "string").map((o) => [o.id as string, o]));
      const gone = objs.filter((o) => !byId.has(o.id as string));
      if (gone.length) out.push({ path, count: gone.length, names: gone.map(nameOf).filter(Boolean) });
      for (const o of objs) {
        const m = byId.get(o.id as string);
        if (m) findRemovals(o, m, [...path, nameOf(o) || "item"], out);
      }
    } else {
      if (objs.length > next.length) out.push({ path, count: objs.length - next.length, names: [] });
      objs.forEach((o, i) => next[i] && findRemovals(o, next[i], [...path, nameOf(o) || `item ${i + 1}`], out));
    }
    return out;
  }
  if (isObj(before) && isObj(after)) for (const key of Object.keys(before)) findRemovals(before[key], after[key], [...path, key], out);
  return out;
}

const pretty = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
export function describeRemovals(list: Removal[], root = "the list"): string {
  const parts = list.slice(0, 4).map((r) => {
    // Structural steps (data, rows, columns, unnamed items) say nothing to a reader: leave them out.
    const where = r.path.filter((p, i, all) => i === all.length - 1 || !/^(data|rows|cols|columns|children|items?|item \d+)$/.test(p)).map((p, i, all) => (i === all.length - 1 ? pretty(p) : p)).join(" › ");
    const names = r.names.length ? ` (${r.names.slice(0, 3).map((n) => `“${n}”`).join(", ")}${r.names.length > 3 ? "…" : ""})` : "";
    return `${r.count} ${r.count === 1 ? "item" : "items"}${names} from ${where || root}`;
  });
  return parts.join("; ") + (list.length > 4 ? ` and ${list.length - 4} more` : "");
}

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (isObj(v)) return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
}
export const fingerprint = (v: unknown) => createHash("sha256").update(stable(v)).digest("hex").slice(0, 40);

async function labelFor(k: Kind, args: Args): Promise<string> {
  const list = ids(args).filter((x) => x && x !== "undefined");
  if (!k.model || !list.length) return k.what;
  const delegate = (db as unknown as Record<string, { findMany: (q: unknown) => Promise<Record<string, unknown>[]> }>)[k.model];
  const rows = await delegate?.findMany({ where: { id: { in: list.slice(0, 50) } }, take: 50 }).catch(() => []) ?? [];
  const names = rows.map((r) => String(r.name ?? r.title ?? r.filename ?? r.fromPath ?? r.question ?? r.label ?? r.id));
  if (!names.length) return k.what;
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} and ${names.length - 3} more` : names.join(", ");
}

// ─── Requests ────────────────────────────────────────────────────────────────

export const DELETIONS_TAG = "deletion-requests";

interface DeletionRow {
  id: string; kind: string; permission: string; args: Prisma.JsonValue; label: string; detail: string | null; baseline: string | null;
  status: ApprovalStatus; note: string | null; decisionNote: string | null; vendorId: string | null;
  requestedById: string | null; decidedById: string | null; decidedAt: Date | null; createdAt: Date; updatedAt: Date;
  requestedBy?: { id: string; name: string; email: string } | null; decidedBy?: { name: string } | null;
}
interface Delegate {
  findFirst(q: unknown): Promise<DeletionRow | null>;
  findUnique(q: unknown): Promise<DeletionRow | null>;
  findMany(q: unknown): Promise<DeletionRow[]>;
  count(q: unknown): Promise<number>;
  create(q: unknown): Promise<DeletionRow>;
  update(q: unknown): Promise<DeletionRow>;
}
/** Typed access until `prisma generate` has picked up the new table. */
const requests = (db as unknown as { deletionRequest: Delegate }).deletionRequest;
const json = (v: unknown) => JSON.parse(JSON.stringify(v ?? {})) as Prisma.InputJsonValue;

async function openDeletionRequest(user: Principal, r: { kind: string; permission: Permission; args: Args; label: string; detail: string | null; baseline: string | null; note?: string | null }) {
  const args = json(r.args);
  const note = r.note ? sanitizePlain(r.note).slice(0, 1000) || null : null;
  const same = await requests.findFirst({ where: { kind: r.kind, status: "PENDING", requestedById: user.id, args: { equals: args } } });
  const data = { label: r.label.slice(0, 200), detail: r.detail?.slice(0, 1000) ?? null, baseline: r.baseline, note };
  const row = same
    ? await requests.update({ where: { id: same.id }, data })
    : await requests.create({ data: { ...data, kind: r.kind, permission: r.permission, args, vendorId: user.vendorId, requestedById: user.id } });
  await audit({ actorId: user.id, action: same ? "deletion.request.update" : "deletion.request", entityType: "deletion", entityId: row.id, summary: `Asked to delete ${deletionWhat(r.kind)} “${r.label}”${r.detail ? `: ${r.detail}` : ""}`, diff: { kind: r.kind, permission: r.permission } });
  revalidateTag(DELETIONS_TAG);
  if (!same) {
    notify({ superAdmins: true }, {
      type: "deletion.request",
      title: `Deletion request: ${deletionWhat(r.kind)}`,
      body: `${r.label}${r.detail ? ` · ${r.detail}` : ""} · ${user.name}`.slice(0, 480),
      href: `/admin/deletions/${row.id}`,
    });
  }
  return row;
}

/** Super Admin approves (runs the deletion with their authority) or rejects (reason required). */
export async function decideDeletion(user: Principal, id: string, decision: "APPROVE" | "REJECT", note?: string | null) {
  if (!isSuperAdmin(user)) throw forbidden("Only the Super Admin can approve or reject deletion requests.");
  const r = await requests.findUnique({ where: { id } });
  if (!r) throw notFound("Request");
  if (r.status !== "PENDING") throw new AppError(`This request was already ${r.status.toLowerCase()}.`, "CONFLICT");
  const decisionNote = note ? sanitizePlain(note).slice(0, 1000) || null : null;
  if (decision === "REJECT" && !decisionNote) throw new AppError("Say why you're rejecting this request.", "BAD_REQUEST", { note: ["Required when rejecting"] });
  if (decision === "APPROVE") {
    const k = kindOf(r.kind);
    if (!k) throw new AppError("This kind of request can't be run any more. Reject it instead.", "CONFLICT");
    await als.run({ approving: { baseline: r.baseline } }, () => k.run(user, (r.args ?? {}) as Args));
  }
  const status: ApprovalStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  await requests.update({ where: { id }, data: { status, decisionNote, decidedById: user.id, decidedAt: new Date() } });
  await audit({ actorId: user.id, action: `deletion.${decision === "APPROVE" ? "approve" : "reject"}`, entityType: "deletion", entityId: id, summary: `${decision === "APPROVE" ? "Approved" : "Rejected"}: delete ${deletionWhat(r.kind)} “${r.label}”${decisionNote ? ` — ${decisionNote}` : ""}` });
  revalidateTag(DELETIONS_TAG);
  if (r.requestedById) {
    notify({ users: [r.requestedById] }, {
      type: "deletion.decided",
      title: `${decision === "APPROVE" ? "Approved" : "Rejected"}: delete ${deletionWhat(r.kind)}`,
      body: decisionNote ? `${r.label}: ${decisionNote}` : r.label,
      href: r.vendorId ? "/vendor" : `/admin/deletions/${id}`,
    });
  }
  return status;
}

/** The requester (or the Super Admin) withdraws a pending request. */
export async function cancelDeletion(user: Principal, id: string) {
  const r = await requests.findUnique({ where: { id } });
  if (!r || (r.requestedById !== user.id && !isSuperAdmin(user))) throw notFound("Request");
  if (r.status !== "PENDING") throw new AppError("Only pending requests can be withdrawn.");
  await requests.update({ where: { id }, data: { status: "CANCELLED", decisionNote: r.requestedById === user.id ? "Withdrawn by the requester" : "Withdrawn by the Super Admin", decidedAt: new Date() } });
  await audit({ actorId: user.id, action: "deletion.cancel", entityType: "deletion", entityId: id, summary: `Withdrew the request to delete ${deletionWhat(r.kind)} “${r.label}”` });
  revalidateTag(DELETIONS_TAG);
}

const PAGE = 30;
/** Super Admin sees every request; anyone else only their own. */
export async function listDeletions(user: Principal, q: { status?: ApprovalStatus | "ALL"; page?: number; q?: string }) {
  if (user.readOnly && !user.permissions.size) throw forbidden();
  const where: Record<string, unknown> = {
    ...(isSuperAdmin(user) ? {} : { requestedById: user.id }),
    ...(q.status && q.status !== "ALL" ? { status: q.status } : {}),
    ...(q.q?.trim() ? { OR: [{ label: { contains: q.q.trim(), mode: "insensitive" } }, { detail: { contains: q.q.trim(), mode: "insensitive" } }, { requestedBy: { name: { contains: q.q.trim(), mode: "insensitive" } } }] } : {}),
  };
  const page = Math.max(1, q.page ?? 1);
  const [items, total] = await Promise.all([
    requests.findMany({ where, orderBy: [{ createdAt: q.status === "PENDING" ? "asc" : "desc" }], skip: (page - 1) * PAGE, take: PAGE, include: { requestedBy: { select: { id: true, name: true, email: true } }, decidedBy: { select: { name: true } } } }),
    requests.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

export async function getDeletion(user: Principal, id: string) {
  const r = await requests.findUnique({ where: { id }, include: { requestedBy: { select: { id: true, name: true, email: true } }, decidedBy: { select: { name: true } } } });
  if (!r || (!isSuperAdmin(user) && r.requestedById !== user.id)) throw notFound("Request");
  return r;
}

export async function pendingDeletionCount(user: Principal | null) {
  if (!user || user.vendorId) return 0;
  return requests.count({ where: { status: "PENDING", ...(isSuperAdmin(user) ? {} : { requestedById: user.id }) } }).catch(() => 0);
}

export const permissionLabel = (p: string) => PERMISSIONS[p as Permission] ?? p;
