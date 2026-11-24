import "server-only";
import type { UserStatus } from "@prisma/client";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { AppError, forbidden, isUniqueViolation, notFound } from "@/server/errors";
import { sendTemplate } from "@/server/email/config";
import { hashPassword, passwordProblems, verifyPassword } from "@/server/auth/password";
import { revokeUserSessions } from "@/server/auth/session";
import { randomToken, sha256 } from "@/server/auth/tokens";
import { ALL_PERMISSIONS, PERMISSIONS, SUPER_ONLY, VENDOR_MEDIA_PERMISSIONS, isVendorRoleKey, permissionGroup, type Permission } from "@/server/rbac/permissions";
import { assertCan, isSuperAdmin, type Principal } from "@/server/rbac/policy";
import { sendWelcome } from "@/server/email/welcome";
import { withBin } from "@/server/system/trash";
import { liftLoginBlocksFor } from "@/server/auth/login-guard";

const INVITE_TTL_MS = 7 * 86_400_000;
const RESET_TTL_MS = 60 * 60 * 1000;

const isSuper = (u: Principal) => u.roleKey === "SUPER_ADMIN";

async function guardTarget(actor: Principal, targetId: string) {
  const target = await db.user.findUnique({ where: { id: targetId }, include: { role: true } });
  if (!target) throw notFound("User");
  if (target.role.key === "SUPER_ADMIN" && !isSuper(actor)) throw new AppError("Only a Super Admin can change another Super Admin.", "FORBIDDEN");
  return target;
}

async function assertNotLastSuperAdmin(userId: string) {
  const supers = await db.user.count({ where: { role: { key: "SUPER_ADMIN" }, status: "ACTIVE", id: { not: userId } } });
  if (supers === 0) throw new AppError("There must always be at least one active Super Admin.", "CONFLICT");
}

export async function listUsers(actor: Principal, opts: { q?: string; roleId?: string; status?: UserStatus; page?: number }) {
  assertCan(actor, "users.view");
  const page = opts.page ?? 1;
  const where = {
    ...(opts.roleId ? { roleId: opts.roleId } : {}),
    ...(opts.status ? { status: opts.status } : {}),
    ...(opts.q ? { OR: [{ name: { contains: opts.q, mode: "insensitive" as const } }, { email: { contains: opts.q, mode: "insensitive" as const } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.user.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 25, take: 25,
      select: { id: true, name: true, email: true, status: true, lastLoginAt: true, createdAt: true, totpEnabledAt: true, role: { select: { name: true, key: true } }, vendor: { select: { name: true } }, _count: { select: { sessions: { where: { revokedAt: null, expiresAt: { gt: new Date() } } } } } },
    }),
    db.user.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / 25)) };
}

async function sendInvite(email: string, name: string, token: string) {
  const link = `${env.APP_URL}/invite/${token}`;
  const r = await sendTemplate("user_invite", email, { user_name: name, invite_link: link });
  return { link, delivered: r.delivered };
}

/** Reseller companies use the Reseller Admin role; vendor companies use the vendor roles. */
async function assertRoleFitsCompany(roleKey: string, vendorId: string | null | undefined) {
  if (!isVendorRoleKey(roleKey) || !vendorId) return;
  if (roleKey.startsWith("VENDOR_CUSTOM")) return;
  const company = await db.vendor.findUnique({ where: { id: vendorId }, select: { kind: true, name: true } });
  if (!company) throw new AppError("Choose the company this user belongs to.", "BAD_REQUEST", { vendorId: ["Not found"] });
  if (company.kind === "RESELLER" && roleKey !== "VENDOR_RESELLER") throw new AppError(`${company.name} is a reseller. Give its users the Reseller Admin role.`, "BAD_REQUEST", { roleId: ["Use Reseller Admin for reseller users"] });
  if (company.kind === "VENDOR" && roleKey === "VENDOR_RESELLER") throw new AppError(`${company.name} is a software vendor. Reseller Admin is only for reseller companies.`, "BAD_REQUEST", { roleId: ["Use a vendor role for vendor users"] });
}

