import Link from "next/link";
import { Ban, Building2, ShieldCheck, ShoppingBag, UserCog, Users } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listUsers } from "@/server/services/users";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, SearchField, SelectField, showing } from "@/components/admin/list-panel";
import { InviteButton } from "./invite-button";
import { buttonClass } from "@/components/ui/button";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { setUserStatusAction } from "./actions";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; roleId?: string; status?: string; page?: string }> }) {
  const user = await requirePermission("users.view", "/admin/users");
  const sp = await searchParams;
  const status = sp.status === "ACTIVE" || sp.status === "SUSPENDED" || sp.status === "INVITED" ? sp.status : undefined;
  const now = new Date();
  const [data, roles, vendors, staff, vendorUsers, buyers, twoStep, blockedCount] = await Promise.all([
    listUsers(user, { q: sp.q, roleId: sp.roleId || undefined, status, page: Number(sp.page) || 1 }),
    db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, key: true } }),
    db.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true } }),
    db.user.count({ where: { vendorId: null, role: { key: { not: "BUYER" } } } }),
    db.user.count({ where: { vendorId: { not: null } } }),
    db.user.count({ where: { role: { key: "BUYER" } } }),
    db.user.count({ where: { totpEnabledAt: { not: null } } }),
    db.loginGuard.count({ where: { OR: [{ blockedUntil: { gt: now } }, { lockedUntil: { gt: now } }] } }),
  ]);
  const buyerRole = roles.find((r) => r.key === "BUYER");
  // Buyers sign up on the website themselves; they aren't invited.
  const invitable = (user.roleKey === "SUPER_ADMIN" ? roles : roles.filter((r) => r.key !== "SUPER_ADMIN")).filter((r) => r.key !== "BUYER");
  const totalUsers = staff + vendorUsers + buyers;
  return (
    <SelectionProvider>
      <PageHeader title="Users" description="Manage every staff, vendor and buyer account." actions={
          <>
            <Link href="/admin/users/blocked" className={buttonClass("secondary", "sm")}>
              <Ban className="h-4 w-4" aria-hidden /> Blocked sign-ins
              {blockedCount > 0 && <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold leading-5 text-white">{blockedCount}</span>}
            </Link>
            {/* Giving someone a role gives them its permissions: Super Admin only. */}
            {user.roleKey === "SUPER_ADMIN" && !user.readOnly && <InviteButton roles={invitable} vendors={vendors} />}
          </>
        } />
      <PageStats
        items={[
          { label: "Staff", value: formatNumber(staff), icon: UserCog, tone: "red", sub: "Admin panel accounts" },
          { label: "Vendor users", value: formatNumber(vendorUsers), icon: Building2, sub: "Vendor portal accounts" },
          { label: "Buyers", value: formatNumber(buyers), icon: ShoppingBag, tone: "green", sub: "Signed up on the website", href: buyerRole ? `/admin/users?roleId=${buyerRole.id}` : undefined },
          { label: "Two-step on", value: formatNumber(twoStep), icon: ShieldCheck, sub: totalUsers ? `${Math.round((twoStep / totalUsers) * 100)}% of all accounts` : "No accounts yet" },
        ]}
      />
      <BulkActionBar
        noun="user"
        items={[
          { label: "Reactivate", action: setUserStatusAction, extra: { status: "ACTIVE" }, done: "Reactivated" },
          { label: "Suspend", action: setUserStatusAction, extra: { status: "SUSPENDED" }, done: "Suspended", danger: true, confirm: "Suspended people can't sign in until you reactivate them. Your own account and the last Super Admin are skipped." },
        ]}
      />
      <ListPanel
        title="All users"
        meta={showing(data.page, 25, data.total)}
        filters={
          <FilterBar action="/admin/users" bare oneLine>
            <SearchField defaultValue={sp.q} placeholder="Search name or email…" />
            <SelectField name="roleId" label="Role" value={sp.roleId}>
              <option value="">All roles</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </SelectField>
            <SelectField name="status" label="Status" value={sp.status}>
              <option value="">Any status</option><option value="ACTIVE">Active</option><option value="INVITED">Invited</option><option value="SUSPENDED">Suspended</option>
            </SelectField>
          </FilterBar>
        }
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/users" params={sp} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<Users className="h-5 w-5" />} title="No users match">Try another role or status.</PanelEmpty>
        ) : (
          <AdminTable bare>
            <thead><tr><th className="w-10"><AllCheckbox ids={data.items.filter((u) => u.id !== user.id).map((u) => u.id)} /></th><th>Name</th><th>Role</th><th>Status</th><th>Two-step</th><th className="text-right">Active sessions</th><th>Last sign-in</th></tr></thead>
            <tbody>
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.id !== user.id && <RowCheckbox id={u.id} label={u.name} />}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg text-xs font-bold text-ink ring-1 ring-line" aria-hidden>{u.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
                      <span className="min-w-0">
                        <Link href={`/admin/users/${u.id}`} className="block truncate font-semibold text-ink hover:text-mint-ink">{u.name}</Link>
                        <span className="block truncate text-xs text-muted">{u.email}</span>
                      </span>
                    </div>
                  </td>
                  <td>{u.role.name}{u.vendor && <span className="block text-xs text-muted">{u.vendor.name}</span>}</td>
                  <td><Badge tone={u.status === "ACTIVE" ? "success" : u.status === "INVITED" ? "warning" : "danger"}>{u.status === "INVITED" && u.role.key === "BUYER" ? "Email not confirmed" : u.status.charAt(0) + u.status.slice(1).toLowerCase()}</Badge></td>
                  <td>{u.totpEnabledAt ? <Badge tone="success">On</Badge> : <Badge tone="neutral">{u.role.key === "BUYER" ? "Optional · off" : u.status === "ACTIVE" ? "At next sign-in" : "Not yet"}</Badge>}</td>
                  <td className="text-right font-semibold tabular-nums">{u._count.sessions}</td>
                  <td className="whitespace-nowrap text-muted" title={u.lastLoginAt ? relativeTime(u.lastLoginAt) : undefined}>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
