import { KeyRound, ShieldCheck, UserCog, Users } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { listRoles } from "@/server/services/users";
import { MODULES, PERMISSIONS, SUPER_ONLY, moduleOf, type Permission } from "@/server/rbac/permissions";
import { isSuperAdmin } from "@/server/rbac/policy";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { NewRoleButton, RoleEditor } from "./role-editor";

export const metadata = { title: "Roles & permissions" };

export default async function RolesPage() {
  const user = await requirePermission("users.view", "/admin/roles");
  // Super Admin first, then Admin; the other roles keep their usual order.
  const TOP = ["SUPER_ADMIN", "ADMIN"];
  const rank = (key: string) => (TOP.includes(key) ? TOP.indexOf(key) : TOP.length);
  const roles = (await listRoles(user)).map((r, i) => ({ r, i })).sort((a, b) => rank(a.r.key) - rank(b.r.key) || a.i - b.i).map(({ r }) => r);
  // The module × action matrix, and the permissions outside it (vendor portal, buyer, demo).
  const short = (p: Permission): string => PERMISSIONS[p].split(/ \(|, and | — /)[0] ?? PERMISSIONS[p];
  const modules = MODULES.filter((m) => !m.superOnly).map((m) => ({
    key: m.key, label: m.label, section: m.section, view: m.view ?? null, create: m.create ?? null, edit: m.edit ?? null, delete: m.delete ?? null,
    extras: (m.extras ?? []).map((k) => ({ key: k, label: k === "site.editMode" ? "Edit on the website" : short(k) })),
  }));
  const GROUP = (p: string) => (p.startsWith("vendor.") ? "Vendor portal" : p.startsWith("buyer.") ? "Website buyers" : "Other");
  const other = (Object.keys(PERMISSIONS) as Permission[]).filter((k) => !SUPER_ONLY.includes(k) && !moduleOf(k)).map((key) => ({ key, label: PERMISSIONS[key], group: GROUP(key) }));
  const catalogue = [...modules.flatMap((m) => [m.view, m.create, m.edit, m.delete, ...m.extras.map((x) => x.key)].filter(Boolean)), ...other];
  const canEdit = isSuperAdmin(user);
  return (
    <>
      <PageHeader title="Roles & permissions" description={canEdit ? "What each role can view, create, edit and delete. Only you (Super Admin) can change this." : "What each role can do. Only the Super Admin can change roles and permissions."} actions={canEdit && <NewRoleButton />} />
      <PageStats
        items={[
          { label: "Roles", value: roles.length, icon: ShieldCheck, tone: "red", sub: `${roles.filter((r) => r.isSystem).length} built-in` },
          { label: "Custom roles", value: roles.filter((r) => !r.isSystem).length, icon: UserCog, sub: "Created by your team" },
          { label: "People with a role", value: roles.reduce((n, r) => n + r._count.users, 0), icon: Users, tone: "green", sub: "Staff, vendors and buyers" },
          { label: "Permissions", value: catalogue.length, icon: KeyRound, sub: "Available to assign" },
        ]}
      />
      <RoleEditor canEdit={canEdit} modules={modules} other={other} roles={roles.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, isSystem: r.isSystem, users: r._count.users, permissions: r.permissions.map((p) => p.permission.key) }))} />
    </>
  );
}
