import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { decryptSecret, encryptSecret } from "@/server/crypto";
import { env, isProd } from "@/server/env";
import { AppError, forbidden, notFound } from "@/server/errors";
import { hit, RULES } from "@/server/rate-limit";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { homeFor, isBuyerRoleKey } from "@/server/rbac/permissions";
import { getSettings } from "@/server/settings";
import { qrDataUrl } from "@/lib/qr";
import { createSession } from "./session";
import { randomToken, sha256 } from "./tokens";
import {
  formatSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  looksLikeBackupCode,
  otpauthUrl,
  verifyTotp,
} from "./totp";

/**
 * Two-step verification with an authenticator app (TOTP). Required for every account:
 * a password only opens a 10-minute challenge, and a session is created once the code checks out.
 * Accounts without an authenticator set one up during that challenge.
 */

export const CHALLENGE_COOKIE = isProd ? "__Host-cg_2fa" : "cg_2fa";
const CHALLENGE_MINUTES = 10;

export interface AuthenticatorSetup {
  secret: string;
  formattedSecret: string;
  otpauthUrl: string;
  qr: string;
  issuer: string;
  account: string;
}

const isEnrolled = (u: { totpSecretEnc: string | null; totpEnabledAt: Date | null }) => Boolean(u.totpSecretEnc && u.totpEnabledAt);

async function buildSetup(email: string, secret: string): Promise<AuthenticatorSetup> {
  const issuer = (await getSettings()).site.name || env.APP_URL.replace(/^https?:\/\//, "");
  const url = otpauthUrl({ issuer, account: email, secret });
  return { secret, formattedSecret: formatSecret(secret), otpauthUrl: url, qr: qrDataUrl(url, { margin: 4 }), issuer, account: email };
}

/** Returns the pending secret, creating one if there isn't a readable one yet. */
async function ensurePendingSecret(user: { id: string; totpPendingEnc: string | null }): Promise<string> {
  const existing = user.totpPendingEnc ? decryptSecret(user.totpPendingEnc) : null;
  if (existing) return existing;
  // The setup page can be rendered by two requests at once (redirect + router fetch). Only the first
  // write wins and everyone reads back the stored value, so the QR shown always matches the saved secret.
  const secret = generateTotpSecret();
  await db.user.updateMany({ where: { id: user.id, totpPendingEnc: user.totpPendingEnc }, data: { totpPendingEnc: encryptSecret(secret) } });
  const fresh = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpPendingEnc: true } });
  return (fresh.totpPendingEnc ? decryptSecret(fresh.totpPendingEnc) : null) ?? secret;
}

// ─── Sign-in challenge ───────────────────────────────────────────────────────

/** Called once the password is accepted. */
export async function startChallenge(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + CHALLENGE_MINUTES * 60_000);
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId, type: "TWO_FACTOR" } }),
    db.authToken.create({ data: { tokenHash: sha256(token), type: "TWO_FACTOR", userId, expiresAt } }),
  ]);
  (await cookies()).set(CHALLENGE_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", expires: expiresAt });
}

async function challengeRow() {
  const token = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!token) return null;
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.type !== "TWO_FACTOR" || row.consumedAt || row.expiresAt < new Date() || row.user.status !== "ACTIVE") return null;
  return row;
}

export type Challenge =
  | { kind: "verify"; email: string; name: string; backupLeft: number; expiresAt: Date }
  | { kind: "setup"; email: string; name: string; setup: AuthenticatorSetup; expiresAt: Date };

/** What the /login/verify page should show, or null when there's no live challenge. */
export async function getChallenge(): Promise<Challenge | null> {
  const row = await challengeRow();
  if (!row) return null;
  const { user } = row;
  if (isEnrolled(user)) return { kind: "verify", email: user.email, name: user.name, backupLeft: user.backupCodeHashes.length, expiresAt: row.expiresAt };
  const secret = await ensurePendingSecret(user);
  return { kind: "setup", email: user.email, name: user.name, setup: await buildSetup(user.email, secret), expiresAt: row.expiresAt };
}

export async function cancelChallenge(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE_COOKIE)?.value;
  if (token) await db.authToken.updateMany({ where: { tokenHash: sha256(token), consumedAt: null }, data: { consumedAt: new Date() } });
  jar.delete(CHALLENGE_COOKIE);
}

/**
 * Checks a 6-digit code (or, where allowed, a backup code) for a user.
 * `which` picks the active authenticator or the one being set up.
 */
