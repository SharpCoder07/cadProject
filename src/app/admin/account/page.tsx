import { CalendarDays, Clock, Mail, ShieldCheck } from "lucide-react";
import { currentSessionId, requireUser } from "@/server/auth/session";
import { getMyAccount } from "@/server/services/account";
import { getMyTwoFactor } from "@/server/auth/two-factor";
import { getSettings } from "@/server/settings";
import { formatDate, formatDateTime } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { logoutAction } from "@/app/(auth)/actions";
import { DevicesList, PasswordForm, ProfileForm } from "./account-sections";
import { TwoFactorSection } from "./two-factor-section";
import { MyActivity } from "./my-activity";
import { Tabs } from "@/components/ui/tabs";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const me = await requireUser("/admin/account");
  const [{ profile, sessions }, currentId, tfa, settings] = await Promise.all([getMyAccount(me), currentSessionId(), getMyTwoFactor(me), getSettings()]);
  const facts = [
    { icon: Mail, label: "Email", value: profile.email },
    { icon: ShieldCheck, label: "Role", value: profile.vendor ? `${profile.role.name} · ${profile.vendor.name}` : profile.role.name },
    { icon: CalendarDays, label: "Member since", value: formatDate(profile.createdAt) },
    { icon: Clock, label: "Last sign-in", value: profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : "—" },
  ];

  return (
    <>
      <PageHeader title="My account" description="Your details, password, two-step verification and signed-in devices." />
      <div className="max-w-5xl">
        <Tabs
          variant="underline"
          urlParam="tab"
          tabs={[
            {
              id: "profile",
              label: "Profile",
              content: (
                <Panel>
                  <PanelHeader title="Profile" description="Your photo and name, as shown in the top bar and the activity log." />
                  <dl className="grid gap-x-6 gap-y-4 border-b border-line px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                    {facts.map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex min-w-0 items-start gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bg text-muted ring-1 ring-line" aria-hidden><Icon className="h-4 w-4" /></span>
                        <div className="min-w-0">
                          <dt className="text-xs text-muted">{label}</dt>
                          <dd className="truncate text-sm font-medium text-ink" title={value}>{value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>
                  <ProfileForm name={profile.name} email={profile.email} avatarUrl={profile.avatarUrl} />
                </Panel>
              ),
            },
            {
              id: "security",
              label: "Password & security",
              content: (
                <div className="space-y-4">
                  <Panel>
                    <PanelHeader title="Password" description="Use a password you don't use anywhere else." />
                    <PasswordForm hasPassword={profile.hasPassword} email={profile.email} name={profile.name} />
                  </Panel>
                  <Panel>
                    <PanelHeader title="Two-step verification" description="A code from your authenticator app is needed each time you sign in." />
                    <TwoFactorSection enabledAt={tfa.enabledAt?.toISOString() ?? null} backupLeft={tfa.backupLeft} readable={tfa.readable} account={`${settings.site.name} (${profile.email})`} />
                  </Panel>
                </div>
              ),
            },
            {
              id: "devices",
              label: "Devices",
              badge: <span className="rounded-full bg-ink/[0.06] px-1.5 text-[11px] font-semibold tabular-nums text-ink/70">{sessions.length}</span>,
              content: (
                <Panel>
                  <PanelHeader title="Devices" description="Where your account is signed in right now." />
                  <DevicesList
                    currentId={currentId}
                    signOutCurrent={logoutAction}
                    sessions={sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString() }))}
                  />
                </Panel>
              ),
            },
            {
              id: "activity",
              label: "Activity",
              content: (
                <MyActivity userId={me.id} />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
