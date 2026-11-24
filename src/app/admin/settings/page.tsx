import { requirePermission } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { defaultSettings } from "@/server/settings/schemas";
import { Panel } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/page-header";
import { SETTINGS_TABS } from "./fields";
import { isEditModeRole } from "@/lib/edit-mode-roles";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Website settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePermission("settings.manage", "/admin/settings");
  // Website edit mode: only Super Admin and Admin see and change it.
  const tabs = [...SETTINGS_TABS.filter((t) => t.key !== "editMode"), ...SETTINGS_TABS.filter((t) => t.key === "editMode" && isEditModeRole(user))];
  const { tab } = await searchParams;
  const initialTab = tabs.some((t) => t.key === tab) ? tab : undefined;
  const settings = await getSettings();
  const defaults = defaultSettings();
  return (
    <>
      <PageHeader title="Website settings" description="Manage branding, layout and wording across your website." />
      <Panel className="p-5">
        <Tabs
          key={initialTab ?? "default"}
          defaultTab={initialTab}
          tabs={tabs.map((t) => ({
            id: t.key,
            label: t.label,
            content: (
              <div>
                {t.key === "editMode" && <h2 className="mb-1 text-lg font-bold text-ink">Edit Mode</h2>}
                <p className="mb-5 text-sm text-muted">{t.description}</p>
                <SettingsForm settingKey={t.key} fields={t.fields} initial={settings[t.key] as Record<string, unknown>} {...(t.key === "theme" ? { defaults: defaults.theme as Record<string, unknown>, resetLabel: "Restore default design", preview: "theme" as const } : {})} />
              </div>
            ),
          }))}
        />
      </Panel>
    </>
  );
}
