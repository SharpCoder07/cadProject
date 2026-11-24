import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { enforce, resetBucket, RULES } from "@/server/rate-limit";
import { getRequestMeta } from "@/server/request";
import { homeFor, isBuyerRoleKey } from "@/server/rbac/permissions";
import { verifyPassword } from "./password";
import { createSession } from "./session";
import { startChallenge } from "./two-factor";
import { resendBuyerVerification } from "./signup";
import { checkBeforePassword, clearLoginGuard, recordFailure } from "./login-guard";


/**
 * Verifies the password, then opens the two-step challenge (code from an authenticator app).
 * No session exists until that code is confirmed. Buyers who haven't turned on two-step
 * verification are signed in straight away (`direct`). Returns the user's home area.
 */
/** Which sign-in tab an account belongs to, from its home area. */
export type LoginAudience = "buyer" | "vendor" | "reseller" | "team";
const audienceOf = (home: string): LoginAudience => (home.startsWith("/reseller") ? "reseller" : home.startsWith("/vendor") ? "vendor" : home.startsWith("/account") ? "buyer" : "team");
const AUDIENCE_NAME: Record<LoginAudience, string> = { buyer: "buyer", vendor: "vendor", reseller: "reseller", team: "team (admin)" };
const AUDIENCE_TAB: Record<LoginAudience, string> = { buyer: "Buyer", vendor: "Vendor", reseller: "Reseller", team: "Team" };

/** Thrown when the password is right but the account belongs to another sign-in tab. No session is created. */
export class WrongAudienceError extends AppError {
  constructor(public actual: LoginAudience, expected: LoginAudience) {
    super(`This is a ${AUDIENCE_NAME[actual]} account, so it can't sign in on the ${AUDIENCE_TAB[expected]} tab. Use the ${AUDIENCE_TAB[actual]} tab instead.`, "FORBIDDEN");
  }
}

export async function signIn(emailRaw: string, password: string, expected?: LoginAudience): Promise<{ home: string; direct: boolean }> {
  const email = emailRaw.trim().toLowerCase();
  const { ip } = await getRequestMeta();
  // Blocked network, blocked email (a new network trying it is blocked too) or a 15-minute lock.
  await checkBeforePassword(email, ip);
  await enforce(RULES.loginIp, ip, "Too many sign-in attempts from this network. Try again in 15 minutes.");
  await enforce(RULES.loginEmail, email, "Too many sign-in attempts for this account. Try again in 15 minutes.");

  const user = await db.user.findUnique({ where: { email }, include: { role: true, vendor: { select: { kind: true } } } });
  const valid = await verifyPassword(user?.passwordHash ?? null, password);

  // 3 tries, a 15-minute lock, 2 more tries, then a 24-hour block (see login-guard.ts).
  if (!user || !valid) await recordFailure(email, ip, user?.id ?? null);
  if (!user) throw new AppError("Email or password is incorrect.", "UNAUTHENTICATED");
  await clearLoginGuard(email);
  const buyer = isBuyerRoleKey(user.role.key);
  if (user.status === "INVITED" && buyer) {
    // Signed up but never clicked the confirmation link: send a fresh one.
    await resendBuyerVerification(user.id);
    throw new AppError(`Confirm your email address first. We've sent a new confirmation link to ${user.email} — it's valid for 24 hours.`, "UNAUTHENTICATED");
  }
  if (user.status !== "ACTIVE") {
    throw new AppError(user.status === "INVITED" ? "Accept your invite email to set a password first." : "This account is suspended. Contact an administrator.", "UNAUTHENTICATED");
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await resetBucket(RULES.loginEmail, email);
  // Resellers share the partner portal, under its own address.
  const home = user.vendor?.kind === "RESELLER" ? "/reseller" : homeFor(user.role.key, user.vendorId);
  // The sign-in page has Buyer / Vendor / Reseller / Team tabs: refuse an account used on the wrong tab.
  const actual = audienceOf(home);
  if (expected && expected !== actual) {
    await audit({ actorId: user.id, action: "auth.login_wrong_portal", entityType: "user", entityId: user.id, result: "denied", summary: `Tried the ${AUDIENCE_TAB[expected]} sign-in with a ${AUDIENCE_NAME[actual]} account` });
    throw new WrongAudienceError(actual, expected);
  }
  if (buyer && !(user.totpSecretEnc && user.totpEnabledAt)) {
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id);
    await audit({ actorId: user.id, action: "auth.login", entityType: "user", entityId: user.id, actorType: "buyer", summary: "Buyer sign-in" });
    return { home, direct: true };
  }
  await audit({ actorId: user.id, action: "auth.password_ok", entityType: "user", entityId: user.id, summary: "Password accepted; waiting for the two-step code" });
  await startChallenge(user.id);
  return { home, direct: false };
}
