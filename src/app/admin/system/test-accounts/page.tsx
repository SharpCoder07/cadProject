import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyRound, TriangleAlert } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { verifyPassword } from "@/server/auth/password";
import { formatDateTime } from "@/lib/format";
import { Alert, Badge, Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Test accounts" };
export const dynamic = "force-dynamic";

/**
 * TEMPORARY (local testing): the demo sign-ins created by `npm run db:seed`. Super Admin only, and
 * not available in production. Delete this folder and its sidebar link before going live.
 * The real Super Admin password is never shown: it lives in .env (SEED_ADMIN_PASSWORD).
 */
const DEMO_PASSWORD = "Demo-Password-2026";
const ACCOUNTS: { tab: "Team" | "Vendor" | "Reseller" | "Buyer"; email: string; who: string; admin?: boolean }[] = [
  { tab: "Team", email: "admin@cadgram.local", who: "Super Admin — full access", admin: true },
  { tab: "Team", email: "editor@cadgram.local", who: "Riya — Content Editor" },
  { tab: "Team", email: "catalogue@cadgram.local", who: "Aman — Product Manager" },
  { tab: "Team", email: "sales@cadgram.local", who: "Sana — Sales Manager (leads)" },
  { tab: "Team", email: "analyst@cadgram.local", who: "Dev — Read-only Analyst" },
  { tab: "Vendor", email: "vendor@ledgerline.example.com", who: "Ledgerline — Vendor Admin" },
  { tab: "Vendor", email: "editor@ledgerline.example.com", who: "Ledgerline — Vendor Editor" },
  { tab: "Vendor", email: "viewer@ledgerline.example.com", who: "Ledgerline — Vendor Viewer" },
  { tab: "Reseller", email: "reseller@shreetech.example.com", who: "Shree Tech — Reseller Admin" },
  { tab: "Buyer", email: "buyer@cadgram.example.com", who: "Demo buyer (website account)" },
];

export default async function TestAccountsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  await requirePermission("system.manage", "/admin/system/test-accounts");
  const users = await db.user.findMany({ where: { email: { in: ACCOUNTS.map((a) => a.email) } }, select: { id: true, email: true, status: true, passwordHash: true, lastLoginAt: true, totpEnabledAt: true, role: { select: { name: true } } } });
  const byEmail = new Map(users.map((u) => [u.email, u]));
  // Checks whether each account still uses the demo password (it may have been changed while testing).
  const still = new Map(await Promise.all(users.map(async (u) => [u.email, u.passwordHash ? await verifyPassword(u.passwordHash, DEMO_PASSWORD) : false] as const)));

  return (
    <>
      <PageHeader title="Test accounts" description="Sign-ins for testing the admin panel, vendor and reseller portals and the website. Only on your computer; this page doesn't exist on the live site." />
      <Alert tone="warning" className="mb-4" title="Temporary page">
        Remove it before going live (folder <code>src/app/admin/system/test-accounts</code> and its sidebar link), and delete or change these accounts on the live database.
      </Alert>
      <Panel>
        <PanelHeader title="Demo sign-ins" description={<>Sign in at <Link href="/login" target="_blank" className="font-semibold text-mint-ink hover:underline">/login</Link> and pick the matching tab. Team, vendor and reseller accounts set up an authenticator app on their first sign-in.</>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="bg-bg/60 text-left text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              <tr><th className="px-5 py-3">Sign-in tab</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Password</th><th className="px-5 py-3">Who</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last sign-in</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ACCOUNTS.map((a) => {
                const u = byEmail.get(a.email);
                const demo = still.get(a.email);
                return (
                  <tr key={a.email} className="align-top">
                    <td className="px-5 py-3"><Badge>{a.tab}</Badge></td>
                    <td className="px-5 py-3">{u ? <Link href={`/admin/users/${u.id}`} className="font-mono text-[13px] text-ink hover:text-mint-ink">{a.email}</Link> : <span className="font-mono text-[13px] text-muted">{a.email}</span>}</td>
                    <td className="px-5 py-3">
                      {a.admin ? (
                        <span className="text-muted">Your <code className="rounded bg-bg px-1">SEED_ADMIN_PASSWORD</code> in .env</span>
                      ) : !u ? (
                        <span className="text-muted">—</span>
                      ) : demo ? (
                        <code className="inline-flex items-center gap-1.5 rounded bg-mint-soft px-2 py-0.5 font-mono text-[13px] text-mint-ink"><KeyRound className="h-3.5 w-3.5" aria-hidden />{DEMO_PASSWORD}</code>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-warning"><TriangleAlert className="h-3.5 w-3.5" aria-hidden /> Changed while testing</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink">{a.who}{u && <span className="block text-xs text-muted">{u.role.name}{u.totpEnabledAt ? " · two-step on" : " · two-step not set up"}</span>}</td>
                    <td className="px-5 py-3">{u ? <Badge tone={u.status === "ACTIVE" ? "success" : u.status === "SUSPENDED" ? "danger" : "accent"}>{u.status.charAt(0) + u.status.slice(1).toLowerCase()}</Badge> : <span className="text-xs text-muted">Not in the database (run npm run db:seed)</span>}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{u?.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Never"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="mt-3 text-xs text-muted">Lost an authenticator? Reset two-step on the user's page (Security tab), or run <code>npm run auth:reset-2fa -- &lt;email&gt;</code>.</p>
    </>
  );
}
