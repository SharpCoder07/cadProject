import "server-only";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError } from "@/server/errors";
import { hashIp } from "@/server/request";
import { assertCan, type Principal } from "@/server/rbac/policy";

/**
 * Sign-in attempt rules:
 * 1. 3 wrong passwords → the account is locked for 15 minutes.
 * 2. After the lock, 2 more tries, each showing how many are left.
 * 3. Wrong again → the network (IP) is blocked for 24 hours, and the email is blocked for 24 hours:
 *    any other network that tries this email (even with the right password) is blocked for 24 hours too.
 * A correct sign-in, a password reset or reactivation by an admin clears the email's record.
 * The same messages are given for emails with and without accounts.
 */
export const FIRST_ROUND = 3;
export const SECOND_ROUND = 2;
const LOCK_MS = 15 * 60_000;
const BLOCK_MS = 24 * 3_600_000;
/** A round with no new failures for a day starts over. */
const FORGET_MS = 24 * 3_600_000;

const ist = (d: Date) => new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(d);
const plural = (n: number) => `${n} attempt${n === 1 ? "" : "s"}`;

export class LoginBlockedError extends AppError {
  constructor(message: string) {
    super(message, "RATE_LIMITED");
  }
}

const blockedMessage = (until: Date) =>
  `Sign-in from your network is blocked until ${ist(until)} IST after too many failed attempts. If this is your account, reset your password from “Forgot password?” or contact the site administrator.`;

/** 203.0.113.x / 2001:db8:85a3:… — enough for an admin to recognise a network, without storing the address. */
export function ipHint(ip: string | null) {
  if (!ip) return null;
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) return v4.split(".").slice(0, 3).join(".") + ".x";
  if (ip.includes(":")) return ip.split(":").slice(0, 3).join(":") + ":…";
  return null;
}

async function blockIp(ipHash: string, ip: string | null, email: string, reason: string) {
  const until = new Date(Date.now() + BLOCK_MS);
  const hint = ipHint(ip);
  await db.ipBlock.upsert({ where: { ipHash }, create: { ipHash, ipHint: hint, until, email, reason }, update: { ipHint: hint, until, email, reason } });
  return until;
}

/** Runs before the password is checked. Throws when this network or this email may not try now. */
export async function checkBeforePassword(email: string, ip: string | null) {
  const ipHash = hashIp(ip);
  const now = new Date();
  if (ipHash) {
    const block = await db.ipBlock.findUnique({ where: { ipHash } });
    if (block && block.until > now) throw new LoginBlockedError(blockedMessage(block.until));
  }
  let guard = await db.loginGuard.findUnique({ where: { email } });
  if (guard) {
    const blockOver = guard.blockedUntil && guard.blockedUntil <= now;
    const stale = !guard.blockedUntil && !(guard.lockedUntil && guard.lockedUntil > now) && now.getTime() - guard.updatedAt.getTime() > FORGET_MS;
    if (blockOver || stale) {
      await db.loginGuard.delete({ where: { email } }).catch(() => undefined);
      guard = null;
    }
  }
  if (guard?.blockedUntil && guard.blockedUntil > now) {
    // The email is blocked: a new network trying it is blocked as well.
    if (ipHash) {
      const until = await blockIp(ipHash, ip, email, "Tried a blocked email from a new network");
      await audit({ actorId: null, action: "auth.ip_blocked", entityType: "login", result: "failure", summary: `${email}: another network tried a blocked email; blocked for 24 hours` });
      throw new LoginBlockedError(blockedMessage(until));
    }
    throw new LoginBlockedError(blockedMessage(guard.blockedUntil));
  }
  if (guard?.lockedUntil && guard.lockedUntil > now) {
    throw new LoginBlockedError(`Too many wrong attempts. This account is locked until ${ist(guard.lockedUntil)} IST. After that you'll have ${plural(SECOND_ROUND)} more.`);
  }
}

/** Records a wrong password and returns the message to show. */
export async function recordFailure(email: string, ip: string | null, userId: string | null): Promise<never> {
  const now = new Date();
  const guard = await db.loginGuard.upsert({
    where: { email },
    create: { email, failed: 1, round: 1 },
    update: { failed: { increment: 1 } },
  });
  const allowed = guard.round === 1 ? FIRST_ROUND : SECOND_ROUND;
  const left = allowed - guard.failed;
  if (left > 0) {
    if (userId) await audit({ actorId: userId, action: "auth.login_failed", entityType: "user", entityId: userId, result: "failure", summary: `Wrong password (${plural(left)} left)` });
    throw new AppError(`Email or password is incorrect. You have ${plural(left)} remaining.`, "UNAUTHENTICATED");
  }
  if (guard.round === 1) {
    const lockedUntil = new Date(now.getTime() + LOCK_MS);
    await db.loginGuard.update({ where: { email }, data: { round: 2, failed: 0, lockedUntil } });
    if (userId) await audit({ actorId: userId, action: "auth.login_failed", entityType: "user", entityId: userId, result: "failure", summary: "Account locked for 15 minutes" });
    throw new LoginBlockedError(`Email or password is incorrect. Too many wrong attempts, so this account is locked for 15 minutes, until ${ist(lockedUntil)} IST. After that you'll have ${plural(SECOND_ROUND)} more.`);
  }
  const blockedUntil = new Date(now.getTime() + BLOCK_MS);
  await db.loginGuard.update({ where: { email }, data: { blockedUntil, lockedUntil: null, failed: 0 } });
  const ipHash = hashIp(ip);
  if (ipHash) await blockIp(ipHash, ip, email, "Too many failed sign-ins");
  await audit({ actorId: userId, action: "auth.ip_blocked", entityType: "login", entityId: userId, result: "failure", summary: `${email}: ${FIRST_ROUND + SECOND_ROUND} wrong passwords; network and email blocked for 24 hours` });
  throw new LoginBlockedError(blockedMessage(blockedUntil));
}

