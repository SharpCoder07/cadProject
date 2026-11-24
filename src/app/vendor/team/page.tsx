import Link from "next/link";
import { Clock, MailPlus, ShieldCheck, UserCheck, Users } from "lucide-react";
import { db } from "@/server/db";
import { requestStateFor } from "@/server/services/approvals";
import { normaliseVendorPermissions } from "@/server/services/vendor-team";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, SearchField, SelectField, showingAll } from "@/components/admin/list-panel";
import { requireVendor } from "../_lib";
import { vendorPermissionLabel as permissionLabel } from "@/server/rbac/permissions";
import { InviteButton, MemberActions, RejectedChange } from "./team-manager";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { proposeRemovalAction } from "../actions";

export const metadata = { title: "Team" };
export const dynamic = "force-dynamic";

const PENDING = { CREATE: "Invitation pending", UPDATE: "Changes pending", DELETE: "Removal pending", PASSWORD: "Password change pending", PUBLISH: "Pending", UNPUBLISH: "Pending" } as const;

export default async function VendorTeam({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requireVendor("vendor.team", "/vendor/team");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status === "ACTIVE" || sp.status === "SUSPENDED" || sp.status === "INVITED" ? sp.status : undefined;
  const { kind } = await db.vendor.findUniqueOrThrow({ where: { id: user.vendorId }, select: { kind: true } });
  const canManage = user.permissions.has("vendor.team.manage");
  const [all, invites] = await Promise.all([
    db.user.findMany({
      where: { vendorId: user.vendorId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, status: true, lastLoginAt: true, totpEnabledAt: true, role: { select: { key: true, name: true, permissions: { select: { permission: { select: { key: true } } } } } } },
    }),
    db.approvalRequest.findMany({ where: { vendorId: user.vendorId, entityType: "VENDOR_USER", action: "CREATE", status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, entityLabel: true, createdAt: true } }),
  ]);
  const states = await requestStateFor(user.vendorId, "VENDOR_USER", all.map((u) => u.id));
  const match = (text: string) => !q || text.toLowerCase().includes(q.toLowerCase());
  // Vendor / Reseller Admins first, then anyone else who can manage the team, then everyone else by name.
  const rank = (u: (typeof all)[number]) => (u.role.key === "VENDOR" || u.role.key === "VENDOR_RESELLER" ? 0 : u.role.permissions.some((p) => p.permission.key === "vendor.team.manage") ? 1 : 2);
  const users = all
    .filter((u) => (!status || u.status === status) && (match(u.name) || match(u.email)))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  const shownInvites = !status || status === "INVITED" ? invites.filter((i) => match(i.entityLabel)) : [];
  const waiting = [...states.values()].filter((st) => st.status === "PENDING").length;
  const filtered = Boolean(q || status);
  const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // Team members who can be ticked: not yourself, and no request already waiting for them.
  const removable = canManage ? users.filter((u) => u.id !== user.id && states.get(u.id)?.status !== "PENDING").map((u) => u.id) : [];
  return (
    <SelectionProvider>
      <PageHeader
        title="Team"
        description={canManage ? "Manage your team. Every change applies after the Super Admin approves it." : "Everyone from your company who uses this portal."}
        actions={canManage ? <InviteButton kind={kind} /> : undefined}
      />
      <PageStats
        items={[
          { label: "Team members", value: formatNumber(all.length), icon: Users, tone: "red", sub: "People with portal access" },
          { label: "Active", value: formatNumber(all.filter((u) => u.status === "ACTIVE").length), icon: UserCheck, tone: "green", sub: "Can sign in" },
          { label: "Invitations pending", value: formatNumber(invites.length), icon: MailPlus, tone: invites.length ? "amber" : "neutral", sub: invites.length ? "Waiting for approval" : "None waiting" },
          { label: "Changes waiting", value: formatNumber(waiting), icon: Clock, tone: waiting ? "amber" : "neutral", sub: waiting ? "Access, password or removal" : "Nothing waiting", href: waiting ? "/vendor/requests?status=PENDING" : undefined },
        ]}
      />
      {canManage && <BulkActionBar noun="team member" items={[{ label: "Request removal", action: proposeRemovalAction, extra: { note: null }, done: "Requested removal of", danger: true, recycleBin: false, confirm: "They lose access once the Super Admin approves. Your own account is never included." }]} />}
      <ListPanel
        title="Team members"
        meta={showingAll(users.length + shownInvites.length)}
        filters={
          <FilterBar action="/vendor/team" bare oneLine>
            <SearchField defaultValue={sp.q} placeholder="Search name or email…" />
            <SelectField name="status" label="Status" value={sp.status}>
              <option value="">Any status</option><option value="ACTIVE">Active</option><option value="INVITED">Invited</option><option value="SUSPENDED">Suspended</option>
            </SelectField>
          </FilterBar>
        }
        footer={<p className="border-t border-line px-4 py-3 text-xs text-muted sm:px-5">Track team changes under <Link href="/vendor/requests" className="font-medium text-primary hover:underline">Approval requests</Link>.</p>}
      >
        {users.length + shownInvites.length === 0 ? (
          <PanelEmpty icon={<Users className="h-5 w-5" />} title={filtered ? "No team members match" : "No team members yet"}>{filtered ? "Try another name or status." : canManage ? "Add a user to give someone from your company access." : undefined}</PanelEmpty>
        ) : (
          <AdminTable bare>
            <thead><tr>{canManage && <th className="w-10">{removable.length > 0 && <AllCheckbox ids={removable} />}</th>}<th>Name</th><th>Access</th><th>Status</th><th>Two-step</th><th>Last sign-in</th>{canManage && <th className="text-right">Actions</th>}</tr></thead>
            <tbody>
              {users.map((u) => {
                const perms = normaliseVendorPermissions(u.role.permissions.map((p) => p.permission.key)).filter((p) => p !== "vendor.portal");
                const labels = perms.map(permissionLabel);
                const st = states.get(u.id);
                return (
                  <tr key={u.id}>
                    {canManage && <td>{removable.includes(u.id) && <RowCheckbox id={u.id} label={u.name} />}</td>}
                    <td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-xs font-bold text-ink ring-1 ring-line" aria-hidden>{initials(u.name)}</span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink">{u.name}{u.id === user.id && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}</span>
                          <span className="block truncate text-xs text-muted">{u.email}</span>
                        </span>
                      </div>
                    </td>
                    <td>
                      {u.role.name}
                      <span className="block text-xs text-muted" title={labels.join("\n") || undefined}>{labels.length ? `${labels.length} ${labels.length === 1 ? "permission" : "permissions"}` : "Portal access only"}</span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        <Badge tone={u.status === "ACTIVE" ? "success" : u.status === "INVITED" ? "warning" : "danger"}>{u.status.charAt(0) + u.status.slice(1).toLowerCase()}</Badge>
                        {st?.status === "REJECTED" && <RejectedChange name={u.name} action={st.action} note={st.decisionNote} when={formatDateTime(st.updatedAt)} />}
                      </span>
                      {st?.status === "PENDING" && <span className="mt-1.5 block"><Badge tone="accent">{PENDING[st.action]}</Badge></span>}

                    </td>
                    <td>{u.totpEnabledAt ? <Badge tone="success"><ShieldCheck className="h-3 w-3" aria-hidden />On</Badge> : <Badge tone="neutral">{u.status === "ACTIVE" ? "At next sign-in" : "Not yet"}</Badge>}</td>
                    <td className="whitespace-nowrap text-muted" title={u.lastLoginAt ? relativeTime(u.lastLoginAt) : undefined}>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                    {canManage && <td className="whitespace-nowrap"><MemberActions id={u.id} name={u.name} permissions={normaliseVendorPermissions(u.role.permissions.map((p) => p.permission.key))} isSelf={u.id === user.id} canReset={u.status === "ACTIVE"} kind={kind} /></td>}
                  </tr>
                );
              })}
              {shownInvites.map((i) => (
                <tr key={i.id}>
                  {canManage && <td />}
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-line text-muted" aria-hidden><MailPlus className="h-4 w-4" /></span>
                      <span className="font-semibold text-ink">{i.entityLabel}</span>
                    </div>
                  </td>
                  <td className="text-muted">—</td>
                  <td><Badge tone="accent">Invitation awaiting approval</Badge></td>
                  <td className="text-muted">—</td>
                  <td className="whitespace-nowrap text-muted" title={relativeTime(i.createdAt)}>Requested on {formatDateTime(i.createdAt)}</td>
                  {canManage && <td />}
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
