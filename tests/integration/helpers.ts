import { db } from "@/server/db";
import { SYSTEM_ROLES, permissionGroup, PERMISSIONS, type Permission, type SystemRoleKey } from "@/server/rbac/permissions";
import type { Principal } from "@/server/rbac/policy";

/** Empties every table (fast, keeps the schema). Integration tests run serially. */
export async function resetDb() {
  if (!/test/i.test(new URL(process.env.DATABASE_URL ?? "").pathname)) throw new Error("Refusing to truncate a database whose name doesn't contain 'test'.");
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  for (const key of Object.keys(PERMISSIONS) as Permission[]) await db.permission.create({ data: { key, group: permissionGroup(key) } });
  const perms = new Map((await db.permission.findMany()).map((p) => [p.key, p.id]));
  for (const [key, def] of Object.entries(SYSTEM_ROLES)) {
    await db.role.create({ data: { key, name: def.name, isSystem: true, permissions: { create: def.permissions.map((p) => ({ permissionId: perms.get(p)! })) } } });
  }
}

let n = 0;
/** Creates a user with a system role and returns it as a Principal. */
export async function makeUser(roleKey: SystemRoleKey, vendorId: string | null = null): Promise<Principal> {
  const role = await db.role.findUniqueOrThrow({ where: { key: roleKey } });
  const u = await db.user.create({ data: { email: `u${++n}-${roleKey.toLowerCase()}@test.local`, name: `${roleKey} user`, roleId: role.id, vendorId } });
  return { id: u.id, email: u.email, name: u.name, roleKey, vendorId, permissions: new Set(SYSTEM_ROLES[roleKey].permissions) };
}

export const makeVendor = (slug: string, extra: { canPublish?: boolean } = {}) =>
  db.vendor.create({ data: { name: slug.toUpperCase(), slug, verification: extra.canPublish ? "VERIFIED" : "UNVERIFIED", canPublish: extra.canPublish ?? false } });

export const makeCategory = (slug: string, parentId: string | null = null, depth = 0, path = "/") =>
  db.category.create({ data: { name: slug, slug, parentId, depth, path } });
