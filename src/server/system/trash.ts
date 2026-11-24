import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { AppError, isUniqueViolation, notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import type { Principal } from "@/server/rbac/policy";
import { assertMayDeleteModel } from "@/server/rbac/deletion";
import { getStorageFor, type StorageProvider } from "@/server/storage";
import { delegate, fromPlain, insertOrder, keyOf, model, models, pkWhere, toPlain, type ForeignKey, type Row } from "./graph";
import { assertSystemAdmin } from "./access";
import { refreshWholeSite } from "./revalidate";
import { getSettings } from "@/server/settings";

/**
 * Recycle bin (Admin → System → Recycle bin). Deleting a record still deletes it, but first a snapshot
 * of it — and of everything deleted along with it (a product's plans, features, FAQs, category links…)
 * — is saved here. Restoring puts the rows back and re-links records that pointed at it. Items are
 * removed for good after BIN_DAYS days (by /api/cron), or earlier from the bin.
 */
export const BIN_DAYS = 30;
/** Days an item stays in the bin: Website settings › Business rules (30 when not set). */
export const binDays = async () => (await getSettings()).rules.binDays ?? BIN_DAYS;

interface Snapshot {
  v: 1;
  /** Not database rows: a backup file kept in the bin (system/backup.ts). */
  kind?: "backup";
  model: string;
  id: string;
  rows: { m: string; d: Row }[];
  /** Records that stay but pointed at a deleted row; the delete emptied the key. */
  links: { m: string; where: Row; field: string; value: unknown }[];
}

/** Rows a record owns through a key it holds; the services delete them together with the record. */
const OWNED = new Set(["SeoMeta"]);

const TYPE_LABEL: Record<string, string> = {
  Software: "Product", Category: "Category", Vendor: "Vendor", Brand: "Brand", Industry: "Industry",
  Attribute: "Filter attribute", Post: "Blog post", Author: "Blog author", BlogCategory: "Blog category",
  Page: "Page", ReusableBlock: "Reusable block", ComparisonPage: "Comparison", GeoLocation: "Geo location",
  GeoPage: "Geo page", Banner: "Banner", Announcement: "Announcement", Testimonial: "Testimonial",
  Redirect: "Redirect", ProductQuestion: "Question", Review: "Review", TaxonomyTerm: "Classification term",
  FaqGroup: "FAQ group", EditTemplate: "Website-editor template", Role: "Role", VendorPlan: "Vendor plan", ProductOffer: "Offer", User: "User",
  MediaAsset: "Media file", ResellerProduct: "Authorised product", PageSection: "Page section", AttributeOption: "Filter option",
  Backup: "Backup",
};
export const typeLabel = (m: string, row?: Row) => (m === "Vendor" && row?.kind === "RESELLER" ? "Reseller" : (TYPE_LABEL[m] ?? m));

function labelOf(row: Row, fallback: string): string {
  for (const k of ["name", "title", "filename", "question", "fromPath", "email", "message", "key"]) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 160);
  }
  return fallback;
}

async function collect(tx: Tx, rootModel: string, id: string): Promise<Snapshot | null> {
  const seen = new Map<string, Set<string>>();
  const rows: { m: string; d: Row }[] = [];
  const add = (m: string, r: Row) => {
    let g = seen.get(m);
    if (!g) seen.set(m, (g = new Set()));
    const k = keyOf(m, r);
    if (g.has(k)) return false;
    g.add(k);
    rows.push({ m, d: r });
    return true;
  };
  const walk = async (m: string, where: Row) => {
    const fresh = (await delegate(tx, m).findMany({ where })).filter((r) => add(m, r));
    if (!fresh.length) return;
    for (const fk of model(m).referencedBy) {
      if (fk.onDelete !== "Cascade") continue;
      const vals = [...new Set(fresh.map((r) => r[fk.targetField]).filter((v) => v != null))];
      if (vals.length) await walk(fk.model, { [fk.field]: { in: vals } });
    }
  };
  await walk(rootModel, { [model(rootModel).pk[0]!]: id });
  if (!rows.length) return null;

  for (const { m, d } of [...rows]) {
    for (const fk of model(m).fks) {
      if (!OWNED.has(fk.target) || d[fk.field] == null) continue;
      for (const o of await delegate(tx, fk.target).findMany({ where: { [fk.targetField]: d[fk.field] } })) add(fk.target, o);
    }
  }
  // Edit history saved for the record (the services remove it with the record).
  if (models().has("Revision")) for (const r of await delegate(tx, "Revision").findMany({ where: { entityId: id } })) add("Revision", r);

  const links: Snapshot["links"] = [];
  for (const [m, keys] of seen) {
    const own = rows.filter((r) => r.m === m).map((r) => r.d);
    for (const fk of model(m).referencedBy) {
      if (fk.onDelete === "Cascade") continue;
      const vals = [...new Set(own.map((r) => r[fk.targetField]).filter((v) => v != null))];
      if (!vals.length) continue;
      for (const r of await delegate(tx, fk.model).findMany({ where: { [fk.field]: { in: vals } } })) {
        if (seen.get(fk.model)?.has(keyOf(fk.model, r))) continue;
        links.push({ m: fk.model, where: toPlain(fk.model, pkWhere(fk.model, r)), field: fk.field, value: r[fk.field] });
      }
    }
    void keys;
  }
  return { v: 1, model: rootModel, id, rows: rows.map(({ m, d }) => ({ m, d: toPlain(m, d) })), links };
}

