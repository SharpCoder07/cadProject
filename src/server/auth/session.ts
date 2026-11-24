import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import { env, isProd } from "@/server/env";
import { getRequestMeta } from "@/server/request";
import { SUPER_ONLY, VIEW_ONLY, VIEW_ONLY_MESSAGE, expandPermissions, isBuyerRoleKey, superAdminPermissions, viewOnlyPermissions, type Permission } from "@/server/rbac/permissions";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { randomToken, sha256 } from "./tokens";

/**
 * What a role can do. The Super Admin always has every staff permission (whatever is saved on the role, so
 * permissions added later apply at once). Anyone else gets what the role grants plus what it implies (any
 * action on a module lets you view it), never a Super-Admin-only permission (roles, deletion approvals,
 * recycle bin, backups) and never a Delete that wasn't granted on its own.
 */
function withSystem(roleKey: string, perms: Permission[]): Set<Permission> {
  if (roleKey === "SUPER_ADMIN") return new Set(superAdminPermissions());
  const set = expandPermissions(perms);
  for (const p of SUPER_ONLY) set.delete(p);
  return set;
}

export const SESSION_COOKIE = isProd ? "__Host-cg_session" : "cg_session";
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const meta = await getRequestMeta();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);
  await db.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, ipAddress: meta.ip, userAgent: meta.userAgent },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", expires: expiresAt });
  // Resellers use /reseller/… addresses for the shared partner portal (middleware rewrites them to /vendor/…).
  const company = await db.user.findUnique({ where: { id: userId }, select: { vendorId: true, role: { select: { key: true } }, vendor: { select: { kind: true } } } });
  if (company?.vendor?.kind === "RESELLER") jar.set(PORTAL_COOKIE, "reseller", { httpOnly: false, secure: isProd, sameSite: "lax", path: "/", expires: expiresAt });
  else jar.delete(PORTAL_COOKIE);
  // Staff: lets the website show the "Edit page" button without asking the server on every visit.
  if (company && !company.vendorId && company.role.key !== "BUYER") jar.set(EDITOR_HINT_COOKIE, "1", { httpOnly: false, secure: isProd, sameSite: "lax", path: "/", expires: expiresAt });
  else jar.delete(EDITOR_HINT_COOKIE);
}

/** Only a hint for the website's edit mode (staff signed in); every edit is checked on the server. */
export const EDITOR_HINT_COOKIE = "cg_staff";

/** "reseller" for reseller-portal users, so /vendor/… links are shown as /reseller/…. Not a security boundary. */
export const PORTAL_COOKIE = "cg_portal";

/** Loads the principal for the current request. Memoized per request. */
export const getCurrentUser = cache(async (): Promise<Principal | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
    },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  const { user } = session;
  if (user.status !== "ACTIVE") return null;
  // Two-step verification is required for staff and vendor accounts: their sessions don't count without an
  // authenticator (e.g. after an admin reset). Buyers can turn it on, but don't have to.
  if ((!user.totpSecretEnc || !user.totpEnabledAt) && !isBuyerRoleKey(user.role.key)) return null;

  if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }

  const keys = user.role.permissions.map((rp) => rp.permission.key as Permission);
  // View-only (demo) role: sees what a full staff account sees, but changes are refused (see action()).
  const readOnly = keys.includes(VIEW_ONLY) && user.role.key !== "SUPER_ADMIN" && !user.vendorId;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roleKey: user.role.key,
    vendorId: user.vendorId,
    permissions: readOnly ? new Set<Permission>([...viewOnlyPermissions(), VIEW_ONLY]) : withSystem(user.role.key, keys),
    readOnly,
    mustChangePassword: Boolean((user as { mustChangePassword?: boolean }).mustChangePassword),
  };
});

/** For pages/layouts: redirects to login when signed out. */
export async function requireUser(nextPath?: string): Promise<Principal> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${nextPath ? `?next=${encodeURIComponent(nextPath)}` : ""}`);
  // Account created by an admin with a password: choose your own first.
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

/** For pages: redirects to login when signed out, renders 403 page when not permitted. */
export async function requirePermission(permission: Permission, nextPath?: string): Promise<Principal> {
  const user = await requireUser(nextPath);
  if (!can(user, permission)) redirect("/admin/forbidden");
  return user;
}

/** For server actions and route handlers: throws AppError instead of redirecting. */
export async function authorize(permission: Permission): Promise<Principal> {
  const user = await getCurrentUser();
  assertCan(user, permission);
  return user;
}

/** For route handlers that change data: refuses view-only (demo) accounts. */
export async function assertCanWrite(): Promise<void> {
  const user = await getCurrentUser();
  if (user?.readOnly) throw new AppError(VIEW_ONLY_MESSAGE, "FORBIDDEN");
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  jar.delete(SESSION_COOKIE);
  jar.delete(EDITOR_HINT_COOKIE);
}

/** Id of the session behind the current request's cookie, if any. */
export async function currentSessionId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha256(token) }, select: { id: true } });
  return s?.id ?? null;
}

export const revokeUserSessions = (userId: string, exceptSessionId?: string) =>
  db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
    data: { revokedAt: new Date() },
  });