export async function inviteUser(actor: Principal, input: { name: string; email: string; roleId: string; vendorId?: string | null }) {
  assertCan(actor, "users.manage");
  // Giving someone a role gives them its permissions: only the Super Admin assigns, changes or revokes them.
  if (!isSuperAdmin(actor)) throw forbidden("Only the Super Admin can give people a role. Ask them to add this user.");
  const role = await db.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new AppError("Choose a role.");
  if (role.key === "SUPER_ADMIN" && !isSuper(actor)) throw new AppError("Only a Super Admin can invite Super Admins.", "FORBIDDEN");
  if (isVendorRoleKey(role.key) && !input.vendorId) throw new AppError("Choose the vendor this user belongs to.", "BAD_REQUEST", { vendorId: ["Required for vendor users"] });
  await assertRoleFitsCompany(role.key, input.vendorId);
  const token = randomToken();
  try {
    const user = await db.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { name: input.name, email: input.email.toLowerCase(), roleId: role.id, status: "INVITED", vendorId: isVendorRoleKey(role.key) ? input.vendorId : null } });
      await tx.authToken.create({ data: { userId: u.id, type: "INVITE", tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) } });
      await audit({ actorId: actor.id, action: "user.invite", entityType: "user", entityId: u.id, summary: `Invited ${u.email} as ${role.name}` }, tx);
      return u;
    });
    const sent = await sendInvite(user.email, user.name, token);
    // The link is returned so an admin can share it manually when the email wasn't delivered.
    return { user, inviteLink: sent.delivered ? null : sent.link };
  } catch (e) {
    if (isUniqueViolation(e, "email")) throw new AppError("A user with that email already exists.", "CONFLICT", { email: ["Already registered"] });
    throw e;
  }
}

/**
 * Creates an account with a password the admin sets (instead of an invite), to share with the person
 * securely. Same rules as inviting; the password must meet the password rule. With `mustChange` (the
 * default) they choose their own password right after their first sign-in. Two-step verification is
 * still set up at the first sign-in (staff and vendor accounts). The password is never stored or logged
 * in plain text.
 */
export async function createUserWithPassword(actor: Principal, input: { name: string; email: string; roleId: string; vendorId?: string | null; password: string; mustChange: boolean }) {
  assertCan(actor, "users.manage");
  // Giving someone a role gives them its permissions: only the Super Admin assigns, changes or revokes them.
  if (!isSuperAdmin(actor)) throw forbidden("Only the Super Admin can give people a role. Ask them to add this user.");
  const role = await db.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new AppError("Choose a role.");
  if (role.key === "SUPER_ADMIN" && !isSuper(actor)) throw new AppError("Only a Super Admin can create Super Admins.", "FORBIDDEN");
  if (isVendorRoleKey(role.key) && !input.vendorId) throw new AppError("Choose the vendor this user belongs to.", "BAD_REQUEST", { vendorId: ["Required for vendor users"] });
  await assertRoleFitsCompany(role.key, input.vendorId);
  const problems = passwordProblems(input.password, { email: input.email, name: input.name });
  if (problems.length) throw new AppError("Choose a stronger password.", "BAD_REQUEST", { password: problems });
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { name: input.name, email: input.email.toLowerCase(), roleId: role.id, status: "ACTIVE", passwordHash, mustChangePassword: input.mustChange, vendorId: isVendorRoleKey(role.key) ? input.vendorId : null } as never,
      });
      await audit({ actorId: actor.id, action: "user.create", entityType: "user", entityId: u.id, summary: `Created ${u.email} as ${role.name} with a password set by an admin${input.mustChange ? " (must change it at first sign-in)" : ""}` }, tx);
      return u;
    });
  } catch (e) {
    if (isUniqueViolation(e, "email")) throw new AppError("A user with that email already exists.", "CONFLICT", { email: ["Already registered"] });
    throw e;
  }
}

/** After signing in to an account created with an admin's password: the person sets their own. */
export async function setFirstOwnPassword(me: Principal, password: string, keepSessionId?: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true, email: true, name: true } });
  if (!me.mustChangePassword) throw new AppError("Your password is already your own. Change it in My account.");
  const problems = passwordProblems(password, { email: user.email, name: user.name });
  if (problems.length) throw new AppError("Choose a stronger password.", "BAD_REQUEST", { password: problems });
  if (await verifyPassword(user.passwordHash, password)) throw new AppError("Choose a password different from the one you were given.", "BAD_REQUEST", { password: ["That's the password you were given."] });
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(password), mustChangePassword: false } as never });
  await db.session.updateMany({ where: { userId: me.id, revokedAt: null, ...(keepSessionId ? { NOT: { id: keepSessionId } } : {}) }, data: { revokedAt: new Date() } });
  await audit({ actorId: me.id, action: "account.password_change", entityType: "user", entityId: me.id, summary: "Set their own password after the first sign-in" });
}

