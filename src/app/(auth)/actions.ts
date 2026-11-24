"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, WrongAudienceError, type LoginAudience } from "@/server/auth/login";
import { createSession, currentSessionId, destroyCurrentSession, getCurrentUser } from "@/server/auth/session";
import { confirmBuyerEmail, registerBuyer, signupInput } from "@/server/auth/signup";
import { db } from "@/server/db";
import { homeFor, isBuyerRoleKey } from "@/server/rbac/permissions";
import { cancelChallenge, completeChallenge, startChallenge } from "@/server/auth/two-factor";
import { completeToken, requestPasswordReset, setFirstOwnPassword } from "@/server/services/users";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta } from "@/server/request";
import { AppError } from "@/server/errors";

export interface FormState {
  error?: string;
  /** Sign-in used the wrong tab: the tab this account belongs to. */
  switchTo?: LoginAudience;
  fieldErrors?: Record<string, string[]>;
  message?: string;
}

export interface VerifyState extends FormState {
  /** Shown once, right after the authenticator is set up. */
  backupCodes?: string[];
  /** Where to continue after the backup codes have been saved. */
  continueTo?: string;
}

const safeNext = (next: unknown, fallback: string) => {
  const s = typeof next === "string" ? next : "";
  // Only same-site relative paths, never protocol-relative.
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
};

const inArea = (path: string, area: string) => path === area || path.startsWith(`${area}/`) || path.startsWith(`${area}?`);

/** Where to go after sign-in: the requested page, unless it belongs to another kind of account's area. */
function landing(next: unknown, home: string) {
  let target = safeNext(next, home);
  // A reseller following a /vendor/… link lands on the same page under /reseller/….
  if (home === "/reseller" && inArea(target, "/vendor")) target = target.replace(/^\/vendor/, "/reseller");
  const areas = ["/admin", "/vendor", "/reseller", "/account"];
  const wrongArea = areas.some((a) => a !== home && inArea(target, a));
  return wrongArea ? home : target;
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ email: z.string().email("Enter your email"), password: z.string().min(1, "Enter your password") }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  let target: string;
  let direct = false;
  try {
    const as = form.get("as");
    const expected = as === "buyer" || as === "vendor" || as === "reseller" || as === "team" ? as : undefined;
    const res = await signIn(parsed.data.email, parsed.data.password, expected);
    target = landing(form.get("next"), res.home);
    direct = res.direct;
  } catch (e) {
    if (e instanceof WrongAudienceError) return { error: e.message, switchTo: e.actual };
    if (e instanceof AppError) return { error: e.message };
    console.error("[auth] login error", e);
    return { error: "Sign-in is unavailable right now. Please try again." };
  }
  // Buyers without two-step verification are signed in already.
  redirect(direct ? target : `/login/verify?next=${encodeURIComponent(target)}`);
}

/** Buyer sign-up. The account becomes usable after the emailed confirmation link is clicked. */
export async function signupAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signupInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  if (form.get("confirm") !== parsed.data.password) return { fieldErrors: { confirm: ["Passwords don't match"] } };
  try {
    const { ip } = await getRequestMeta();
    // Optional consent ticks are named consent_<purpose key>; unknown keys are ignored by the service.
    const consents = [...form.keys()].filter((k) => k.startsWith("consent_") && form.get(k) === "on").map((k) => k.slice(8)).filter((k) => /^[a-z0-9_]{1,40}$/.test(k));
    await registerBuyer(parsed.data, ip, consents);
  } catch (e) {
    if (e instanceof AppError) return { error: e.fieldErrors ? undefined : e.message, fieldErrors: e.fieldErrors };
    console.error("[auth] signup error", e);
    return { error: "Sign-up is unavailable right now. Please try again." };
  }
  return { message: parsed.data.email };
}

/** "Confirm my email" button on the link we emailed (a button, so link scanners can't use the link up). */
export async function confirmEmailAction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    await confirmBuyerEmail(String(form.get("token") ?? ""));
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error("[auth] confirm email error", e);
    return { error: "Something went wrong. Please try again." };
  }
  redirect(landing(form.get("next"), "/account") + (form.get("next") ? "" : "?welcome=1"));
}

/** Second step: the 6-digit code (or a backup code). Sets up the authenticator on first sign-in. */
export async function verifyTwoFactorAction(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const code = String(form.get("code") ?? "").trim();
  if (!code) return { fieldErrors: { code: ["Enter the code from your authenticator app"] } };
  if (code.length > 20) return { fieldErrors: { code: ["That doesn't look like a code"] } };
  let target: string;
  try {
    const res = await completeChallenge(code);
    target = landing(form.get("next"), res.home);
    if (res.backupCodes) return { backupCodes: res.backupCodes, continueTo: target };
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, ...(e.code === "UNAUTHENTICATED" ? { continueTo: "/login" } : {}) };
    console.error("[auth] 2fa error", e);
    return { error: "Sign-in is unavailable right now. Please try again." };
  }
  redirect(target);
}

export async function cancelTwoFactorAction() {
  await cancelChallenge();
  redirect("/login");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/login");
}

/** Sign-out from the buyer area: back to the website. */
export async function buyerLogoutAction() {
  await destroyCurrentSession();
  redirect("/");
}

export async function requestResetAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = z.string().email().safeParse(form.get("email"));
  if (!email.success) return { fieldErrors: { email: ["Enter a valid email address"] } };
  try {
    const { ip } = await getRequestMeta();
    await enforce(RULES.passwordReset, ip);
    await requestPasswordReset(email.data);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message };
    console.error(e);
  }
  return { message: "If an account exists for that email, a reset link is on its way. It expires in 1 hour." };
}

async function finishToken(type: "PASSWORD_RESET" | "INVITE", form: FormData): Promise<FormState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { fieldErrors: { confirm: ["Passwords don't match"] } };
  let userId: string;
  try {
    userId = await completeToken(token, type, password);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, fieldErrors: e.fieldErrors };
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }
  // A new password still needs the authenticator code (or sets one up for a new account) —
  // except for buyers who haven't turned two-step verification on.
  const user = await db.user.findUnique({ where: { id: userId }, select: { vendorId: true, totpEnabledAt: true, totpSecretEnc: true, role: { select: { key: true } } } });
  if (user && isBuyerRoleKey(user.role.key) && !(user.totpEnabledAt && user.totpSecretEnc)) {
    await createSession(userId);
    redirect(homeFor(user.role.key, user.vendorId));
  }
  await startChallenge(userId);
  redirect("/login/verify");
}

export const resetPasswordAction = async (_p: FormState, form: FormData) => finishToken("PASSWORD_RESET", form);
export const acceptInviteAction = async (_p: FormState, form: FormData) => finishToken("INVITE", form);

/** First sign-in to an account an admin created with a password: choose your own, then continue. */
export const setFirstPasswordAction = async (_p: FormState, form: FormData): Promise<FormState> => {
  const password = String(form.get("password") ?? "");
  if (password !== String(form.get("confirm") ?? "")) return { fieldErrors: { confirm: ["Passwords don't match"] } };
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  try {
    await setFirstOwnPassword(me, password, (await currentSessionId()) ?? undefined);
  } catch (e) {
    if (e instanceof AppError) return { error: e.message, fieldErrors: e.fieldErrors };
    console.error(e);
    return { error: "Something went wrong. Please try again." };
  }
  redirect(homeFor(me.roleKey, me.vendorId));
};