/** Saves a snapshot of each record (and what is deleted with it) to the bin. Call inside the delete's transaction, before deleting. */
export async function moveToBin(tx: Tx, user: Principal | null, modelName: string, ids: string[], labels?: Record<string, string>) {
  // Backstop: every deletion goes through the bin, so nothing is deleted without Delete permission (or approval).
  assertMayDeleteModel(user, modelName);
  const days = await binDays();
  for (const id of [...new Set(ids)]) {
    const snap = await collect(tx, modelName, id);
    if (!snap) continue;
    const root = snap.rows[0]!.d;
    await tx.trashItem.create({
      data: {
        entityType: modelName,
        entityId: id,
        typeLabel: typeLabel(modelName, root),
        label: labels?.[id] ?? labelOf(root, `${typeLabel(modelName, root)} ${id.slice(-6)}`),
        relatedCount: snap.rows.length - 1,
        snapshot: snap as unknown as Prisma.InputJsonValue,
        deletedById: user?.id ?? null,
        deletedByName: user?.name ?? null,
        purgeAt: new Date(Date.now() + days * 86_400_000),
      },
    });
  }
}

/** Puts a deleted backup in the bin. Its files stay where they are until the bin item is removed for good. */
export async function binBackup(user: Principal, name: string, label: string) {
  const snap: Snapshot = { v: 1, kind: "backup", model: "Backup", id: name, rows: [], links: [] };
  await db.trashItem.create({
    data: {
      entityType: "Backup", entityId: name, typeLabel: TYPE_LABEL.Backup!, label: label.slice(0, 160), relatedCount: 0,
      snapshot: snap as unknown as Prisma.InputJsonValue, deletedById: user.id, deletedByName: user.name ?? null,
      purgeAt: new Date(Date.now() + (await binDays()) * 86_400_000),
    },
  });
}

