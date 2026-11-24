import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { safeEqual } from "@/server/auth/tokens";
import { publishDueSoftware } from "@/server/services/software";
import { publishDuePages } from "@/server/services/cms";
import { publishDuePosts } from "@/server/services/blog";
import { retryFailedNotifications } from "@/server/notifications/leads";
import { dispatchOfferLaunches } from "@/server/services/offers";
import { notifyExpiringPlans } from "@/server/services/billing";
import { pruneNotifications } from "@/server/notifications/notify";
import { purgeExpiredBuckets } from "@/server/rate-limit";
import { db } from "@/server/db";
import { purgeExpiredBin } from "@/server/system/trash";
import { autoResolveQuietErrors, pruneErrorLogs } from "@/server/error-log";
import { runScheduledBackup } from "@/server/system/backup";
import { purgeLoginGuards } from "@/server/auth/login-guard";
import { runDueRetention } from "@/server/services/compliance/retention";

/**
 * Scheduled jobs: publish scheduled content, retry failed notifications, email favourites
 * about offers that have just started,
 * clean up expired sessions/rate-limit buckets and recycle-bin items older than 30 days. Call every 5 minutes with
 * `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically).
 */
async function run(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEqual(auth, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [software, pages, posts, retried, offerEmails] = await Promise.all([publishDueSoftware(), publishDuePages(), publishDuePosts(), retryFailedNotifications(), dispatchOfferLaunches()]);
  await purgeExpiredBuckets();
  await purgeLoginGuards().catch((e) => console.error("[cron] login guard clean-up failed", e));
  const binPurged = await purgeExpiredBin();
  const plansExpiring = await notifyExpiringPlans().catch((e) => (console.error("[cron] plan reminders failed", e), 0));
  const notificationsPruned = await pruneNotifications().catch(() => 0);
  const errorsPruned = await pruneErrorLogs().catch(() => 0);
  const errorsAutoResolved = await autoResolveQuietErrors().catch((e) => (console.error("[cron] auto-resolve errors failed", e), 0));
  // Automatic backups (Admin › System › Backup & restore); runs only when its scheduled time has come.
  const backup = await runScheduledBackup().catch((e) => ({ ran: false, error: e instanceof Error ? e.message : String(e) }));
  // Compliance & Privacy › Retention: switched-on rules, once a day.
  const retention = await runDueRetention().catch((e) => (console.error("[cron] retention failed", e), {}));
  await db.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 30 * 86_400_000) } }] } });
  return NextResponse.json({ published: { software, pages, posts }, retriedNotifications: retried, offerEmails, binPurged, plansExpiring, notificationsPruned, errorsPruned, errorsAutoResolved, backup, retention });
}

export const GET = run;
export const POST = run;
