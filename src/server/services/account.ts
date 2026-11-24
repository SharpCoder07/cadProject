import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, forbidden } from "@/server/errors";
import { hashPassword, passwordProblems, verifyPassword } from "@/server/auth/password";
import { revokeUserSessions } from "@/server/auth/session";
import { enforce, RULES } from "@/server/rate-limit";
import type { Principal } from "@/server/rbac/policy";
import { storeImage } from "@/server/uploads";
import { assertNoBlockedWords } from "@/server/moderation";
import { requestPasswordReset } from "./users";
import { liftLoginBlocksFor } from "@/server/auth/login-guard";

/** Self-service: everything here acts only on the signed-in user's own account. */

/** Vendor-portal users change their name, photo and password through approval requests (vendor-team.ts). */
function staffOnly(me: Principal) {
  if (me.vendorId) throw forbidden("Account changes in the vendor portal need Super Admin approval.");
}

export async function getMyAccount(me: Principal) {
  const [user, sessions] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { name: true, email: true, avatarUrl: true, createdAt: true, lastLoginAt: true, passwordHash: true, role: { select: { name: true } }, vendor: { select: { name: true } } },
    }),
    db.session.findMany({
      where: { userId: me.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
      select: { id: true, createdAt: true, lastSeenAt: true, ipAddress: true, userAgent: true },
    }),
  ]);
  const { passwordHash, ...profile } = user;
  return { profile: { ...profile, hasPassword: Boolean(passwordHash) }, sessions };
}

export async function updateMyProfile(me: Principal, input: { name: string }) {
  staffOnly(me);
  await assertNoBlockedWords({ name: input.name });
  const before = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { name: true } });
  if (before.name === input.name) return;
  await db.user.update({ where: { id: me.id }, data: { name: input.name } });
  await audit({ actorId: me.id, action: "account.profile_update", entityType: "user", entityId: me.id, summary: `Name: ${before.name} → ${input.name}` });
}

/** Any signed-in user may set their own photo; it isn't added to the shared media library. */
export async function setMyAvatar(me: Principal, file: { buffer: Buffer; name: string } | null) {
  staffOnly(me);
  const url = file ? await storeImage(file.buffer, file.name, "avatars", 3) : null;
  await db.user.update({ where: { id: me.id }, data: { avatarUrl: url } });
  await audit({ actorId: me.id, action: "account.avatar", entityType: "user", entityId: me.id, summary: url ? "Profile photo updated" : "Profile photo removed" });
  return url;
}

/** Changes the password after checking the current one; signs out every other device. */
export async function changeMyPassword(me: Principal, input: { current: string; next: string }, keepSessionId: string | null) {
  staffOnly(me);
  await enforce(RULES.passwordChange, me.id, "Too many password attempts. Wait 15 minutes and try again.");
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(user.passwordHash, input.current))) throw new AppError("Your current password is incorrect.");
  const problems = passwordProblems(input.next, { email: me.email, name: me.name });
  if (problems.length) throw new AppError(problems.join(" "));
  if (input.current === input.next) throw new AppError("Choose a password different from your current one.");
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.next), failedLogins: 0, lockedUntil: null } });
  await liftLoginBlocksFor(me.id);
  await revokeUserSessions(me.id, keepSessionId ?? undefined);
  await audit({ actorId: me.id, action: "account.password_change", entityType: "user", entityId: me.id, summary: "Password changed; other devices signed out" });
}

export async function sendMyResetLink(me: Principal) {
  staffOnly(me);
  await enforce(RULES.passwordReset, `self:${me.id}`, "Too many reset links requested. Check your inbox or try again in an hour.");
  await requestPasswordReset(me.email);
}

export async function signOutMySession(me: Principal, sessionId: string) {
  const res = await db.session.updateMany({ where: { id: sessionId, userId: me.id, revokedAt: null }, data: { revokedAt: new Date() } });
  if (!res.count) throw new AppError("That device is already signed out.");
  await audit({ actorId: me.id, action: "session.revoke", entityType: "user", entityId: me.id });
}

export async function signOutMyOtherSessions(me: Principal, keepSessionId: string | null) {
  const res = await revokeUserSessions(me.id, keepSessionId ?? undefined);
  await audit({ actorId: me.id, action: "session.revoke_others", entityType: "user", entityId: me.id, summary: `${res.count} other ${res.count === 1 ? "device" : "devices"} signed out` });
  return res.count;
}
