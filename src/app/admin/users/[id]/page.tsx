import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Building2, CalendarDays, Clock, History, Laptop, Mail, ShieldCheck } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listSessions } from "@/server/services/users";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { auditArea, auditCode, auditFallback, auditTone } from "@/lib/audit-labels";
import { cn } from "@/lib/utils";
import { Badge, Panel, PanelHeader, type BadgeTone } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/page-header";
import { SessionsList } from "@/components/admin/sessions-list";
import { UserForm } from "./user-form";
import { TwoFactorAdmin } from "./two-factor-admin";

export const metadata = { title: "User" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  ACTIVE: { label: "Active", tone: "success" },
  INVITED: { label: "Invited", tone: "accent" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
};
const CHIP = {
  red: "bg-danger/10 text-danger ring-danger/25",
  green: "bg-success/10 text-success ring-success/25",
  neutral: "bg-ink/[0.04] text-ink/70 ring-line",
};
const countBadge = (n: number) => <span className="rounded-full bg-ink/[0.06] px-1.5 text-[11px] font-semibold tabular-nums text-ink/70">{n}</span>;

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requirePermission("users.view", `/admin/users/${id}`);
  // Your own profile, password and devices are managed in one place.
  if (me.id === id) redirect("/admin/account");
  const [u, roles, vendors, sessions, activity] = await Promise.all([
    db.user.findUnique({ where: { id }, include: { role: true, vendor: { select: { id: true, name: true, kind: true } } } }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, key: true } }),
    db.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    listSessions(me, id),
    db.auditLog.findMany({ where: { actorId: id }, orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  if (!u) notFound();
  const visibleRoles = me.roleKey === "SUPER_ADMIN" ? roles : roles.filter((r) => r.key !== "SUPER_ADMIN" || r.id === u.roleId);
  const status = STATUS[u.status] ?? { label: u.status.toLowerCase(), tone: "neutral" as BadgeTone };
  const twoStep = Boolean(u.totpSecretEnc && u.totpEnabledAt);
  const initials = u.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
  const company = u.vendor ? { href: `/admin/${u.vendor.kind === "RESELLER" ? "resellers" : "vendors"}/${u.vendor.id}`, name: u.vendor.name } : null;
  const facts = [
    { icon: Mail, label: "Email", value: u.email },
    { icon: CalendarDays, label: u.status === "INVITED" ? "Invited" : "Member since", value: formatDate(u.createdAt) },
    { icon: Clock, label: "Last sign-in", value: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never", title: u.lastLoginAt ? formatDateTime(u.lastLoginAt) : undefined },
    { icon: Laptop, label: "Signed in on", value: sessions.length ? `${sessions.length} ${sessions.length === 1 ? "device" : "devices"}` : "No devices" },
  ];

  return (
    <>
      <PageHeader title="User" back={{ href: "/admin/users", label: "Users" }} />

      {/* Who this is, at a glance */}
      <Panel className="mb-5 overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
          {u.avatarUrl ? (
            <Image src={u.avatarUrl} alt="" width={64} height={64} unoptimized className="h-16 w-16 shrink-0 rounded-full object-cover ring-1 ring-line" />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-mint-soft text-xl font-bold text-mint-ink ring-1 ring-mint/40" aria-hidden>{initials}</span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-bold text-ink">{u.name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="primary"><ShieldCheck className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden />{u.role.name}</Badge>
              <Badge tone={status.tone}>{status.label}</Badge>
              <Badge tone={twoStep ? "success" : "warning"}>{twoStep ? "Two-step on" : "Two-step not set up"}</Badge>
              {company && (
                <Link href={company.href} className="inline-flex items-center gap-1 rounded-full bg-ink/[0.06] px-2.5 py-0.5 text-xs font-medium text-ink/80 hover:text-mint-ink">
                  <Building2 className="h-3.5 w-3.5" aria-hidden /> {company.name}
                </Link>
              )}
            </div>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-4 border-t border-line bg-bg/40 px-5 py-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
          {facts.map(({ icon: Icon, label, value, title }) => (
            <div key={label} className="flex min-w-0 items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-muted ring-1 ring-line" aria-hidden><Icon className="h-4 w-4" /></span>
              <div className="min-w-0">
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="truncate text-sm font-medium text-ink" title={title ?? value}>{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </Panel>

      <div className="max-w-5xl">
        <Tabs
          variant="underline"
          urlParam="tab"
          tabs={[
            {
              id: "account",
              label: "Account",
              content: (
                <Panel>
                  <PanelHeader title="Account" description="Name, role and company. Suspending signs them out everywhere." />
                  <div className="p-5 sm:p-6">
                    <UserForm user={{ id: u.id, name: u.name, email: u.email, roleId: u.roleId, vendorId: u.vendorId, status: u.status }} roles={visibleRoles} vendors={vendors} isSelf={false} canChangeRole={me.roleKey === "SUPER_ADMIN"} />
                  </div>
                </Panel>
              ),
            },
            {
              id: "security",
              label: "Security",
              badge: countBadge(sessions.length),
              content: (
                <div className="space-y-4">
                  <Panel>
                    <PanelHeader title="Two-step verification" description="Required for every account." />
                    <TwoFactorAdmin
                      userId={u.id}
                      name={u.name}
                      enabledAt={twoStep ? u.totpEnabledAt!.toISOString() : null}
                      backupLeft={u.backupCodeHashes.length}
                      canReset={me.roleKey === "SUPER_ADMIN" || (u.role.key !== "SUPER_ADMIN" && !u.vendorId)}
                    />
                  </Panel>
                  <Panel>
                    <PanelHeader title="Signed-in devices" description="Sign them out of a device, or of every device at once." />
                    <SessionsList userId={u.id} sessions={sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString(), lastSeenAt: s.lastSeenAt.toISOString() }))} allowRevokeAll />
                  </Panel>
                </div>
              ),
            },
            {
              id: "activity",
              label: "Activity",
              content: (
                <Panel>
                  <PanelHeader
                    title="Recent activity"
                    description={`The last ${activity.length || 25} things ${u.name.split(" ")[0]} did in the admin.`}
                    actions={<Link href={`/admin/audit-log?actor=${u.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-mint-ink hover:underline"><History className="h-4 w-4" aria-hidden /> Full history</Link>}
                  />
                  {activity.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-muted">No recorded activity yet.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {activity.map((a) => (
                        <li key={a.id} className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                          <code className={cn("w-fit shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 font-sans text-[11px] font-semibold tracking-wide ring-1", CHIP[auditTone(a.action)])} title={a.action}>{auditCode(a.action, a.summary)}</code>
                          <span className="min-w-0 flex-1 text-sm text-ink">
                            {a.summary || auditFallback(a.action, a.entityType)}
                            <span className="ml-2 text-xs text-muted">{auditArea(a.action)}</span>
                          </span>
                          <span className="shrink-0 text-xs text-muted" title={relativeTime(a.createdAt)}>{formatDateTime(a.createdAt)}{a.ipAddress && ` · ${a.ipAddress}`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
