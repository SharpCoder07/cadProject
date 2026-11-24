import "server-only";
import { db } from "@/server/db";
import { AppError } from "@/server/errors";
import type { Principal } from "@/server/rbac/policy";
import { isBuyerRoleKey } from "@/server/rbac/permissions";
import { isNotifyType, notifyTypesFor, type NotifyAudience, type NotifyType } from "@/lib/notify-types";

/** The person's own bell list, push subscriptions and notification switches. */
export const audienceOf = (user: Pick<Principal, "vendorId" | "roleKey">): NotifyAudience =>
  user.vendorId ? "partner" : isBuyerRoleKey(user.roleKey) ? "buyer" : "staff";

export interface InboxItem { id: string; type: string; title: string; body: string | null; href: string | null; read: boolean; createdAt: string }

export async function listInbox(userId: string, opts: { take?: number; before?: string | null; unreadOnly?: boolean } = {}) {
  const take = Math.min(Math.max(opts.take ?? 15, 1), 50);
  const before = opts.before ? new Date(opts.before) : null;
  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}), ...(opts.unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: "desc" },
      take: take + 1,
    }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  const items: InboxItem[] = rows.slice(0, take).map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, read: Boolean(n.readAt), createdAt: n.createdAt.toISOString() }));
  return { items, unread, more: rows.length > take };
}

export async function markRead(userId: string, ids: string[] | "all") {
  const { count } = await db.notification.updateMany({ where: { userId, readAt: null, ...(ids === "all" ? {} : { id: { in: ids.slice(0, 200) } }) }, data: { readAt: new Date() } });
  return count;
}

export async function clearRead(userId: string) {
  const { count } = await db.notification.deleteMany({ where: { userId, readAt: { not: null } } });
  return count;
}

/** Push services browsers use; anything else is refused so the server never posts to arbitrary hosts. */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];

export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }, userAgent: string | null) {
  let url: URL;
  try {
    url = new URL(sub.endpoint);
  } catch {
    throw new AppError("This browser's push address isn't valid.");
  }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some((r) => r.test(url.hostname))) throw new AppError("This browser's push service isn't supported.");
  if (Buffer.from(sub.p256dh, "base64url").length !== 65 || Buffer.from(sub.auth, "base64url").length < 16) throw new AppError("This browser sent invalid push keys.");
  const count = await db.pushSubscription.count({ where: { userId } });
  if (count >= 20) {
    const oldest = await db.pushSubscription.findFirst({ where: { userId }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (oldest) await db.pushSubscription.delete({ where: { id: oldest.id } });
  }
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, userAgent: userAgent?.slice(0, 300) ?? null },
    update: { userId, p256dh: sub.p256dh, auth: sub.auth, userAgent: userAgent?.slice(0, 300) ?? null },
  });
}

export async function removePushSubscription(userId: string, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { userId, endpoint } });
}

export async function pushDeviceCount(userId: string) {
  return db.pushSubscription.count({ where: { userId } });
}

/** Switches: which of this person's notification types are on. */
export async function getNotifyPrefs(user: Principal) {
  const me = await db.user.findUnique({ where: { id: user.id }, select: { notifyOff: true } });
  const off = new Set(me?.notifyOff ?? []);
  return notifyTypesFor(audienceOf(user)).map((key) => ({ key, on: !off.has(key) }));
}

export async function setNotifyPref(user: Principal, type: string, on: boolean) {
  if (!isNotifyType(type) || !notifyTypesFor(audienceOf(user)).includes(type as NotifyType)) throw new AppError("Unknown notification type.");
  const me = await db.user.findUnique({ where: { id: user.id }, select: { notifyOff: true } });
  const off = new Set(me?.notifyOff ?? []);
  if (on) off.delete(type);
  else off.add(type);
  await db.user.update({ where: { id: user.id }, data: { notifyOff: [...off] } });
}
