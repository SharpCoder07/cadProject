import { cookies, headers } from "next/headers";
import { Eye } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { DELETE_PERMISSIONS, isBuyerRoleKey } from "@/server/rbac/permissions";
import { isSuperAdmin } from "@/server/rbac/policy";
import { DeleteRightsProvider } from "@/components/ui/delete-rights";
import { pendingErrorCount } from "@/server/error-log";
import { getSettings } from "@/server/settings";
import { AdminThemeStyle } from "@/components/admin/theme";
import { ToastProvider } from "@/components/ui/toast";
import { AdminShell } from "@/components/admin/shell";
import { ADMIN_NAV, CREATE_ITEMS, filterNav } from "@/components/admin/nav";
import { logoutAction } from "@/app/(auth)/actions";
import { pendingApprovalSummary } from "@/server/services/approvals";
import { pendingReviewSummary } from "@/server/services/reviews";
import { pendingQuestionSummary } from "@/server/services/questions";
import { guideIndex } from "@/lib/editing-guide";
import { adminHrefPermission } from "@/lib/admin-href-permission";
import { pendingSoftwareReviewSummary } from "@/server/services/software";

const ACTION_TEXT: Record<string, string> = { CREATE: "Publish new", UPDATE: "Edit", DELETE: "Delete", PUBLISH: "Re-publish", UNPUBLISH: "Unpublish", PASSWORD: "Reset password" };

export const metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

const roleLabel = (key: string) => key.toLowerCase().split("_").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  if (user.vendorId) redirect("/vendor");
  if (isBuyerRoleKey(user.roleKey)) redirect("/account");
  const [settings, profile, cookieStore, pending, reviews, listings, questions, pendingErrors] = await Promise.all([
    getSettings(),
    db.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true, role: { select: { name: true } } } }),
    cookies(),
    pendingApprovalSummary(user),
    pendingReviewSummary(user),
    pendingSoftwareReviewSummary(user),
    pendingQuestionSummary(user),
    pendingErrorCount(user),
  ]);
  const canPublish = user.permissions.has("software.publish");
  const canApprove = user.permissions.has("approvals.manage");
  const canModerate = user.permissions.has("reviews.moderate");
  const groups = filterNav(ADMIN_NAV, (p) => user.permissions.has(p)).map((g) => ({
    ...g,
    items: g.items.map((i) =>
      i.href === "/admin/approvals"
        ? { ...i, badge: pending.count }
        : i.children
          ? { ...i, children: i.children.map((c) => (c.href === "/admin/reviews" ? { ...c, badge: reviews.count } : c.href === "/admin/questions" ? { ...c, badge: questions.count } : c.href === "/admin/software" ? { ...c, badge: listings.count } : c.href === "/admin/logs/errors" ? { ...c, badge: pendingErrors } : c)) }
          : i,
    ),
  }));
  // Bell: everything waiting for this person's approval (vendor requests, reviews, listings submitted for review), newest first.
  const notifications =
    canApprove || canModerate || canPublish
      ? {
          count: pending.count + reviews.count + listings.count + questions.count,
          items: [
            ...pending.latest.map((r) => ({ id: `a-${r.id}`, title: `${ACTION_TEXT[r.action] ?? r.action}: ${r.entityLabel}`, meta: `${r.vendor.name} · vendor request`, href: `/admin/approvals/${r.id}`, createdAt: r.createdAt.toISOString() })),
            ...reviews.latest.map((r) => ({ id: `r-${r.id}`, title: `New ${r.rating}★ review: ${r.software.name}`, meta: `${r.authorName} · review to approve`, href: "/admin/reviews?status=PENDING", createdAt: r.createdAt.toISOString() })),
            ...questions.latest.map((q) => ({ id: `q-${q.id}`, title: `New question: ${q.software.name}`, meta: `${q.authorName} · “${q.question.slice(0, 60)}${q.question.length > 60 ? "…" : ""}”`, href: "/admin/questions", createdAt: q.createdAt.toISOString() })),
            ...listings.latest.map((s) => ({ id: `s-${s.id}`, title: `Submitted for review: ${s.name}`, meta: `${s.updatedBy?.name ?? "Staff"} · listing to publish`, href: `/admin/software/${s.id}`, createdAt: s.updatedAt.toISOString() })),
          ]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 8),
          links: [
            ...(canApprove ? [{ label: "Approvals", href: "/admin/approvals", count: pending.count }] : []),
            ...(canModerate ? [{ label: "Reviews", href: "/admin/reviews?status=PENDING", count: reviews.count }] : []),
            ...(canModerate && questions.count ? [{ label: "Questions", href: "/admin/questions", count: questions.count }] : []),
            ...(canPublish && listings.count ? [{ label: "Listings", href: "/admin/software?status=IN_REVIEW", count: listings.count }] : []),
          ],
        }
      : null;
  const embedded = (await headers()).get("x-cg-embed") === "1";
  // "Where do I change…?" search: Editing guide rows this person can open.
  const homePage = await db.page.findFirst({ where: { slug: "home" }, select: { id: true } }).catch(() => null);
  const guide = guideIndex(homePage ? `/admin/cms/pages/${homePage.id}` : "/admin/cms/pages").filter((g) => {
    const p = adminHrefPermission(g.href);
    return !p || user.permissions.has(p as never);
  });
  const createItems = CREATE_ITEMS.filter((c) => user.permissions.has(c.permission)).map((c) => ({ label: c.label, href: c.href, icon: c.icon }));
  return (
    <ToastProvider>
      <AdminThemeStyle />
      <AdminShell
        groups={groups}
        createItems={createItems}
        site={{ name: settings.site.adminName || settings.site.name, logoUrl: settings.site.logoUrl || null, iconUrl: settings.site.faviconUrl || null }}
        user={{ name: user.name, email: user.email, role: profile?.role.name ?? roleLabel(user.roleKey), avatarUrl: profile?.avatarUrl ?? null }}
        notifications={notifications}
        workspaceLabel={settings.site.adminLabel || "Admin workspace"}
        initialCollapsed={cookieStore.get("admin_sidebar")?.value === "collapsed"}
        initialTheme={cookieStore.get("admin_theme")?.value === "dark" ? "dark" : "light"}
        signOut={logoutAction}
        embedded={embedded}
        guide={guide}
      >
        {user.readOnly && (
          <div className="mb-4 flex items-center gap-2.5 rounded-panel border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm text-ink" role="status">
            <Eye className="h-4 w-4 shrink-0 text-[#B45309] dark:text-amber-300" aria-hidden />
            <span><span className="font-semibold">View-only access.</span> You can open every page, but changes won&apos;t be saved.</span>
          </div>
        )}
        <DeleteRightsProvider superAdmin={isSuperAdmin(user)} deletes={DELETE_PERMISSIONS.filter((p) => user.permissions.has(p))} binDays={settings.rules.binDays ?? 30}>{children}</DeleteRightsProvider>
      </AdminShell>
    </ToastProvider>
  );
}