export async function updateUser(actor: Principal, id: string, input: { name: string; roleId: string; vendorId?: string | null }) {
  assertCan(actor, "users.manage");
  const target = await guardTarget(actor, id);
  const role = await db.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new AppError("Choose a role.");
  if (role.key === "SUPER_ADMIN" && !isSuper(actor)) throw new AppError("Only a Super Admin can grant Super Admin.", "FORBIDDEN");
  if (target.role.key === "SUPER_ADMIN" && role.key !== "SUPER_ADMIN") await assertNotLastSuperAdmin(id);
  if (actor.id === id && role.id !== target.roleId) throw new AppError("You can't change your own role.");
  if (role.id !== target.roleId && !isSuperAdmin(actor)) throw forbidden("Only the Super Admin can change someone's role (and so their permissions).");
  await assertRoleFitsCompany(role.key, input.vendorId ?? target.vendorId);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { name: input.name, roleId: role.id, vendorId: isVendorRoleKey(role.key) ? input.vendorId ?? target.vendorId : null } });
    if (role.id !== target.roleId) {
      await audit({ actorId: actor.id, action: "user.role_change", entityType: "user", entityId: id, summary: `${target.email}: ${target.role.name} → ${role.name}` }, tx);
    }
  });
  if (role.id !== target.roleId) await revokeUserSessions(id); // new permissions apply on next sign-in
}

export async function setUserStatus(actor: Principal, id: string, status: "ACTIVE" | "SUSPENDED") {
  assertCan(actor, "users.manage");
  if (actor.id === id) throw new AppError("You can't change your own account status.");
  const target = await guardTarget(actor, id);
  if (target.status === "INVITED" && status === "ACTIVE") throw new AppError("Invited users become active when they accept the invite.");
  if (status === "SUSPENDED" && target.role.key === "SUPER_ADMIN") await assertNotLastSuperAdmin(id);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { status, ...(status === "ACTIVE" ? { failedLogins: 0, lockedUntil: null } : {}) } });
    await audit({ actorId: actor.id, action: `user.${status === "ACTIVE" ? "reactivate" : "suspend"}`, entityType: "user", entityId: id, summary: target.email }, tx);
  });
  if (status === "SUSPENDED") await revokeUserSessions(id);
  else await liftLoginBlocksFor(id);
}

export async function resendInvite(actor: Principal, id: string) {
  assertCan(actor, "users.manage");
  const target = await guardTarget(actor, id);
  if (target.status !== "INVITED") throw new AppError("This user has already accepted their invite.");
  const token = randomToken();
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId: id, type: "INVITE" } }),
    db.authToken.create({ data: { userId: id, type: "INVITE", tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_TTL_MS) } }),
  ]);
  const sent = await sendInvite(target.email, target.name, token);
  return sent.delivered ? null : sent.link;
}

export async function listSessions(actor: Principal, userId: string) {
  if (actor.id !== userId) assertCan(actor, "users.view");
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, createdAt: true, lastSeenAt: true, ipAddress: true, userAgent: true, expiresAt: true },
  });
}

export async function revokeSession(actor: Principal, sessionId: string) {
  const session = await db.session.findUnique({ where: { id: sessionId } });
  if (!session) throw notFound("Session");
  if (session.userId !== actor.id) {
    assertCan(actor, "users.manage");
    await guardTarget(actor, session.userId);
  }
  await db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  await audit({ actorId: actor.id, action: "session.revoke", entityType: "user", entityId: session.userId });
}

export async function revokeAllSessions(actor: Principal, userId: string) {
  assertCan(actor, "users.manage");
  await guardTarget(actor, userId);
  await revokeUserSessions(userId);
  await audit({ actorId: actor.id, action: "session.revoke_all", entityType: "user", entityId: userId });
}

// ─── Password reset & invite acceptance (public, token-based) ──────────────

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  // Same response whether or not the account exists (no enumeration).
  if (!user || user.status !== "ACTIVE") return;
  const token = randomToken();
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId: user.id, type: "PASSWORD_RESET" } }),
    db.authToken.create({ data: { userId: user.id, type: "PASSWORD_RESET", tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } }),
  ]);
  await sendTemplate("password_reset", user.email, { user_name: user.name, reset_link: `${env.APP_URL}/reset-password/${token}` }).catch((e) => console.error("[auth] reset email failed", e));
}

async function consumeToken(token: string, type: "PASSWORD_RESET" | "INVITE") {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.type !== type || row.consumedAt || row.expiresAt < new Date()) return null;
  return row;
}

export async function validateToken(token: string, type: "PASSWORD_RESET" | "INVITE") {
  const row = await consumeToken(token, type);
  return row ? { email: row.user.email, name: row.user.name } : null;
}

