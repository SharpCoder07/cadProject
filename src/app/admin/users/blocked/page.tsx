import Link from "next/link";
import { Ban, Globe, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { FIRST_ROUND, SECOND_ROUND, listBlockedSignIns } from "@/server/auth/login-guard";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { AdminTable, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PillTabs, SearchField, showingAll } from "@/components/admin/list-panel";
import { FilterBar } from "@/components/admin/page-header";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { unblockEmailAction, unblockNetworkAction } from "../actions";
import { UnblockButton } from "./unblock-button";

export const metadata = { title: "Blocked sign-ins" };
export const dynamic = "force-dynamic";

const STATE = {
  blocked: { label: "Blocked 24 hours", tone: "danger" },
  locked: { label: "Locked 15 minutes", tone: "warning" },
  failing: { label: "Wrong attempts", tone: "neutral" },
} as const;

export default async function BlockedSignInsPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string }> }) {
  const user = await requirePermission("users.view", "/admin/users/blocked");
  const sp = await searchParams;
  const view = sp.view === "networks" ? "networks" : "emails";
  const q = (sp.q ?? "").trim().toLowerCase();
  const data = await listBlockedSignIns(user);
  const emails = q ? data.emails.filter((e) => e.email.includes(q) || e.user?.name.toLowerCase().includes(q)) : data.emails;
  const networks = q ? data.networks.filter((n) => n.email?.includes(q) || n.hint?.includes(q) || n.user?.name.toLowerCase().includes(q)) : data.networks;
  const blocked = data.emails.filter((e) => e.state === "blocked").length;
  const locked = data.emails.filter((e) => e.state === "locked").length;

  return (
    <SelectionProvider key={view}>
      <PageHeader
        title="Blocked sign-ins"
        description={`After ${FIRST_ROUND} wrong passwords an account is locked for 15 minutes; ${SECOND_ROUND} more wrong passwords block the email and the network for 24 hours. Unblock someone here once you're sure it's them.`}
        back={{ href: "/admin/users", label: "Users" }}
      />
      <PageStats
        items={[
          { label: "Blocked emails", value: blocked, icon: Ban, tone: blocked ? "red" : "neutral", sub: "24-hour block" },
          { label: "Locked accounts", value: locked, icon: LockKeyhole, sub: "15-minute lock" },
          { label: "Blocked networks", value: data.networks.length, icon: Globe, tone: data.networks.length ? "red" : "neutral", sub: "IP addresses, 24 hours" },
          { label: "Wrong attempts", value: data.emails.filter((e) => e.state === "failing").length, icon: KeyRound, sub: "Emails with recent wrong passwords" },
        ]}
      />
      <BulkActionBar
        noun={view === "emails" ? "email" : "network"}
        items={[
          view === "emails"
            ? { label: "Unblock", action: unblockEmailAction, done: "Unblocked", confirm: "Their wrong-attempt count, lock and 24-hour block are cleared, and the networks blocked on these emails are unblocked." }
            : { label: "Unblock", action: unblockNetworkAction, done: "Unblocked", confirm: "People on these networks can try to sign in again." },
        ]}
      />
      <ListPanel
        title={view === "emails" ? "Emails" : "Blocked networks"}
        meta={showingAll(view === "emails" ? emails.length : networks.length)}
        tabs={
          <PillTabs
            items={[
              { href: "/admin/users/blocked", label: "Emails", count: data.emails.length, active: view === "emails" },
              { href: "/admin/users/blocked?view=networks", label: "Networks", count: data.networks.length, active: view === "networks" },
            ]}
          />
        }
        filters={
          <FilterBar action="/admin/users/blocked" bare oneLine>
            {view === "networks" && <input type="hidden" name="view" value="networks" />}
            <SearchField defaultValue={sp.q} placeholder={view === "emails" ? "Search email or name…" : "Search email, name or address…"} />
          </FilterBar>
        }
      >
        {view === "emails" ? (
          emails.length === 0 ? (
            <PanelEmpty icon={<ShieldCheck className="h-5 w-5" />} title="Nobody is locked or blocked">Emails with wrong passwords in the last day show up here.</PanelEmpty>
          ) : (
            <AdminTable bare>
              <thead><tr><th className="w-10"><AllCheckbox ids={emails.map((e) => e.email)} /></th><th>Email</th><th>Status</th><th>Until</th><th className="text-right">Blocked networks</th><th>Last attempt</th><th className="w-px" /></tr></thead>
              <tbody>
                {emails.map((e) => (
                  <tr key={e.email}>
                    <td><RowCheckbox id={e.email} label={e.email} /></td>
                    <td>
                      {e.user ? <Link href={`/admin/users/${e.user.id}`} className="block font-semibold text-ink hover:text-mint-ink">{e.user.name}</Link> : <span className="block font-semibold text-muted">No account</span>}
                      <span className="block text-xs text-muted">{e.email}{e.user ? ` · ${e.user.role.name}` : ""}</span>
                    </td>
                    <td>
                      <Badge tone={STATE[e.state].tone}>{STATE[e.state].label}</Badge>
                      {e.state === "failing" && <span className="mt-1 block text-xs text-muted">{e.attemptsLeft} attempt{e.attemptsLeft === 1 ? "" : "s"} left{e.round === 2 ? " (after a lock)" : ""}</span>}
                    </td>
                    <td className="whitespace-nowrap text-muted">{e.until ? formatDateTime(e.until) : "—"}</td>
                    <td className="text-right font-semibold tabular-nums">{e.networks}</td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(e.lastAttempt)}</td>
                    <td className="text-right"><UnblockButton id={e.email} kind="email" /></td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          )
        ) : networks.length === 0 ? (
          <PanelEmpty icon={<Globe className="h-5 w-5" />} title="No blocked networks">Networks are blocked for 24 hours after {FIRST_ROUND + SECOND_ROUND} wrong passwords, or for trying an email that's already blocked.</PanelEmpty>
        ) : (
          <AdminTable bare>
            <thead><tr><th className="w-10"><AllCheckbox ids={networks.map((n) => n.id)} /></th><th>Network</th><th>Email tried</th><th>Reason</th><th>Blocked</th><th>Until</th><th className="w-px" /></tr></thead>
            <tbody>
              {networks.map((n) => (
                <tr key={n.id}>
                  <td><RowCheckbox id={n.id} label={n.hint ?? "Network"} /></td>
                  <td><span className="font-mono text-sm font-semibold text-ink">{n.hint ?? "Address not recorded"}</span></td>
                  <td>
                    {n.user ? <Link href={`/admin/users/${n.user.id}`} className="block font-medium text-ink hover:text-mint-ink">{n.user.name}</Link> : null}
                    <span className="block text-xs text-muted">{n.email ?? "—"}{n.email && !n.user ? " · no account" : ""}</span>
                  </td>
                  <td className="text-sm text-muted">{n.reason}</td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(n.since)}</td>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(n.until)}</td>
                  <td className="text-right"><UnblockButton id={n.id} kind="network" /></td>
                </tr>
              ))}
            </tbody>
          </AdminTable>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
