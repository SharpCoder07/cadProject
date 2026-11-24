import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { formatDateTime } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

/** Audit-log actions shown on the Activity tab, with a badge for each. */
const EVENTS: Record<string, { badge: string; tone: "green" | "neutral" | "red" | "amber" }> = {
  "auth.login": { badge: "Two-step verified", tone: "green" },
  "auth.password_ok": { badge: "Signed in", tone: "neutral" },
  "auth.login_failed": { badge: "Sign-in failed", tone: "red" },
  "auth.login_wrong_portal": { badge: "Wrong sign-in tab", tone: "amber" },
  "auth.2fa_failed": { badge: "Code rejected", tone: "red" },
  "auth.2fa_enabled": { badge: "Two-step turned on", tone: "green" },
  "auth.2fa_disabled": { badge: "Two-step turned off", tone: "amber" },
  "auth.2fa_changed": { badge: "Authenticator changed", tone: "neutral" },
  "auth.2fa_backup_codes": { badge: "Backup codes", tone: "neutral" },
  "auth.password_reset": { badge: "Password reset", tone: "neutral" },
  "account.password_change": { badge: "Password changed", tone: "neutral" },
  "user.password_change": { badge: "Password changed", tone: "neutral" },
  "user.password_reset": { badge: "Reset link sent", tone: "neutral" },
  "user.invite_accepted": { badge: "Account activated", tone: "green" },
  "user.role_change": { badge: "Role changed", tone: "neutral" },
  "user.suspend": { badge: "Suspended", tone: "red" },
  "user.reactivate": { badge: "Reactivated", tone: "green" },
};
const PASSWORD_ACTIONS = ["account.password_change", "user.password_change", "auth.password_reset"];
const TONE = {
  green: "bg-success/10 text-success ring-success/25",
  neutral: "bg-ink/[0.04] text-ink/70 ring-line",
  red: "bg-danger/10 text-danger ring-danger/25",
  amber: "bg-warning/10 text-warning ring-warning/25",
};

function describe(action: string, summary: string | null): string {
  if (action === "auth.login") {
    if (!summary || summary === "With authenticator app") return "Signed in with your authenticator app";
    if (summary.startsWith("With a backup code")) return `Signed in ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`;
    if (summary === "Buyer sign-in") return "Signed in with your password";
    return `Signed in — ${summary.charAt(0).toLowerCase()}${summary.slice(1)}`;
  }
  return summary || EVENTS[action]?.badge || action;
}

/** A short "Chrome on Windows" from a browser's user-agent string. */
function device(ua: string | null): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return browser && os ? `${browser} on ${os}` : browser ?? os;
}

/** "Activity" tab on My account: key dates, then the person's recent sign-ins and security changes. */
export async function MyActivity({ userId }: { userId: string }) {
  const mine: Prisma.AuditLogWhereInput = { OR: [{ actorId: userId, action: { startsWith: "auth." } }, { entityType: "user", entityId: userId }] };
  const [user, events, lastPassword, lastTwoStep] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true, lastLoginAt: true, totpEnabledAt: true } }),
    db.auditLog.findMany({ where: { AND: [mine, { action: { in: Object.keys(EVENTS) } }] }, orderBy: { createdAt: "desc" }, take: 25, select: { id: true, action: true, summary: true, createdAt: true, ipAddress: true, userAgent: true } }),
    db.auditLog.findFirst({ where: { entityType: "user", entityId: userId, action: { in: PASSWORD_ACTIONS } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    db.auditLog.findFirst({ where: { actorId: userId, action: "auth.login", NOT: { summary: "Buyer sign-in" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const dates = [
    { label: "Account created", value: user?.createdAt },
    { label: "Last sign-in", value: user?.lastLoginAt },
    { label: "Password last changed", value: lastPassword?.createdAt },
    { label: "Authenticator enabled on", value: user?.totpEnabledAt },
    { label: "Last two-step verification", value: lastTwoStep?.createdAt },
  ];

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Account" description="Key dates for this account." />
        <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {dates.map((d) => (
            <div key={d.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">{d.label}</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{d.value ? formatDateTime(d.value) : "—"}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel>
        <PanelHeader title="Recent security activity" description="The last 25 security events on your account." />
        {events.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Nothing yet. Sign-ins and security changes appear here.</p>
        ) : (
          <ul className="space-y-2 p-4">
            {events.map((e) => {
              const ev = EVENTS[e.action] ?? { badge: e.action, tone: "neutral" as const };
              const where = [device(e.userAgent), e.ipAddress && `IP ${e.ipAddress}`].filter(Boolean).join(" · ");
              return (
                <li key={e.id} className="flex flex-col gap-2 rounded-xl border border-line px-4 py-3 sm:flex-row sm:items-start sm:gap-3">
                  <span className={cn("w-fit shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ring-1", TONE[ev.tone])}>{ev.badge}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{describe(e.action, e.summary)}</span>
                    <span className="text-xs text-muted">
                      {formatDateTime(e.createdAt)}
                      {where && <> · {where}</>}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
