import "server-only";
import type { Prisma } from "@prisma/client";
import { db, type Tx } from "@/server/db";
import { getRequestMeta } from "@/server/request";

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string;
  diff?: Prisma.InputJsonValue;
  /** staff (default) | vendor | buyer | public | system */
  actorType?: "staff" | "vendor" | "buyer" | "public" | "system";
  /** success (default) | failure | denied */
  result?: "success" | "failure" | "denied";
  /** Extra context. Never passwords, tokens or personal data that isn't needed. */
  metadata?: Prisma.InputJsonValue;
}

/** Records a sensitive admin action. Pass `tx` to make it atomic with the change itself. */
export async function audit(entry: AuditEntry, tx: Tx | typeof db = db): Promise<void> {
  const meta = await getRequestMeta().catch(() => ({ ip: null, userAgent: null }));
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      summary: entry.summary,
      diff: entry.diff,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      ...(entry.actorType ? { actorType: entry.actorType } : entry.actorId === null ? { actorType: "system" } : {}),
      ...(entry.result ? { result: entry.result } : {}),
      ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
    },
  });
}

/**
 * Records that someone opened personal data (a privacy record, a request, an unmasked field…), as the
 * compliance module requires. Call it on every view of sensitive personal information.
 */
export function auditAccess(actorId: string, entityType: string, entityId: string, summary: string, metadata?: Prisma.InputJsonValue) {
  return audit({ actorId, action: "privacy.record_view", entityType, entityId, summary, metadata });
}

/** Shallow diff of two plain objects, for audit payloads. */
export function shallowDiff(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = { from: a ?? null, to: b ?? null };
  }
  return out;
}
