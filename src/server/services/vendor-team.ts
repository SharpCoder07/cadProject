import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, forbidden, notFound } from "@/server/errors";
import { hashPassword, passwordProblems, verifyPassword } from "@/server/auth/password";
import { revokeUserSessions } from "@/server/auth/session";
import { enforce, RULES } from "@/server/rate-limit";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { PERMISSIONS, VENDOR_GRANTABLE, grantableFor, isVendorRoleKey, type Permission } from "@/server/rbac/permissions";
import { companyKind } from "./resellers";
import { inviteUser, requestPasswordReset, updateUser } from "./users";
import { openRequest } from "./approvals";
import { assertNoBlockedWords } from "@/server/moderation";
import { withBin } from "@/server/system/trash";
import { liftLoginBlocksFor } from "@/server/auth/login-guard";

/**
 * Vendor team and self-service account changes. Like every other vendor action they only
 * create approval requests; applyTeamRequest() runs when a Super Admin approves.
 */

type TeamPayload = { name?: string; email?: string; permissions?: Permission[]; avatarUrl?: string | null; mode?: "hash" | "reset"; hash?: string };

const asVendor = (user: Principal) => {
  if (!user.vendorId) throw forbidden("Only vendor-portal users submit these requests.");
  return user.vendorId;
};

/** Keeps only permissions a vendor may grant; portal access is always included. */
export function normaliseVendorPermissions(perms: string[]): Permission[] {
  const allowed = new Set<string>(VENDOR_GRANTABLE);
  const set = new Set<Permission>(perms.filter((p): p is Permission => allowed.has(p)));
  set.add("vendor.portal");
  return [...set].sort();
}

async function teammate(vendorId: string, id: string) {
  const u = await db.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, vendorId: true, status: true, role: { select: { key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } } } } });
  if (!u || u.vendorId !== vendorId) throw notFound("User");
  return { ...u, permissions: normaliseVendorPermissions(u.role.permissions.map((p) => p.permission.key)) };
}

/** Merges with an already pending “edit” for the same user so name, access and photo changes don't overwrite each other. */
async function pendingUpdatePayload(userId: string) {
  const r = await db.approvalRequest.findFirst({ where: { entityType: "VENDOR_USER", entityId: userId, status: "PENDING", action: "UPDATE" }, select: { payload: true, before: true } });
  return { payload: (r?.payload ?? {}) as TeamPayload, before: (r?.before ?? {}) as TeamPayload };
}

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/** Drops permissions that don't fit the company (e.g. product permissions for a reseller). */
async function fitToCompany(vendorId: string, perms: string[]) {
  const kind = await companyKind(vendorId);
  const allowed = new Set<string>(grantableFor(kind));
  return normaliseVendorPermissions(perms.filter((p) => allowed.has(p)));
}

// ─── Team management (vendor.team.manage) ────────────────────────────────────

export async function proposeTeamInvite(user: Principal, input: { name: string; email: string; permissions: string[] }, note?: string | null) {
  const vendorId = asVendor(user);
  assertCan(user, "vendor.team.manage", { vendorId });
  await assertNoBlockedWords({ name: input.name, note });
  const email = input.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw new AppError("Someone with that email already has an account.", "CONFLICT", { email: ["Already registered"] });
  const permissions = await fitToCompany(vendorId, input.permissions);
  await openRequest({ vendorId, requestedById: user.id, entityType: "VENDOR_USER", entityId: `invite:${email}`, entityLabel: `${input.name} (${email})`, action: "CREATE", payload: json({ name: input.name, email, permissions }), note });
  return { message: "Invitation sent to the Super Admin for approval" };
}

export async function proposeTeamAccess(user: Principal, targetId: string, input: { name: string; permissions: string[] }, note?: string | null) {
  const vendorId = asVendor(user);
  assertCan(user, "vendor.team.manage", { vendorId });
  await assertNoBlockedWords({ name: input.name, note });
  const t = await teammate(vendorId, targetId);
  const pending = await pendingUpdatePayload(targetId);
  const payload = { ...pending.payload, name: input.name, permissions: await fitToCompany(vendorId, input.permissions) };
  const before = { ...pending.before, name: t.name, permissions: t.permissions };
  await openRequest({ vendorId, requestedById: user.id, entityType: "VENDOR_USER", entityId: targetId, entityLabel: t.name, action: "UPDATE", payload: json(payload), before: json(before), note });
  return { message: "Access change sent for approval" };
}

export async function proposeTeamRemoval(user: Principal, targetId: string, note?: string | null) {
  const vendorId = asVendor(user);
  assertCan(user, "vendor.team.manage", { vendorId });
  if (targetId === user.id) throw new AppError("You can't remove yourself. Ask another admin of your company or the Super Admin.");
  const t = await teammate(vendorId, targetId);
  await openRequest({ vendorId, requestedById: user.id, entityType: "VENDOR_USER", entityId: targetId, entityLabel: t.name, action: "DELETE", before: json({ name: t.name, email: t.email, permissions: t.permissions }), note });
  return { message: "Removal sent for approval" };
}

export async function proposeTeamPasswordReset(user: Principal, targetId: string) {
  const vendorId = asVendor(user);
  assertCan(user, "vendor.team.manage", { vendorId });
  const t = await teammate(vendorId, targetId);
  if (t.status !== "ACTIVE") throw new AppError("Only active users can get a reset link. Invited users can use their invitation email.");
  await openRequest({ vendorId, requestedById: user.id, entityType: "VENDOR_USER", entityId: targetId, entityLabel: t.name, action: "PASSWORD", payload: { mode: "reset" } });
  return { message: "Password reset sent for approval. Once approved, they'll get a reset link by email." };
}

// ─── Own account (any vendor-portal user) ────────────────────────────────────

