import { requireUser } from "@/server/auth/session";
import { getMyEmailNotifications } from "@/server/services/my-notifications";
import { EmailNotificationsView } from "@/components/admin/email-notifications";

export const metadata = { title: "Email notifications" };
export const dynamic = "force-dynamic";

export default async function EmailNotificationsPage() {
  const user = await requireUser("/account/notifications/email");
  return <EmailNotificationsView data={await getMyEmailNotifications(user)} email={user.email} />;
}
