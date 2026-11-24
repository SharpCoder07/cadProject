import { requirePermission } from "@/server/auth/session";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { getSmtpSettings, getTemplates } from "@/server/email/config";
import { PageHeader } from "@/components/admin/page-header";
import { NotificationsForm, SendTest, SmtpForm, TemplatesList } from "./email-settings";

export const metadata = { title: "Email settings" };
export const dynamic = "force-dynamic";

export default async function EmailSettingsPage() {
  const user = await requirePermission("integrations.manage", "/admin/settings/email");
  const [smtp, templates, settings] = await Promise.all([getSmtpSettings(), getTemplates(), getSettings()]);
  const { leads } = settings;
  return (
    <>
      <PageHeader title="Email settings" description="Manage your mail server, notifications and email templates." />
      <div className="max-w-4xl space-y-4">
        <SmtpForm
          envDriver={env.EMAIL_DRIVER}
          initial={{ enabled: smtp.exists ? smtp.enabled : false, host: smtp.host, port: smtp.port, username: smtp.username, encryption: smtp.encryption, fromName: smtp.fromName || settings.site.name, fromAddress: smtp.fromAddress, replyTo: smtp.replyTo, hasPassword: smtp.hasPassword, passwordReadable: smtp.passwordReadable }}
        />
        <NotificationsForm
          canEdit={user.permissions.has("settings.manage")}
          initial={{ notifyEmails: leads.notifyEmails, emailSalesOnNewLead: leads.emailSalesOnNewLead, emailAssignee: leads.emailAssignee, emailConfirmation: leads.emailConfirmation, notifyVendor: leads.notifyVendor, notifyResellers: leads.notifyResellers }}
        />
        <SendTest defaultTo={user.email} />
        <TemplatesList templates={templates} siteName={settings.site.name} />
      </div>
    </>
  );
}
