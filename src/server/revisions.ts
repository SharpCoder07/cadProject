import "server-only";
import type { Prisma } from "@prisma/client";
import type { Tx } from "@/server/db";
import { db } from "@/server/db";

export type RevisionEntity = "page" | "post" | "software" | "menu" | "faq";
const KEEP = 50;

/** Stores a snapshot inside the caller's transaction and prunes old versions. */
export async function recordRevision(
  tx: Tx,
  entityType: RevisionEntity,
  entityId: string,
  snapshot: Prisma.InputJsonValue,
  authorId: string | null,
  message?: string,
): Promise<number> {
  const last = await tx.revision.findFirst({ where: { entityType, entityId }, orderBy: { version: "desc" }, select: { version: true } });
  const version = (last?.version ?? 0) + 1;
  await tx.revision.create({ data: { entityType, entityId, version, snapshot, authorId, message } });
  if (version > KEEP) {
    await tx.revision.deleteMany({ where: { entityType, entityId, version: { lte: version - KEEP } } });
  }
  return version;
}

export const listRevisions = (entityType: RevisionEntity, entityId: string) =>
  db.revision.findMany({
    where: { entityType, entityId },
    orderBy: { version: "desc" },
    take: KEEP,
    select: { id: true, version: true, message: true, createdAt: true, author: { select: { name: true } } },
  });

export const getRevision = (id: string) => db.revision.findUnique({ where: { id } });
