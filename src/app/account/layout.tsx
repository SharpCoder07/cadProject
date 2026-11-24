import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { homeFor, isBuyerRoleKey } from "@/server/rbac/permissions";
import { AdminThemeStyle } from "@/components/admin/theme";
import { ToastProvider } from "@/components/ui/toast";
import { AdminShell } from "@/components/admin/shell";
import type { AdminNavGroup } from "@/components/admin/nav";
import { buyerLogoutAction } from "@/app/(auth)/actions";
import { LegalUpdateNotice } from "@/components/compliance/legal-update-notice";

export const metadata = { title: { default: "My account", template: "%s · My account" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Buyer panel: same shell as the admin panel and vendor portal (sidebar, top bar, light/dark). */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/account");
  // Staff and vendor accounts have their own areas.
  if (!isBuyerRoleKey(user.roleKey)) redirect(homeFor(user.roleKey, user.vendorId));
  const now = new Date();
  const [settings, me, liveOffers, cookieStore] = await Promise.all([
    getSettings(),
    db.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } }),
    db.productOffer.count({
      where: { status: "PUBLISHED", startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }], software: { status: "PUBLISHED", favouritedBy: { some: { userId: user.id } } } },
    }),
    cookies(),
  ]);
  const groups: AdminNavGroup[] = [
    { label: "", items: [{ label: "Dashboard", href: "/account", icon: "dashboard", permission: "buyer.account" }] },
    {
      label: "Your activity",
      items: [
        { label: "Favourites", href: "/account/favourites", icon: "favourites", permission: "buyer.account", badge: liveOffers || undefined },
        { label: "My reviews", href: "/account/reviews", icon: "reviews", permission: "buyer.account" },
      ],
    },
    {
      label: "Settings",
      items: [
        { label: "Notifications", href: "/account/notifications", icon: "bell", permission: "buyer.account" },
        { label: "Email notifications", href: "/account/notifications/email", icon: "email", permission: "buyer.account" },
        { label: "Account settings", href: "/account/settings", icon: "settings", permission: "buyer.account" },
        { label: "Privacy center", href: "/account/privacy", icon: "privacy", permission: "buyer.account" },
      ],
    },
  ];
  return (
    <ToastProvider>
      <AdminThemeStyle />
      <AdminShell
        groups={groups}
        createItems={[]}
        site={{ name: settings.site.name, logoUrl: settings.site.logoUrl || null, iconUrl: settings.site.faviconUrl || null }}
        user={{ name: user.name, email: user.email, role: "Buyer account", avatarUrl: me?.avatarUrl ?? null }}
        initialCollapsed={cookieStore.get("admin_sidebar")?.value === "collapsed"}
        initialTheme={cookieStore.get("admin_theme")?.value === "dark" ? "dark" : "light"}
        signOut={buyerLogoutAction}
        homeHref="/account"
        workspaceLabel="My account"
        accountHref="/account/settings"
      >
        <LegalUpdateNotice user={user} texts={settings.texts} />
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