export async function completeToken(token: string, type: "PASSWORD_RESET" | "INVITE", password: string) {
  const row = await consumeToken(token, type);
  if (!row) throw new AppError("This link has expired or was already used. Ask for a new one.");
  const problems = passwordProblems(password, { email: row.user.email, name: row.user.name });
  if (problems.length) throw new AppError("Choose a stronger password.", "BAD_REQUEST", { password: problems });
  // A reset must choose a new password, not the one it replaces.
  if (type === "PASSWORD_RESET" && row.user.passwordHash && (await verifyPassword(row.user.passwordHash, password))) {
    throw new AppError("Choose a password different from your current one.", "BAD_REQUEST", { password: ["That's your current password."] });
  }
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    await tx.authToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null, ...(type === "INVITE" ? { status: "ACTIVE" } : {}) } });
    await tx.session.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ actorId: row.userId, action: type === "INVITE" ? "user.invite_accepted" : "auth.password_reset", entityType: "user", entityId: row.userId }, tx);
  });
  await liftLoginBlocksFor(row.userId);
  if (type === "INVITE" && row.user.status === "INVITED") void sendWelcome(row.userId);
  return row.userId;
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export async function listRoles(actor: Principal) {
  if (!isSuperAdmin(actor)) assertCan(actor, "users.view");
  return db.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } } });
}

export async function saveRole(actor: Principal, id: string | null, input: { name: string; key: string; description: string | null; permissions: string[] }) {
  // Only the Super Admin assigns, changes or revokes permissions.
  if (!isSuperAdmin(actor)) throw forbidden("Only the Super Admin can change roles and permissions.");
  const perms = input.permissions.filter((p): p is Permission => (ALL_PERMISSIONS as string[]).includes(p) && !SUPER_ONLY.includes(p as Permission));
  const existing = id ? await db.role.findUnique({ where: { id } }) : null;
  if (id && !existing) throw notFound("Role");
  if (existing?.key === "SUPER_ADMIN") throw new AppError("The Super Admin role always has every permission.");
  const mixesVendor = perms.some((p) => p.startsWith("vendor.")) && perms.some((p) => !p.startsWith("vendor.") && !VENDOR_MEDIA_PERMISSIONS.includes(p));
  if (mixesVendor) throw new AppError("Vendor-portal permissions can't be combined with staff permissions in one role.");
  if (perms.some((p) => p.startsWith("buyer.")) && perms.some((p) => !p.startsWith("buyer."))) throw new AppError("The buyer permission can't be combined with other permissions in one role.");
  try {
    const role = await db.$transaction(async (tx) => {
      const r = existing
        ? await tx.role.update({ where: { id: existing.id }, data: { name: input.name, description: input.description } })
        : await tx.role.create({ data: { name: input.name, key: input.key.toUpperCase(), description: input.description } });
      await tx.rolePermission.deleteMany({ where: { roleId: r.id } });
      // Permissions added to the catalogue since the last seed (e.g. "Edit on the website") get their row here.
      await tx.permission.createMany({ data: perms.map((key) => ({ key, group: permissionGroup(key), description: PERMISSIONS[key] })), skipDuplicates: true });
      const rows = await tx.permission.findMany({ where: { key: { in: perms } }, select: { id: true } });
      if (rows.length) await tx.rolePermission.createMany({ data: rows.map((p) => ({ roleId: r.id, permissionId: p.id })) });
      await audit({ actorId: actor.id, action: existing ? "role.update" : "role.create", entityType: "role", entityId: r.id, summary: `${r.name}: ${perms.length} permission(s)`, diff: { permissions: perms } }, tx);
      return r;
    });
    // Permissions are loaded per request, so changes apply immediately; no session revocation needed.
    return role;
  } catch (e) {
    if (isUniqueViolation(e, "key")) throw new AppError("A role with that key exists.", "CONFLICT", { key: ["Already in use"] });
    throw e;
  }
}

export async function deleteRole(actor: Principal, id: string) {
  if (!isSuperAdmin(actor)) throw forbidden("Only the Super Admin can delete roles.");
  const role = await db.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) throw notFound("Role");
  if (role.isSystem) throw new AppError("Built-in roles can't be deleted.");
  if (role._count.users) throw new AppError(`Move this role's ${role._count.users} user(s) to another role first.`, "CONFLICT");
  await withBin(actor, "Role", [id], (tx) => tx.role.delete({ where: { id } }));
  await audit({ actorId: actor.id, action: "role.delete", entityType: "role", entityId: id, summary: role.name });
}