export async function proposeOwnProfile(user: Principal, input: { name?: string; avatarUrl?: string | null }) {
  const vendorId = asVendor(user);
  assertCan(user, "vendor.portal", { vendorId });
  await assertNoBlockedWords({ name: input.name });
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, avatarUrl: true } });
  const pending = await pendingUpdatePayload(user.id);
  const payload: TeamPayload = { ...pending.payload, ...input };
  const before: TeamPayload = { ...pending.before, ...("name" in input ? { name: me.name } : {}), ...("avatarUrl" in input ? { avatarUrl: me.avatarUrl } : {}) };
  await openRequest({ vendorId, requestedById: user.id, entityType: "VENDOR_USER", entityId: user.id, entityLabel: me.name, action: "UPDATE", payload: json(payload), before: json(before) });
  return { message: "Sent for approval. Your profile updates once the Super Admin approves it." };
}

/** The new password is checked now and stored only as a hash until approval. */
export async function proposeOwnPassword(user: Principal, input: { current: string; next: string }) {
  const vendorId = asVendor(user);
  await enforce(RULES.passwordChange, user.id, "Too many password attempts. Wait 15 minutes and try again.");
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, passwordHash: true } });
  if (!(await verifyPassword(me.passwordHash, input.current))) throw new AppError("Your current password is incorrect.");
  const problems = passwordProblems(input.next, { email: user.email, name: me.name });
  if (problems.length) throw new AppError(problems.join(" "));
  if (input.current === input.next) throw new AppError("Choose a password different from your current one.");
  await openRequest({ vendorId, requestedById: user.id, entityType: "VENDOR_USER", entityId: user.id, entityLabel: me.name, action: "PASSWORD", payload: { mode: "hash", hash: await hashPassword(input.next) } });
  return { message: "Password change sent for approval. Keep using your current password until it's approved." };
}

// ─── Applying approved requests (approver's authority) ───────────────────────

/** Finds the vendor role with exactly these permissions, or creates a custom one. */
export async function resolveVendorRole(perms: Permission[]) {
  const wanted = normaliseVendorPermissions(perms);
  const key = wanted.join(",");
  const roles = await db.role.findMany({ where: { key: { startsWith: "VENDOR" } }, select: { id: true, key: true, permissions: { select: { permission: { select: { key: true } } } } } });
  const match = roles.find((r) => isVendorRoleKey(r.key) && normaliseVendorPermissions(r.permissions.map((p) => p.permission.key)).join(",") === key);
  if (match) return match.id;
  const ids = await db.permission.findMany({ where: { key: { in: wanted } }, select: { id: true } });
  const roleKey = `VENDOR_CUSTOM_${createHash("sha256").update(key).digest("hex").slice(0, 8).toUpperCase()}`;
  const role = await db.role.upsert({
    where: { key: roleKey },
    create: {
      key: roleKey,
      name: `Vendor custom access (${wanted.length - 1} permission${wanted.length === 2 ? "" : "s"})`,
      description: wanted.map((p) => PERMISSIONS[p]).join("; ").slice(0, 500),
      isSystem: false,
      permissions: { create: ids.map((p) => ({ permissionId: p.id })) },
    },
    update: {},
  });
  return role.id;
}

export async function applyTeamRequest(approver: Principal, r: { action: string; entityId: string; vendorId: string; payload: Prisma.JsonValue }) {
  const p = (r.payload ?? {}) as TeamPayload;
  if (r.action === "CREATE") {
    if (!p.name || !p.email) throw new AppError("The invitation is missing a name or email.", "CONFLICT");
    const roleId = await resolveVendorRole(p.permissions ?? []);
    await inviteUser(approver, { name: p.name, email: p.email, roleId, vendorId: r.vendorId });
    return;
  }
  const target = await db.user.findUnique({ where: { id: r.entityId }, select: { id: true, name: true, email: true, vendorId: true } });
  if (!target || target.vendorId !== r.vendorId) throw new AppError("This user no longer belongs to the vendor.", "CONFLICT");

  if (r.action === "UPDATE") {
    if (p.permissions) {
      await updateUser(approver, target.id, { name: p.name ?? target.name, roleId: await resolveVendorRole(p.permissions), vendorId: r.vendorId });
    } else if (p.name && p.name !== target.name) {
      await db.user.update({ where: { id: target.id }, data: { name: p.name } });
    }
    if ("avatarUrl" in p) await db.user.update({ where: { id: target.id }, data: { avatarUrl: p.avatarUrl ?? null } });
    await audit({ actorId: approver.id, action: "user.vendor_update", entityType: "user", entityId: target.id, summary: `Approved changes for ${target.email}` });
    return;
  }
  if (r.action === "DELETE") {
    await revokeUserSessions(target.id);
    await withBin(approver, "User", [target.id], (tx) => tx.user.delete({ where: { id: target.id } }));
    await audit({ actorId: approver.id, action: "user.delete", entityType: "user", entityId: target.id, summary: `Removed vendor user ${target.email}` });
    return;
  }
  if (r.action === "PASSWORD") {
    if (p.mode === "hash" && p.hash) {
      await db.user.update({ where: { id: target.id }, data: { passwordHash: p.hash, failedLogins: 0, lockedUntil: null } });
      await liftLoginBlocksFor(target.id);
      await revokeUserSessions(target.id);
      await audit({ actorId: approver.id, action: "user.password_change", entityType: "user", entityId: target.id, summary: `Approved password change for ${target.email}` });
    } else {
      await requestPasswordReset(target.email);
      await audit({ actorId: approver.id, action: "user.password_reset", entityType: "user", entityId: target.id, summary: `Sent password reset to ${target.email}` });
    }
    return;
  }
  throw new AppError("Unknown request type.", "CONFLICT");
}