async function checkCode(userId: string, code: string, opts: { which: "active" | "pending"; allowBackup: boolean }): Promise<{ method: "app" | "backup"; step: number | null; backupLeft: number }> {
  // 6 code checks per person every 15 minutes, right or wrong.
  const quota = await hit(RULES.twoFactor, userId);
  if (!quota.ok) {
    const at = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", timeStyle: "short" }).format(quota.resetAt);
    throw new AppError(`Too many verification codes tried. You can try again after ${at} IST.`, "RATE_LIMITED");
  }
  const attemptsLeft = quota.remaining ? ` You have ${quota.remaining} attempt${quota.remaining === 1 ? "" : "s"} remaining.` : " No attempts left; wait 15 minutes before trying again.";
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

  if (opts.allowBackup && looksLikeBackupCode(code)) {
    const hash = hashBackupCode(user.id, code);
    if (!user.backupCodeHashes.includes(hash)) {
      await audit({ actorId: user.id, action: "auth.2fa_failed", entityType: "user", entityId: user.id, summary: "Invalid backup code" });
      throw new AppError("That backup code isn't valid or has already been used." + attemptsLeft);
    }
    const left = user.backupCodeHashes.filter((h) => h !== hash);
    // Conditional update so the same code can't be spent twice by parallel requests.
    const res = await db.user.updateMany({ where: { id: user.id, backupCodeHashes: { has: hash } }, data: { backupCodeHashes: left } });
    if (!res.count) throw new AppError("That backup code has already been used.");
    return { method: "backup", step: null, backupLeft: left.length };
  }

  const stored = opts.which === "active" ? user.totpSecretEnc : user.totpPendingEnc;
  if (!stored) throw new AppError(opts.which === "active" ? "Two-step verification isn't set up on this account." : "Start the set-up again — no new authenticator is waiting to be confirmed.");
  const secret = decryptSecret(stored);
  if (!secret) {
    throw new AppError(
      opts.which === "active"
        ? "Your authenticator can't be checked because the server's secret key changed. Use a backup code, or ask an administrator to reset two-step verification."
        : "Start the set-up again — the server's secret key changed.",
    );
  }
  const step = verifyTotp(secret, code, { afterStep: opts.which === "active" ? user.totpLastStep : null });
  if (step === null) {
    await audit({ actorId: user.id, action: "auth.2fa_failed", entityType: "user", entityId: user.id, summary: opts.which === "pending" ? "Wrong code while setting up" : "Wrong code" });
    throw new AppError("That code didn't work. Enter the newest code from your app, and check your phone's time is set automatically." + attemptsLeft);
  }
  if (opts.which === "active") {
    // Conditional on the previous step so a code can't be replayed by a parallel request.
    const res = await db.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step } });
    if (!res.count) throw new AppError("That code was already used. Wait for the next one.");
  }
  return { method: "app", step, backupLeft: user.backupCodeHashes.length };
}

/** Moves the pending authenticator into place. Returns fresh backup codes when asked. */
async function activatePending(userId: string, step: number, withNewBackupCodes: boolean): Promise<string[] | null> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { totpPendingEnc: true } });
  if (!user.totpPendingEnc) throw new AppError("Start the set-up again.");
  const codes = withNewBackupCodes ? generateBackupCodes() : null;
  await db.user.update({
    where: { id: userId },
    data: {
      totpSecretEnc: user.totpPendingEnc,
      totpPendingEnc: null,
      totpEnabledAt: new Date(),
      totpLastStep: step,
      ...(codes ? { backupCodeHashes: codes.map((c) => hashBackupCode(userId, c)) } : {}),
    },
  });
  return codes;
}

/** Finishes sign-in. Returns backup codes when the authenticator was just set up. */
export async function completeChallenge(code: string): Promise<{ home: string; backupCodes: string[] | null; backupLeft: number | null }> {
  const row = await challengeRow();
  if (!row) throw new AppError("Your sign-in has expired. Enter your email and password again.", "UNAUTHENTICATED");
  const { user } = row;

  let backupCodes: string[] | null = null;
  let summary: string;
  let backupLeft: number | null = null;
  if (isEnrolled(user)) {
    const res = await checkCode(user.id, code, { which: "active", allowBackup: true });
    summary = res.method === "backup" ? `With a backup code (${res.backupLeft} left)` : "With authenticator app";
    if (res.method === "backup") backupLeft = res.backupLeft;
  } else {
    const res = await checkCode(user.id, code, { which: "pending", allowBackup: false });
    backupCodes = await activatePending(user.id, res.step!, true);
    await audit({ actorId: user.id, action: "auth.2fa_enabled", entityType: "user", entityId: user.id, summary: "Authenticator app set up at sign-in" });
    summary = "Authenticator app set up";
  }

  await db.authToken.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  (await cookies()).delete(CHALLENGE_COOKIE);
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await createSession(user.id);
  await audit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id, summary });
  const role = await db.role.findUnique({ where: { id: user.roleId }, select: { key: true } });
  return { home: homeFor(role?.key ?? "", user.vendorId), backupCodes, backupLeft };
}

// ─── My account ──────────────────────────────────────────────────────────────

export async function getMyTwoFactor(me: Principal) {
  const u = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { totpEnabledAt: true, totpSecretEnc: true, totpPendingEnc: true, backupCodeHashes: true } });
  return { enabledAt: u.totpEnabledAt, backupLeft: u.backupCodeHashes.length, changing: Boolean(u.totpPendingEnc && u.totpSecretEnc), readable: Boolean(u.totpSecretEnc && decryptSecret(u.totpSecretEnc)) };
}

