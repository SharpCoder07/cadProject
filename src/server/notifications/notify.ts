import "server-only";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import type { Permission } from "@/server/rbac/permissions";
import { BUYER_ROLE_KEY, VIEW_ONLY } from "@/server/rbac/permissions";
import type { NotifyType } from "@/lib/notify-types";
import { sendWebPush } from "@/server/notifications/web-push";

/**
 * Bell + browser push notifications. notify() stores one Notification per person (the bell list)
 * and pushes it to every browser they turned notifications on in. People who switched the type
 * off (User.notifyOff) get neither. Never throws: a failed notification must not fail the change
 * that caused it.
 */
export type Recipients =
  /** Staff (admin panel users) who have this permission. Demo (view-only) accounts are left out. */
  | { staff: Permission }
  /** Users of one vendor/reseller company who have this permission. */
  | { company: string; permission: Permission }
  /** Specific people. */
  | { users: string[] }
  /** Every active Super Admin (deletion requests). */
  | { superAdmins: true };

export interface NotifyInput {
  type: NotifyType;
  title: string;
  body?: string | null;
  /** Link opened from the bell or the push pop-up. */
  href?: string | null;
  /** Leave out this person (usually whoever made the change). */
  except?: string | null;
}

const hasPermission = (p: Permission): Prisma.UserWhereInput => ({
  role: { OR: [{ key: "SUPER_ADMIN" }, { permissions: { some: { permission: { key: p } } } }] },
});

function whereFor(to: Recipients): Prisma.UserWhereInput {
  if ("users" in to) return { id: { in: to.users } };
  if ("superAdmins" in to) return { vendorId: null, role: { key: "SUPER_ADMIN" } };
  if ("company" in to) return { vendorId: to.company, ...hasPermission(to.permission) };
  return {
    vendorId: null,
    AND: [
      hasPermission(to.staff),
      { role: { key: { not: BUYER_ROLE_KEY } } },
      { role: { OR: [{ key: "SUPER_ADMIN" }, { permissions: { none: { permission: { key: VIEW_ONLY } } } }] } },
    ],
  };
}

async function deliver(to: Recipients | Recipients[], input: NotifyInput) {
  const groups = Array.isArray(to) ? to : [to];
  if (!groups.length) return;
  const users = await db.user.findMany({
    where: { status: "ACTIVE", OR: groups.map(whereFor), NOT: { notifyOff: { has: input.type } }, ...(input.except ? { id: { not: input.except } } : {}) },
    select: { id: true },
    take: 500,
  });
  if (!users.length) return;
  const ids = [...new Set(users.map((u) => u.id))];
  const title = input.title.slice(0, 200);
  const body = input.body?.slice(0, 500) ?? null;
  const href = input.href?.slice(0, 500) ?? null;
  await db.notification.createMany({ data: ids.map((userId) => ({ userId, type: input.type, title, body, href })) });

  const subs = await db.pushSubscription.findMany({ where: { userId: { in: ids } }, select: { id: true, endpoint: true, p256dh: true, auth: true } });
  if (!subs.length) return;
  const gone: string[] = [];
  const used: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        const status = await sendWebPush(s, { title, body, href, tag: input.type });
        if (status === 404 || status === 410) gone.push(s.id);
        else if (status < 300) used.push(s.id);
        else console.warn(`[push] ${new URL(s.endpoint).host} answered ${status}`);
      } catch (e) {
        console.warn("[push] send failed", e instanceof Error ? e.message : e);
      }
    }),
  );
  if (gone.length) await db.pushSubscription.deleteMany({ where: { id: { in: gone } } });
  if (used.length) await db.pushSubscription.updateMany({ where: { id: { in: used } }, data: { lastUsedAt: new Date() } });
}

/** Sends in the background; the caller doesn't wait and never sees an error. */
export function notify(to: Recipients | Recipients[], input: NotifyInput): void {
  const run = () => deliver(to, input).catch((e) => console.error("[notify] failed", input.type, e));
  try {
    // Inside a request: runs after the response is sent, and serverless hosts wait for it.
    after(run);
  } catch {
    void run();
  }
}

/** Same as notify() but waits (cron jobs, which end when the handler returns). */
export async function notifyNow(to: Recipients | Recipients[], input: NotifyInput): Promise<void> {
  await deliver(to, input).catch((e) => console.error("[notify] failed", input.type, e));
}

/** Old bell entries are removed after 90 days (called from the daily cron). */
export async function pruneNotifications(days = 90) {
  const { count } = await db.notification.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - days * 86_400_000) } } });
  return count;
}
