import { requirePermission } from "@/server/auth/session";
import { getHookViews } from "@/server/integrations";
import { resolveDelivery } from "@/server/email/config";
import { env } from "@/server/env";
import { getSettings } from "@/server/settings";
import { getStorageAdminView } from "@/server/storage/admin";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { EmailCard, SlackCard, WebhookCard } from "./integration-card";
import { StoragePanel } from "./storage-panel";
import { SettingsForm } from "../settings/settings-form";
import { ANALYTICS_FIELDS } from "../settings/fields";
import { actor } from "../_lib";

export const metadata = { title: "Integrations" };
export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  await requirePermission("integrations.manage", "/admin/integrations");
  const [hooks, settings, storage, delivery] = await Promise.all([
    getHookViews(),
    getSettings(),
    actor().then(getStorageAdminView),
    resolveDelivery().catch(() => ({ mode: "db" as const })),
  ]);
  const emailMode = delivery.mode === "env" ? (env.EMAIL_DRIVER === "console" ? "env-console" : "env") : delivery.mode;
  return (
    <>
      <PageHeader title="Integrations" description="Connect your marketplace to outside services." />
      <div className="grid gap-6 xl:grid-cols-2">
        <StoragePanel view={storage} />
        <EmailCard mode={emailMode} />
        <Panel>
          <PanelHeader title="Analytics & tracking" description="Public measurement IDs. Scripts load only for the IDs you fill in." />
          <div className="p-5"><SettingsForm settingKey="analytics" fields={ANALYTICS_FIELDS} initial={settings.analytics} /></div>
        </Panel>
        <WebhookCard view={hooks.webhook} />
        <SlackCard view={hooks.slack} />
      </div>
    </>
  );
}
