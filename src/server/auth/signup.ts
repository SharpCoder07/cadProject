import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { audit } from "@/server/audit";
import { AppError, isUniqueViolation } from "@/server/errors";
import { sendTemplate } from "@/server/email/config";
import { sendWelcome } from "@/server/email/welcome";
import { assertNoBlockedWords } from "@/server/moderation";
import { enforce, RULES } from "@/server/rate-limit";
import { BUYER_ROLE_KEY, PERMISSIONS, SYSTEM_ROLES } from "@/server/rbac/permissions";
import { hashPassword, passwordProblems } from "./password";
import { createSession } from "./session";
import { randomToken, sha256 } from "./tokens";
import { getRequestMeta, hashIp } from "@/server/request";
import { recordFormConsents } from "@/server/services/compliance/consent";
import { recordAcceptances, versionsInForce } from "@/server/services/compliance/legal";

/**
 * Buyer accounts: people who sign up on the website to save favourites, get offer emails and
 * write reviews. A new account stays INVITED until the email address is confirmed from the link we
 * send; only then can it sign in. Two-step verification is optional for buyers.
 */

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

export const signupInput = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z.string().min(1, "Choose a password").max(200),
  agree: z.literal("on", { errorMap: () => ({ message: "Please accept the terms to continue" }) }),
});
export type SignupInput = z.infer<typeof signupInput>;

/** The Buyer role, created on first use so sign-up works even before the seed has been re-run. */
export async function ensureBuyerRole() {
  const existing = await db.role.findUnique({ where: { key: BUYER_ROLE_KEY }, select: { id: true } });
  if (existing) return existing.id;
  const def = SYSTEM_ROLES.BUYER;
  const perm = await db.permission.upsert({
    where: { key: "buyer.account" },
    create: { key: "buyer.account", group: "buyer", description: PERMISSIONS["buyer.account"] },
    update: {},
  });
  try {
    const role = await db.role.create({
      data: { key: BUYER_ROLE_KEY, name: def.name, description: def.description, isSystem: true, permissions: { create: [{ permissionId: perm.id }] } },
    });
    return role.id;
  } catch (e) {
    if (isUniqueViolation(e)) return (await db.role.findUniqueOrThrow({ where: { key: BUYER_ROLE_KEY }, select: { id: true } })).id;
    throw e;
  }
}

async function sendVerification(user: { id: string; email: string; name: string }) {
  const token = randomToken();
  await db.$transaction([
    db.authToken.deleteMany({ where: { userId: user.id, type: "EMAIL_VERIFY" } }),
    db.authToken.create({ data: { userId: user.id, type: "EMAIL_VERIFY", tokenHash: sha256(token), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) } }),
  ]);
  await sendTemplate("verify_email", user.email, { user_name: user.name, verify_link: `${env.APP_URL}/verify-email/${token}` }).catch((e) => console.error("[auth] verification email failed", e));
}

/**
 * Creates a buyer account and emails a confirmation link. The reply is the same whether or not the
 * email is already registered, so the form can't be used to find out who has an account.
 */
export async function registerBuyer(input: SignupInput, ip: string | null, optionalConsents: string[] = []): Promise<void> {
  await enforce(RULES.signup, ip, "Too many sign-ups from this network. Try again in an hour.");
  const problems = passwordProblems(input.password, { email: input.email, name: input.name });
  if (problems.length) throw new AppError("Choose a stronger password.", "BAD_REQUEST", { password: problems });
  await assertNoBlockedWords({ name: input.name });

  const existing = await db.user.findUnique({ where: { email: input.email }, include: { role: { select: { key: true } } } });
  if (existing) {
    // An unconfirmed buyer signing up again gets a fresh link; anyone else gets nothing new.
    if (existing.status === "INVITED" && existing.role.key === BUYER_ROLE_KEY) await resendBuyerVerification(existing.id);
    return;
  }

  const roleId = await ensureBuyerRole();
  let user: { id: string; email: string; name: string };
  try {
    user = await db.user.create({
      data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password), roleId, status: "INVITED" },
      select: { id: true, email: true, name: true },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return;
    throw e;
  }
  await audit({ actorId: user.id, action: "user.signup", entityType: "user", entityId: user.id, summary: `Buyer signed up: ${user.email}`, actorType: "buyer" });
  // Consent records: the account purpose plus the optional ones ticked (Compliance & Privacy › Consent).
  await recordFormConsents("signup", { userId: user.id, email: user.email, ipHash: hashIp(ip) }, optionalConsents).catch((e) => console.error("[consent] signup consents not recorded", e));
  // The "I agree to the terms and privacy policy" tick: record which versions were accepted.
  await versionsInForce(["terms", "privacy-policy"])
    .then(async (v) => recordAcceptances({ userId: user.id, email: user.email }, v, { context: "signup", ipHash: hashIp(ip), userAgent: (await getRequestMeta().catch(() => ({ userAgent: null }))).userAgent }))
    .catch((e) => console.error("[legal] signup acceptance not recorded", e));
  await sendVerification(user);
}

/** Sends a new confirmation link to an unconfirmed buyer (rate limited per account). */
export async function resendBuyerVerification(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, status: true, role: { select: { key: true } } } });
  if (!user || user.status !== "INVITED" || user.role.key !== BUYER_ROLE_KEY) return;
  try {
    await enforce(RULES.verifyResend, user.id);
  } catch {
    return; // a link was sent recently; don't flood their inbox
  }
  await sendVerification(user);
}

async function liveToken(token: string) {
  const row = await db.authToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { id: true, email: true, name: true, status: true } } } });
  if (!row || row.type !== "EMAIL_VERIFY" || row.consumedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** For the confirmation page: who the link belongs to, or null when it has expired or been used. */
export async function checkVerifyToken(token: string) {
  const row = await liveToken(token);
  return row ? { email: row.user.email, name: row.user.name } : null;
}

/** Confirms the email, activates the account and signs the buyer in. */
export async function confirmBuyerEmail(token: string): Promise<void> {
  const row = await liveToken(token);
  if (!row) throw new AppError("This confirmation link has expired or was already used. Sign in and we'll send you a new one.");
  await db.$transaction(async (tx) => {
    const used = await tx.authToken.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (!used.count) throw new AppError("This confirmation link was already used. You can sign in now.");
    await tx.user.update({ where: { id: row.userId }, data: { status: row.user.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE", lastLoginAt: new Date() } });
    await audit({ actorId: row.userId, action: "user.email_verified", entityType: "user", entityId: row.userId, summary: "Buyer confirmed their email" }, tx);
  });
  if (row.user.status === "SUSPENDED") throw new AppError("This account is suspended. Contact us for help.");
  // First confirmation only (an already-active buyer confirming a changed address doesn't get it again).
  if (row.user.status === "INVITED") void sendWelcome(row.userId);
  await createSession(row.userId);
}
