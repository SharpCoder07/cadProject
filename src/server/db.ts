import "server-only";
import { Prisma, PrismaClient } from "@prisma/client";

/**
 * One Prisma client per process. In development the instance is kept on globalThis so hot reloads
 * don't open new connections — but if the schema changed (prisma generate added models), the old
 * instance is replaced, otherwise new tables would be missing until the dev server restarts.
 */
const signature = Object.keys(Prisma.ModelName).join(",");
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSignature?: string };

if (globalForPrisma.prisma && globalForPrisma.prismaSignature !== signature) {
  void globalForPrisma.prisma.$disconnect().catch(() => undefined);
  globalForPrisma.prisma = undefined;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.prismaSignature = signature;
}

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
