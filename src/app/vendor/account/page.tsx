import { db } from "@/server/db";
import { currentSessionId } from "@/server/auth/session";
import { getMyAccount } from "@/server/services/account";
import { getMyTwoFactor } from "@/server/auth/two-factor";
import { getSettings } from "@/server/settings";
import { TwoFactorSection } from "@/app/admin/account/two-factor-section";
import { formatDateTime } from "@/lib/format";
import { Alert, Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { AvatarUploader, DevicesList } from "@/app/admin/account/account-sections";
import { logoutAction } from "@/app/(auth)/actions";
import { requireVendor } from "../_lib";
import { NameForm, VendorPasswordForm } from "./sections";
import { MyActivity } from "@/app/admin/account/my-activity";
import { Tabs } from "@/components/ui/tabs";

export const metadata = { title: "My account" };
export const dynamic = "force-dynamic";

export default async function VendorAccount() {
  const me = await requireVendor("vendor.portal", "/vendor/account");
  const [{ profile, sessions }, currentId, tfa, settings, pending] = await Promise.all([
    getMyAccount(me),
    currentSessionId(),
    getMyTwoFactor(me),
    getSettings(),
    db.approvalRequest.findMany({ where: { entityType: "VENDOR_USER", entityId: me.id, status: "PENDING" }, select: { action: true, payload: true, createdAt: true } }),
  ]);
  const pendingProfile = pending.find((p) => p.action === "UPDATE");
  const pendingPassword = pending.find((p) => p.action === "PASSWORD");
  const proposed = (pendingProfile?.payload ?? {}) as { name?: string; avatarUrl?: string | null; permissions?: string[] };

  return (
    <>
      <PageHeader title="My account" description={`${profile.email} · ${profile.role.name}${profile.vendor ? ` at ${profile.vendor.name}` : ""}`} />
      <div className="max-w-4xl space-y-4">
        {pendingProfile && (
          <Alert tone="warning" title="Profile changes waiting for approval">
            {[proposed.name && `Name → “${proposed.name}”`, "avatarUrl" in proposed && (proposed.avatarUrl ? "New photo" : "Remove photo"), proposed.permissions && "Access change"].filter(Boolean).join(" · ")} — sent {formatDateTime(pendingProfile.createdAt)}.
          </Alert>
        )}
        <Tabs
          variant="underline"
          urlParam="tab"
          tabs={[
            {
              id: "profile",
              label: "Profile",
              content: (
                <Panel>
                  <PanelHeader title="Profile" description="Name and photo changes apply after Super Admin approval." />
                  <div className="space-y-5 p-5">
                    <AvatarUploader name={profile.name} url={profile.avatarUrl} />
                    <div className="border-t border-line pt-5"><NameForm name={profile.name} email={profile.email} /></div>
                  </div>
                </Panel>
              ),
            },
            {
              id: "security",
              label: "Password & security",
              content: (
                <div className="space-y-4">
                  <Panel>
                    <PanelHeader title="Password" description="Password changes also need Super Admin approval." />
                    <div className="p-5">
                      {pendingPassword && <Alert tone="warning" className="mb-4" title="Password change waiting for approval">Sent {formatDateTime(pendingPassword.createdAt)}. Your current password keeps working until then. Submitting again replaces it.</Alert>}
                      <VendorPasswordForm email={profile.email} name={profile.name} />
                    </div>
                  </Panel>
                  <Panel>
                    <PanelHeader title="Two-step verification" description="Security changes like this one apply straight away — no approval needed." />
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
                  <PanelHeader title="Devices" description="Signing out of a device takes effect immediately." />
                  <DevicesList currentId={currentId} signOutCurrent={logoutAction} sessions={sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString() }))} />
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