export async function regenerateBackupCodes(me: Principal, code: string): Promise<string[]> {
  await checkCode(me.id, code, { which: "active", allowBackup: true });
  const codes = generateBackupCodes();
  await db.user.update({ where: { id: me.id }, data: { backupCodeHashes: codes.map((c) => hashBackupCode(me.id, c)) } });
  await audit({ actorId: me.id, action: "auth.2fa_backup_codes", entityType: "user", entityId: me.id, summary: "New backup codes generated; old ones no longer work" });
  return codes;
}

/** Step 1 of moving to a new phone: prove you hold the current authenticator, get a new QR code. */
export async function startAuthenticatorChange(me: Principal, code: string): Promise<AuthenticatorSetup> {
  await checkCode(me.id, code, { which: "active", allowBackup: true });
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: me.id }, data: { totpPendingEnc: encryptSecret(secret) } });
  return buildSetup(me.email, secret);
}

/** Step 2: a code from the new app confirms it; the old app stops working. */
export async function confirmAuthenticatorChange(me: Principal, code: string, keepSessionId: string | null): Promise<void> {
  const res = await checkCode(me.id, code, { which: "pending", allowBackup: false });
  await activatePending(me.id, res.step!, false);
  await db.session.updateMany({ where: { userId: me.id, revokedAt: null, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) }, data: { revokedAt: new Date() } });
  await audit({ actorId: me.id, action: "auth.2fa_changed", entityType: "user", entityId: me.id, summary: "Moved to a new authenticator app; other devices signed out" });
}

export async function cancelAuthenticatorChange(me: Principal): Promise<void> {
  await db.user.update({ where: { id: me.id }, data: { totpPendingEnc: null } });
}

// ─── Optional two-step verification (buyer accounts) ────────────────────────

function assertOptional(me: Principal) {
  if (!isBuyerRoleKey(me.roleKey)) throw new AppError("Two-step verification is required for this account and can't be turned on or off here.");
}

/** Buyer turns two-step verification on: step 1, a QR code for a new authenticator. */
export async function startOptionalTwoFactor(me: Principal): Promise<AuthenticatorSetup> {
  assertOptional(me);
  const u = await db.user.findUniqueOrThrow({ where: { id: me.id }, select: { totpSecretEnc: true, totpEnabledAt: true } });
  if (u.totpSecretEnc && u.totpEnabledAt) throw new AppError("Two-step verification is already on.");
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: me.id }, data: { totpPendingEnc: encryptSecret(secret) } });
  return buildSetup(me.email, secret);
}

/** Step 2: a code from the app switches it on. Returns the one-time backup codes. */
export async function confirmOptionalTwoFactor(me: Principal, code: string): Promise<string[]> {
  assertOptional(me);
  const res = await checkCode(me.id, code, { which: "pending", allowBackup: false });
  const codes = (await activatePending(me.id, res.step!, true)) ?? [];
  await audit({ actorId: me.id, action: "auth.2fa_enabled", entityType: "user", entityId: me.id, summary: "Buyer turned on two-step verification" });
  return codes;
}

/** Buyer turns two-step verification off (needs a current code or a backup code). */
export async function disableOptionalTwoFactor(me: Principal, code: string): Promise<void> {
  assertOptional(me);
  await checkCode(me.id, code, { which: "active", allowBackup: true });
  await db.user.update({ where: { id: me.id }, data: { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null, backupCodeHashes: [] } });
  await audit({ actorId: me.id, action: "auth.2fa_disabled", entityType: "user", entityId: me.id, summary: "Buyer turned off two-step verification" });
}

// ─── Admin ───────────────────────────────────────────────────────────────────

/** Clears someone's authenticator and backup codes; they set up a new one at their next sign-in. */
export async function resetTwoFactor(actor: Principal, userId: string): Promise<void> {
  assertCan(actor, "users.manage");
  if (actor.id === userId) throw new AppError("You can't reset your own two-step verification. Use My account to move to a new phone.");
  const target = await db.user.findUnique({ where: { id: userId }, include: { role: true } });
  if (!target) throw notFound("User");
  if (target.role.key === "SUPER_ADMIN" && actor.roleKey !== "SUPER_ADMIN") throw forbidden("Only a Super Admin can reset another Super Admin.");
  if (target.vendorId && actor.roleKey !== "SUPER_ADMIN") throw forbidden("Only a Super Admin can reset two-step verification for vendor accounts.");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null, totpLastStep: null, backupCodeHashes: [] } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.authToken.deleteMany({ where: { userId, type: "TWO_FACTOR" } });
    await audit({ actorId: actor.id, action: "user.2fa_reset", entityType: "user", entityId: userId, summary: `Two-step verification reset for ${target.email}; signed out everywhere` }, tx);
  });
}
