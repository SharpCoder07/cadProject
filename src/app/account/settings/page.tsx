import { CalendarDays, Clock, Mail, ShieldCheck } from "lucide-react";
import { currentSessionId, requireUser } from "@/server/auth/session";
import { getMyAccount } from "@/server/services/account";
import { getMyTwoFactor } from "@/server/auth/two-factor";
import { getSettings } from "@/server/settings";
import { formatDate, formatDateTime } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { buyerLogoutAction } from "@/app/(auth)/actions";
import { Avatar, DevicesList, PasswordForm, ProfileForm } from "@/app/admin/account/account-sections";
import { TwoFactorSection } from "@/app/admin/account/two-factor-section";
import { myConsents } from "@/server/services/compliance/consent";
import { makeT } from "@/lib/site-texts";
import { ConsentPanel } from "./consent-panel";

export const metadata = { title: "Account settings" };

export default async function AccountSettingsPage() {
  const me = await requireUser("/account/settings");
  const [{ profile, sessions }, currentId, tfa, settings, consents] = await Promise.all([
    getMyAccount(me),
    currentSessionId(),
    getMyTwoFactor(me),
    getSettings(),
    // Empty until the consent tables exist (npm run db:migrate).
    myConsents(me).catch(() => []),
  ]);
  const t = makeT(settings.texts);
  const facts = [
    { icon: Mail, label: "Email", value: profile.email },
    { icon: ShieldCheck, label: "Two-step verification", value: tfa.enabledAt ? "On" : "Off" },
    { icon: CalendarDays, label: "Member since", value: formatDate(profile.createdAt) },
    { icon: Clock, label: "Last sign-in", value: profile.lastLoginAt ? formatDateTime(profile.lastLoginAt) : "—" },
  ];
  return (
    <>
      <PageHeader title="Account settings" description="Manage your profile, password, sign-in security and privacy choices." />
      <div className="grid gap-4 xl:grid-cols-[20rem_1fr]">
        <Panel className="h-fit overflow-hidden">
          <div className="p-5">
            <div className="border-b border-line pb-4">
              <Avatar name={profile.name} url={profile.avatarUrl} />
            </div>
            <p className="mt-4 text-lg font-bold leading-tight text-ink">{profile.name}</p>
            <p className="text-sm text-muted">Buyer account</p>
            <dl className="mt-4 space-y-3 border-t border-line pt-4">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="truncate text-sm font-medium text-ink">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Profile" description="Your name is shown on the reviews you write." />
            <ProfileForm name={profile.name} email={profile.email} avatarUrl={profile.avatarUrl} />
          </Panel>
          <Panel>
            <PanelHeader title="Password" description="Use a password you don't use anywhere else." />
            <PasswordForm hasPassword={profile.hasPassword} email={profile.email} name={profile.name} />
          </Panel>
          <Panel>
            <PanelHeader title="Two-step verification" description="Optional extra security: a code from an authenticator app each time you sign in." />
            <TwoFactorSection optional enabledAt={tfa.enabledAt?.toISOString() ?? null} backupLeft={tfa.backupLeft} readable={tfa.readable} account={`${settings.site.name} (${profile.email})`} />
          </Panel>
          {consents.length > 0 && (
            <Panel>
              <PanelHeader title={t("privacy.consentTitle")} description={t("privacy.consentSub")} />
              <ConsentPanel
                rows={consents.map((c) => ({ key: c.key, name: c.name, description: c.description, isNecessary: c.isNecessary, granted: c.granted, since: c.since?.toISOString() ?? null }))}
                labels={{ necessary: t("privacy.necessary"), since: t("privacy.since"), cookies: t("privacy.cookieButton") }}
              />
            </Panel>
          )}
          <Panel>
            <PanelHeader title="Devices" description="Where your account is signed in right now." />
            <DevicesList currentId={currentId} signOutCurrent={buyerLogoutAction} sessions={sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString() }))} />
          </Panel>
        </div>
      </div>
    </>
  );
}
