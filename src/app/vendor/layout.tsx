import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { AdminThemeStyle } from "@/components/admin/theme";
import { ToastProvider } from "@/components/ui/toast";
import { logoutAction } from "@/app/(auth)/actions";
import { AdminShell } from "@/components/admin/shell";
import { PortalAddress } from "@/components/vendor/portal-address";
import { LegalUpdateNotice } from "@/components/compliance/legal-update-notice";
import type { AdminNavGroup } from "@/components/admin/nav";
import { isBuyerRoleKey, type Permission } from "@/server/rbac/permissions";

export const metadata = { title: { default: "Partner portal", template: "%s · Partner portal" }, robots: { index: false, follow: false } };

export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/vendor");
  if (!user.vendorId || !user.permissions.has("vendor.portal")) redirect(isBuyerRoleKey(user.roleKey) ? "/account" : "/admin");
  const [settings, vendor] = await Promise.all([getSettings(), db.vendor.findUnique({ where: { id: user.vendorId }, select: { name: true, receivesLeads: true, kind: true } })]);
  const reseller = vendor?.kind === "RESELLER";
  /** Resellers see the portal at /reseller/… (same pages, rewritten in middleware). */
  const base = reseller ? "/reseller" : "/vendor";
  const has = (p: Permission) => user.permissions.has(p);
  const canLeads = Boolean(vendor?.receivesLeads) && has("vendor.leads");
  const [pending, me] = await Promise.all([
    db.approvalRequest.count({ where: { vendorId: user.vendorId, status: "PENDING" } }),
    db.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true, leadsSeenAt: true } }),
  ]);
  // New leads since this person last opened Leads (or the last 14 days the first time): bell + Leads badge.
  const leadScope: Prisma.LeadWhereInput = {
    ...(reseller ? { resellers: { some: { resellerId: user.vendorId } } } : { vendorId: user.vendorId }),
    status: { not: "SPAM" },
    createdAt: { gt: me?.leadsSeenAt ?? new Date(Date.now() - 14 * 86_400_000) },
  };
  const [newLeads, latestLeads] = canLeads
    ? await Promise.all([
        db.lead.count({ where: leadScope }),
        db.lead.findMany({ where: leadScope, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, company: true, city: true, createdAt: true, software: { select: { software: { select: { name: true } } } } } }),
      ])
    : [0, []];
  const groups: AdminNavGroup[] = [
    { label: "", items: [{ label: "Dashboard", href: base, icon: "dashboard", permission: "vendor.portal" }] },
    {
      label: "Your company",
      items: [
        ...(!reseller && has("vendor.listings") ? [{ label: "Products", href: `${base}/listings`, icon: "software", permission: "vendor.listings" as const }] : []),
        ...(reseller ? [{ label: "Browse products", href: `${base}/browse`, icon: "boxes", permission: "vendor.portal" as const }, { label: "Authorised products", href: `${base}/authorised`, icon: "software", permission: "vendor.portal" as const }] : []),
        { label: "Approval requests", href: `${base}/requests`, icon: "approvals", permission: "vendor.portal", badge: pending },
        ...(!reseller && has("vendor.offers") ? [{ label: "Offers", href: `${base}/offers`, icon: "offers", permission: "vendor.offers" as const }] : []),
        ...(!reseller && has("vendor.reviews") ? [{ label: "Reviews", href: `${base}/reviews`, icon: "reviews", permission: "vendor.reviews" as const }] : []),
        ...(canLeads ? [{ label: "Leads", icon: "leads", permission: "vendor.leads" as const, children: [{ label: "All leads", href: `${base}/leads`, permission: "vendor.leads" as const, icon: "leads", badge: newLeads }, { label: "Lead reports", href: `${base}/leads/reports`, permission: "vendor.leads" as const, icon: "reports" }] }] : []),
        ...(has("media.manage") ? [{ label: "Media library", href: `${base}/media`, icon: "media", permission: "media.manage" as const }] : []),
      ],
    },
    {
      label: "Settings",
      items: [
        { label: "Company profile", href: `${base}/profile`, icon: "vendors", permission: "vendor.portal" },
        { label: "Notifications", href: `${base}/notifications`, icon: "bell", permission: "vendor.portal" },
        { label: "Email notifications", href: `${base}/notifications/email`, icon: "email", permission: "vendor.portal" },
        { label: "Plans & billing", href: `${base}/plans`, icon: "billing", permission: "vendor.portal" },
        ...(has("vendor.team") ? [{ label: "Team", href: `${base}/team`, icon: "users", permission: "vendor.team" as const }] : []),
      ],
    },
  ];
  const createItems = reseller
    ? has("vendor.authorised") ? [{ label: "Find products to resell", href: `${base}/browse`, icon: "software" }] : []
    : has("vendor.listings.submit") ? [{ label: "Add a product", href: `${base}/listings/new`, icon: "software" }] : [];
  return (
    <ToastProvider>
      <AdminThemeStyle />
      <AdminShell
        groups={groups}
        createItems={createItems}
        site={{ name: settings.site.name, logoUrl: settings.site.logoUrl || null, iconUrl: settings.site.faviconUrl || null }}
        user={{ name: user.name, email: user.email, role: vendor?.name ?? (reseller ? "Reseller" : "Vendor"), avatarUrl: me?.avatarUrl ?? null }}
        initialCollapsed={(await cookies()).get("admin_sidebar")?.value === "collapsed"}
        initialTheme={(await cookies()).get("admin_theme")?.value === "dark" ? "dark" : "light"}
        notifications={
          canLeads || pending
            ? {
                count: newLeads,
                items: latestLeads.map((l) => ({
                  id: `l-${l.id}`,
                  title: `New lead: ${l.software.map((s) => s.software.name).join(", ") || "General enquiry"}`,
                  meta: [l.name, l.company, l.city].filter(Boolean).join(" · "),
                  href: `${base}/leads/${l.id}`,
                  createdAt: l.createdAt.toISOString(),
                })),
                links: [
                  ...(canLeads ? [{ label: "Leads", href: `${base}/leads`, count: newLeads }] : []),
                  ...(pending ? [{ label: "Approval requests", href: `${base}/requests?status=PENDING`, count: pending }] : []),
                ],
              }
            : null
        }
        signOut={logoutAction}
        homeHref={base}
        workspaceLabel={reseller ? "Reseller portal" : "Vendor portal"}
        accountHref={`${base}/account`}
      >
        <PortalAddress reseller={reseller} />
        <LegalUpdateNotice user={user} texts={settings.texts} />
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