/** Runs a delete in one transaction with the bin snapshot, so both happen or neither does. */
export function withBin<T>(user: Principal | null, modelName: string, ids: string[], run: (tx: Tx) => Promise<T>, labels?: Record<string, string>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await moveToBin(tx, user, modelName, ids, labels);
      return run(tx);
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

// ─── Restore ─────────────────────────────────────────────────────────────────

export interface RestoreReport {
  restored: number;
  /** Rows left out because something they need was deleted for good (e.g. a link to a removed category). */
  skipped: number;
  /** Optional links emptied for the same reason. */
  cleared: number;
}

async function existing(tx: Tx, target: string, field: string, values: unknown[]): Promise<Set<string>> {
  if (!values.length) return new Set();
  const found = await delegate(tx, target).findMany({ where: { [field]: { in: values } }, select: { [field]: true } });
  return new Set(found.map((r) => String(r[field])));
}

async function restoreSnapshot(tx: Tx, snap: Snapshot): Promise<RestoreReport> {
  const byModel = new Map<string, Row[]>();
  for (const { m, d } of snap.rows) {
    if (!models().has(m)) continue;
    byModel.set(m, [...(byModel.get(m) ?? []), { ...d }]);
  }
  const { order, deferred } = insertOrder([...byModel.keys()]);
  const isDeferred = (fk: ForeignKey) => !fk.required && deferred.some((d) => d.model === fk.model && d.field === fk.field);
  /** Values now present, per model and column: `${field}=${value}`. */
  const present = new Map<string, Set<string>>();
  const later: { m: string; where: Row; field: string; value: unknown; target: string; targetField: string }[] = [];
  const report: RestoreReport = { restored: 0, skipped: 0, cleared: 0 };

  for (const m of order) {
    const info = model(m);
    const rows = byModel.get(m)!;
    // Which outside records do these rows point at that still exist?
    const outside = new Map<ForeignKey, Set<string>>();
    for (const fk of info.fks) {
      if (isDeferred(fk)) continue;
      const mine = present.get(fk.target);
      const vals = [...new Set(rows.map((r) => r[fk.field]).filter((v) => v != null && !mine?.has(`${fk.targetField}=${v}`)))];
      outside.set(fk, await existing(tx, fk.target, fk.targetField, vals));
    }
    const kept: Row[] = [];
    for (const row of rows) {
      let ok = true;
      for (const fk of info.fks) {
        const v = row[fk.field];
        if (v == null) continue;
        if (isDeferred(fk)) {
          later.push({ m, where: pkWhere(m, row), field: fk.field, value: v, target: fk.target, targetField: fk.targetField });
          row[fk.field] = null;
          continue;
        }
        if (present.get(fk.target)?.has(`${fk.targetField}=${v}`) || outside.get(fk)!.has(String(v))) continue;
        if (fk.required) { ok = false; break; }
        row[fk.field] = null;
        report.cleared++;
      }
      if (ok) kept.push(row);
      else report.skipped++;
    }
    if (kept.length) {
      const data = kept.map((r) => fromPlain(m, r));
      if (m === snap.model) {
        try {
          await delegate(tx, m).createMany({ data });
        } catch (e) {
          if (isUniqueViolation(e)) throw new AppError(`Another ${typeLabel(m, kept[0]).toLowerCase()} now uses the same name, URL slug or email. Rename or delete it, then restore again.`, "CONFLICT");
          throw e;
        }
      } else {
        await delegate(tx, m).createMany({ data, skipDuplicates: true });
      }
    }
    // Remember what exists now (rows already in the database count too — skipDuplicates kept them).
    const cols = new Set(info.referencedBy.map((fk) => fk.targetField));
    const set = present.get(m) ?? new Set<string>();
    for (const r of kept) for (const c of cols) if (r[c] != null) set.add(`${c}=${r[c]}`);
    present.set(m, set);
    report.restored += kept.length;
  }

  for (const l of later) {
    if (!present.get(l.target)?.has(`${l.targetField}=${l.value}`) && !(await existing(tx, l.target, l.targetField, [l.value])).size) continue;
    await delegate(tx, l.m).updateMany({ where: fromPlain(l.m, l.where), data: { [l.field]: l.value } });
  }
  for (const l of snap.links) {
    if (!models().has(l.m) || !model(l.m).scalars.has(l.field)) continue;
    const fk = model(l.m).fks.find((f) => f.field === l.field);
    if (fk && !present.get(fk.target)?.has(`${fk.targetField}=${l.value}`) && !(await existing(tx, fk.target, fk.targetField, [l.value])).size) continue;
    await delegate(tx, l.m).updateMany({ where: { ...fromPlain(l.m, l.where), [l.field]: null }, data: { [l.field]: l.value } });
  }
  const softwareIds = (byModel.get("Software") ?? []).map((r) => String(r.id));
  for (const id of softwareIds) await tx.$executeRaw`SELECT refresh_software_search(${id})`;
  // Ratings and review counts are stored on the product.
  const rated = [...new Set((byModel.get("Review") ?? []).map((r) => String(r.softwareId)))];
  if (rated.length) {
    const { refreshSoftwareStats } = await import("@/server/services/software");
    for (const id of rated) if (await tx.software.count({ where: { id } })) await refreshSoftwareStats(tx, id);
  }
  return report;
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface BinFilter { type?: string; q?: string; page?: number }
export const BIN_PAGE_SIZE = 50;

export async function listBin(user: Principal, f: BinFilter) {
  assertSystemAdmin(user);
  await purgeExpiredBin();
  const where: Prisma.TrashItemWhereInput = {
    ...(f.type ? { typeLabel: f.type } : {}),
    ...(f.q ? { label: { contains: f.q, mode: "insensitive" } } : {}),
  };
  const page = Math.max(1, f.page ?? 1);
  const [items, total, types] = await Promise.all([
    db.trashItem.findMany({
      where,
      orderBy: { deletedAt: "desc" },
      skip: (page - 1) * BIN_PAGE_SIZE,
      take: BIN_PAGE_SIZE,
      select: { id: true, typeLabel: true, label: true, relatedCount: true, deletedByName: true, deletedAt: true, purgeAt: true },
    }),
    db.trashItem.count({ where }),
    db.trashItem.groupBy({ by: ["typeLabel"], _count: { _all: true }, orderBy: { typeLabel: "asc" } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / BIN_PAGE_SIZE)), types: types.map((t) => ({ type: t.typeLabel, count: t._count._all })) };
}

export async function restoreFromBin(user: Principal, ids: string[]) {
  assertSystemAdmin(user);
  const items = await db.trashItem.findMany({ where: { id: { in: ids } }, orderBy: { deletedAt: "asc" } });
  if (!items.length) throw notFound("Item");
  const total: RestoreReport = { restored: 0, skipped: 0, cleared: 0 };
  for (const item of items) {
    const snap = item.snapshot as unknown as Snapshot;
    if (snap.kind === "backup") {
      const { restoreBinnedBackup } = await import("./backup");
      await restoreBinnedBackup(snap.id);
      await db.trashItem.delete({ where: { id: item.id } });
      await audit({ actorId: user.id, action: "bin.restore", entityType: "backup", entityId: snap.id, summary: `Restored backup ${item.label}` });
      total.restored += 1;
      continue;
    }
    await db.$transaction(
      async (tx) => {
        const root = model(snap.model);
        if (await delegate(tx, snap.model).count({ where: { [root.pk[0]!]: snap.id } })) throw new AppError(`“${item.label}” is already back on the website.`, "CONFLICT");
        const r = await restoreSnapshot(tx, snap);
        await tx.trashItem.delete({ where: { id: item.id } });
        await audit({ actorId: user.id, action: "bin.restore", entityType: snap.model.toLowerCase(), entityId: snap.id, summary: `Restored ${item.typeLabel.toLowerCase()} ${item.label}`, diff: { ...r } }, tx);
        total.restored += r.restored;
        total.skipped += r.skipped;
        total.cleared += r.cleared;
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  }
  refreshWholeSite();
  return { items: items.length, ...total };
}

type BinRow = { id: string; snapshot: Prisma.JsonValue };

/** Deletes bin items for good, and the files of media items no record uses any more. */
async function removeForever(items: BinRow[]) {
  if (!items.length) return 0;
  await db.trashItem.deleteMany({ where: { id: { in: items.map((i) => i.id) } } });
  for (const i of items) {
    const snap = i.snapshot as unknown as Snapshot;
    if (snap.kind === "backup") {
      const { purgeBinnedBackup } = await import("./backup");
      await purgeBinnedBackup(snap.id).catch((e) => console.error("[bin] backup delete failed", e));
      continue;
    }
    for (const { m, d } of snap.rows ?? []) {
      if (m !== "MediaAsset" || typeof d.storageKey !== "string") continue;
      if (await db.mediaAsset.count({ where: { storageKey: d.storageKey } })) continue;
      await (await getStorageFor(String(d.provider) as StorageProvider)).delete(d.storageKey).catch((e) => console.error("[bin] file delete failed", e));
    }
  }
  return items.length;
}

export async function deleteFromBin(user: Principal, ids: string[]) {
  assertSystemAdmin(user);
  const items = await db.trashItem.findMany({ where: { id: { in: ids } }, select: { id: true, snapshot: true, label: true } });
  const n = await removeForever(items);
  await audit({ actorId: user.id, action: "bin.delete", entityType: "bin", summary: `Deleted ${n} item(s) from the recycle bin for good` });
  return n;
}

export async function emptyBin(user: Principal) {
  assertSystemAdmin(user);
  let n = 0;
  for (;;) {
    const batch = await db.trashItem.findMany({ select: { id: true, snapshot: true }, take: 100 });
    if (!batch.length) break;
    n += await removeForever(batch);
  }
  await audit({ actorId: user.id, action: "bin.empty", entityType: "bin", summary: `Emptied the recycle bin (${n} item(s))` });
  return n;
}

/** Removes items older than BIN_DAYS. Called by /api/cron and when the bin is opened. */
export async function purgeExpiredBin() {
  let n = 0;
  for (;;) {
    const batch = await db.trashItem.findMany({ where: { purgeAt: { lt: new Date() } }, select: { id: true, snapshot: true }, take: 100 });
    if (!batch.length) break;
    n += await removeForever(batch);
  }
  return n;
}