/** Correct password: forget the failures. */
export const clearLoginGuard = (email: string) => db.loginGuard.deleteMany({ where: { email: email.toLowerCase() } });

/**
 * Password reset or reactivation by an admin: clears the email's record and lifts the
 * network blocks that started on this email (the owner proved who they are).
 */
export async function liftLoginBlocksFor(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return;
  const email = user.email.toLowerCase();
  await Promise.all([db.loginGuard.deleteMany({ where: { email } }), db.ipBlock.deleteMany({ where: { email } })]);
}

/** Housekeeping (cron): expired network blocks and old records. */
export async function purgeLoginGuards() {
  const now = new Date();
  await db.ipBlock.deleteMany({ where: { until: { lt: now } } });
  await db.loginGuard.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - 2 * FORGET_MS) }, OR: [{ blockedUntil: null }, { blockedUntil: { lt: now } }] } });
}

// ─── Admin: Users › Blocked sign-ins ─────────────────────────────────────────

export type GuardState = "blocked" | "locked" | "failing";

/** Emails with wrong passwords, a 15-minute lock or a 24-hour block, and the blocked networks. */
export async function listBlockedSignIns(actor: Principal) {
  assertCan(actor, "users.manage");
  const now = new Date();
  const [guards, blocks] = await Promise.all([
    db.loginGuard.findMany({ where: { OR: [{ blockedUntil: { gt: now } }, { lockedUntil: { gt: now } }, { failed: { gt: 0 }, updatedAt: { gt: new Date(now.getTime() - FORGET_MS) } }, { round: 2, updatedAt: { gt: new Date(now.getTime() - FORGET_MS) } }] }, orderBy: { updatedAt: "desc" }, take: 500 }),
    db.ipBlock.findMany({ where: { until: { gt: now } }, orderBy: { createdAt: "desc" }, take: 500 }),
  ]);
  const emails = [...new Set([...guards.map((g) => g.email), ...blocks.map((b) => b.email).filter((e): e is string => Boolean(e))])];
  const users = emails.length ? await db.user.findMany({ where: { email: { in: emails } }, select: { id: true, name: true, email: true, role: { select: { name: true } } } }) : [];
  const userOf = new Map(users.map((u) => [u.email.toLowerCase(), u]));
  const networksFor = (email: string) => blocks.filter((b) => b.email === email).length;
  return {
    emails: guards.map((g) => {
      const state: GuardState = g.blockedUntil && g.blockedUntil > now ? "blocked" : g.lockedUntil && g.lockedUntil > now ? "locked" : "failing";
      const allowed = g.round === 1 ? FIRST_ROUND : SECOND_ROUND;
      return {
        email: g.email,
        user: userOf.get(g.email) ?? null,
        state,
        until: state === "blocked" ? g.blockedUntil : state === "locked" ? g.lockedUntil : null,
        attemptsLeft: state === "failing" ? Math.max(0, allowed - g.failed) : 0,
        round: g.round,
        networks: networksFor(g.email),
        lastAttempt: g.updatedAt,
      };
    }),
    networks: blocks.map((b) => ({ id: b.ipHash, hint: b.ipHint, email: b.email, user: b.email ? userOf.get(b.email) ?? null : null, reason: b.reason, until: b.until, since: b.createdAt })),
  };
}

/** Clears an email's attempts, lock and block, and the network blocks that started on it. */
export async function unblockEmail(actor: Principal, emailRaw: string) {
  assertCan(actor, "users.manage");
  const email = emailRaw.trim().toLowerCase();
  const [g, n] = await Promise.all([db.loginGuard.deleteMany({ where: { email } }), db.ipBlock.deleteMany({ where: { email } })]);
  await audit({ actorId: actor.id, action: "auth.unblock", entityType: "login", summary: `Unblocked sign-in for ${email}${n.count ? ` and ${n.count} network${n.count === 1 ? "" : "s"}` : ""}` });
  return g.count + n.count;
}

export async function unblockNetwork(actor: Principal, ipHash: string) {
  assertCan(actor, "users.manage");
  const row = await db.ipBlock.findUnique({ where: { ipHash } });
  if (!row) return 0;
  await db.ipBlock.delete({ where: { ipHash } });
  await audit({ actorId: actor.id, action: "auth.unblock_network", entityType: "login", summary: `Unblocked network ${row.ipHint ?? "(address not recorded)"}${row.email ? ` (blocked while trying ${row.email})` : ""}` });
  return 1;
}
