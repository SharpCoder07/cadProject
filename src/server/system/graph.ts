import "server-only";
import { Prisma } from "@prisma/client";
import type { db, Tx } from "@/server/db";

/**
 * The database's shape, read from Prisma's own model description: every table, its primary key and
 * every foreign key with its on-delete rule. The recycle bin and backups use it so they keep working
 * when models are added, without a hand-written list of tables.
 */
type DmmfModel = (typeof Prisma.dmmf.datamodel.models)[number];
export type DmmfField = DmmfModel["fields"][number];

export interface ForeignKey {
  /** Model that holds the key. */
  model: string;
  /** Scalar column holding the key, e.g. "categoryId". */
  field: string;
  /** Model it points at, and the column there (almost always "id"). */
  target: string;
  targetField: string;
  required: boolean;
  onDelete: string;
}

export interface ModelInfo {
  name: string;
  /** Property name on the Prisma client, e.g. "pricingPlan". */
  delegate: string;
  /** Plain columns (scalars and enums) — the only fields that are saved and restored. */
  scalars: Map<string, DmmfField>;
  pk: string[];
  /** Keys this model holds. */
  fks: ForeignKey[];
  /** Keys in other models (or this one) that point at this model. */
  referencedBy: ForeignKey[];
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

function build(): Map<string, ModelInfo> {
  const out = new Map<string, ModelInfo>();
  for (const m of Prisma.dmmf.datamodel.models) {
    const scalars = new Map(m.fields.filter((f) => f.kind === "scalar" || f.kind === "enum").map((f) => [f.name, f]));
    const pk = m.primaryKey?.fields?.length ? [...m.primaryKey.fields] : m.fields.filter((f) => f.isId).map((f) => f.name);
    const fks: ForeignKey[] = m.fields
      .filter((f) => f.kind === "object" && (f.relationFromFields?.length ?? 0) === 1)
      .map((f) => {
        const field = f.relationFromFields![0]!;
        return {
          model: m.name,
          field,
          target: f.type,
          targetField: f.relationToFields?.[0] ?? "id",
          required: Boolean(scalars.get(field)?.isRequired),
          onDelete: f.relationOnDelete ?? (scalars.get(field)?.isRequired ? "Restrict" : "SetNull"),
        };
      });
    out.set(m.name, { name: m.name, delegate: lowerFirst(m.name), scalars, pk, fks, referencedBy: [] });
  }
  for (const info of out.values()) for (const fk of info.fks) out.get(fk.target)?.referencedBy.push(fk);
  return out;
}

let cache: Map<string, ModelInfo> | null = null;
export function models(): Map<string, ModelInfo> {
  cache ??= build();
  return cache;
}
export function model(name: string): ModelInfo {
  const m = models().get(name);
  if (!m) throw new Error(`Unknown model ${name}`);
  return m;
}

type Client = Tx | typeof db;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic access to a model by name
type AnyDelegate = { findMany: (a: any) => Promise<Row[]>; createMany: (a: any) => Promise<{ count: number }>; updateMany: (a: any) => Promise<{ count: number }>; count: (a?: any) => Promise<number>; deleteMany: (a?: any) => Promise<{ count: number }> };
export type Row = Record<string, unknown>;
export const delegate = (client: Client, name: string) => (client as unknown as Record<string, AnyDelegate>)[model(name).delegate]!;

export const keyOf = (name: string, row: Row) => model(name).pk.map((k) => String(row[k])).join("|");
export const pkWhere = (name: string, row: Row): Row => {
  const pk = model(name).pk;
  if (pk.length === 1) return { [pk[0]!]: row[pk[0]!] };
  return Object.fromEntries(pk.map((k) => [k, row[k]]));
};

/** A row as plain JSON (dates become ISO strings, decimals strings). Only columns are kept. */
export function toPlain(name: string, row: Row): Row {
  const info = model(name);
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (!info.scalars.has(k)) continue;
    out[k] = v instanceof Date ? v.toISOString() : v instanceof Prisma.Decimal ? v.toString() : v;
  }
  return out;
}

/** The reverse of toPlain, ready for createMany. Columns that no longer exist are dropped. */
export function fromPlain(name: string, row: Row): Row {
  const info = model(name);
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const f = info.scalars.get(k);
    if (!f) continue;
    if (f.type === "DateTime" && typeof v === "string") out[k] = new Date(v);
    else if (f.type === "Json" && v === null) out[k] = Prisma.DbNull;
    else out[k] = v;
  }
  return out;
}

/**
 * Models in an order where every model comes after the models it points at. Keys that would make a
 * loop (and keys pointing at the same model) are returned as `deferred`: insert those columns as
 * empty, then fill them in once every row exists.
 */
export function insertOrder(names: string[]): { order: string[]; deferred: ForeignKey[] } {
  const set = new Set(names);
  const deferred: ForeignKey[] = [];
  const edges = new Map<string, ForeignKey[]>();
  for (const n of names) {
    edges.set(n, model(n).fks.filter((fk) => set.has(fk.target) && fk.target !== n));
    for (const fk of model(n).fks) if (fk.target === n) deferred.push(fk);
  }
  const order: string[] = [];
  const done = new Set<string>();
  while (order.length < names.length) {
    const ready = names.filter((n) => !done.has(n) && edges.get(n)!.every((fk) => done.has(fk.target)));
    if (ready.length) {
      for (const n of ready.sort()) { order.push(n); done.add(n); }
      continue;
    }
    // A loop: postpone one optional key in it.
    const stuck = names.filter((n) => !done.has(n));
    let cut = false;
    for (const n of stuck) {
      const list = edges.get(n)!;
      const i = list.findIndex((fk) => !done.has(fk.target) && !fk.required);
      if (i >= 0) { deferred.push(list[i]!); list.splice(i, 1); cut = true; break; }
    }
    if (!cut) throw new Error(`Can't order tables: ${stuck.join(", ")}`);
  }
  return { order, deferred };
}
