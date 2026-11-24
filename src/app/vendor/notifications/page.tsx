import { requireUser } from "@/server/auth/session";
import { getNotifyPrefs, listInbox, pushDeviceCount } from "@/server/services/inbox";
import { NotificationCenter } from "@/components/notifications/notification-center";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser("/vendor/notifications");
  const [initial, prefs, devices] = await Promise.all([listInbox(user.id, { take: 30 }), getNotifyPrefs(user), pushDeviceCount(user.id)]);
  return <NotificationCenter initial={initial} prefs={prefs} devices={devices} emailHref="/vendor/notifications/email" />;
}
