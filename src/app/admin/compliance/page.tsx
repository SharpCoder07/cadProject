import Link from "next/link";
import { AlertTriangle, Archive, ArrowRight, CheckCircle2, ClipboardCheck, Cookie, FileText, Handshake, Inbox, MessageSquareWarning, Scale, ShieldAlert, ShieldCheck, Flag } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { complianceOverview } from "@/server/services/compliance/overview";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/page-header";

export const metadata = { title: "Compliance overview" };

/** Compliance & Privacy › Overview. */
export default async function ComplianceOverviewPage() {
  const user = await requirePermission("compliance.view", "/admin/compliance");
  const o = await complianceOverview(user);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const tiles = [
    { href: "/admin/compliance/requests", icon: Inbox, label: "Data requests", value: o.cases.open.DATA_REQUEST ?? 0, sub: o.cases.late.DATA_REQUEST ? `${o.cases.late.DATA_REQUEST} past target` : "open", bad: Boolean(o.cases.late.DATA_REQUEST) },
    { href: "/admin/compliance/grievances", icon: MessageSquareWarning, label: "Grievances", value: o.cases.open.GRIEVANCE ?? 0, sub: o.cases.late.GRIEVANCE ? `${o.cases.late.GRIEVANCE} past target` : "open", bad: Boolean(o.cases.late.GRIEVANCE) },
    { href: "/admin/compliance/content", icon: Flag, label: "Content complaints", value: o.cases.open.CONTENT_COMPLAINT ?? 0, sub: o.cases.late.CONTENT_COMPLAINT ? `${o.cases.late.CONTENT_COMPLAINT} past target` : "open", bad: Boolean(o.cases.late.CONTENT_COMPLAINT) },
    ...(o.incidents ? [{ href: "/admin/compliance/incidents", icon: ShieldAlert, label: "Security incidents", value: o.incidents.open, sub: o.incidents.undecided ? `${o.incidents.undecided} reporting decision pending` : "open", bad: o.incidents.undecided > 0 }] : []),
    { href: "/admin/compliance/legal", icon: FileText, label: "Legal documents in force", value: `${o.legal.inForce}/${o.legal.total}`, sub: o.legal.unreviewed ? `${o.legal.unreviewed} not reviewed` : "documents", bad: false },
    { href: "/admin/compliance/consent", icon: ClipboardCheck, label: "Optional consents given", value: o.consents, sub: "currently active", bad: false },
    { href: "/admin/compliance/cookies", icon: Cookie, label: "Cookie choices (30 days)", value: o.cookies.total, sub: o.cookies.total ? `${pct(o.cookies.accepted, o.cookies.total)}% accepted all · ${pct(o.cookies.rejected, o.cookies.total)}% rejected` : "none yet", bad: false },
    { href: "/admin/compliance/retention", icon: Archive, label: "Retention rules on", value: `${o.retention.active}/${o.retention.total}`, sub: "run daily", bad: false },
    { href: "/admin/compliance/vendors", icon: Handshake, label: "Vendors without data terms", value: o.vendorsNoDpa, sub: "receiving leads", bad: o.vendorsNoDpa > 0 },
    { href: "/admin/compliance/security", icon: ShieldCheck, label: "Security controls", value: `${o.security.ok}/${o.security.total}`, sub: "in place", bad: false },
    { href: "/admin/compliance/settings", icon: Scale, label: "Timelines set", value: `${o.settings.timelinesSet}/5`, sub: o.settings.legalReviewDone ? "legally reviewed" : "not legally reviewed", bad: false },
  ];
  return (
    <>
      <PageHeader title="Compliance overview" description="What's in place and what needs attention across privacy requests, complaints, legal documents, consent, retention, incidents and vendors." />
      <section aria-labelledby="att" className="mb-6 rounded-2xl border border-line bg-surface">
        <h2 id="att" className="flex items-center gap-2 border-b border-line px-5 py-3 text-sm font-semibold text-ink">
          {o.attention.length ? <AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> : <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />}
          Needs attention {o.attention.length ? `(${o.attention.length})` : ""}
        </h2>
        {o.attention.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">Nothing right now.</p>
        ) : (
          <ul className="divide-y divide-line">
            {o.attention.map((a) => (
              <li key={a.text}>
                <Link href={a.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-bg">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", a.tone === "danger" ? "bg-danger" : "bg-warning")} aria-hidden />
                  <span className="flex-1 text-ink">{a.text}</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map(({ href, icon: Icon, label, value, sub, bad }) => (
          <Link key={href} href={href} className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary/40">
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", bad ? "bg-danger/10 text-danger" : "bg-primary-soft text-primary")}><Icon className="h-5 w-5" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-2xl font-bold tabular-nums text-ink">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</span>
              <span className="block text-sm font-medium text-ink">{label}</span>
              <span className={cn("block text-xs", bad ? "font-semibold text-danger" : "text-muted")}>{sub}</span>
            </span>
          </Link>
        ))}
      </div>
      <p className="mt-6 text-xs text-muted">Software helps you run these processes; it doesn&apos;t make the platform compliant on its own. Items marked “legal review” need confirming with an Indian privacy or technology lawyer.</p>
    </>
  );
}
