import Link from "next/link";
import { BellOff, Mail, MailCheck, Send } from "lucide-react";
import type { MyEmails } from "@/server/services/my-notifications";
import { Alert, Badge } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel } from "@/components/admin/list-panel";

/** "Email notifications" page body, shared by the admin panel, vendor portal and buyer account. */
export function EmailNotificationsView({ data, email }: { data: MyEmails; email: string }) {
  const on = data.items.filter((i) => i.state === "on").length;
  return (
    <>
      <PageHeader
        title="Email notifications"
        description={`Every email we send you and when, sent to ${email}.`}
      />
      {data.delivery.mode !== "smtp" && (
        <Alert tone="warning" className="mb-4" title={data.delivery.mode === "off" ? "Email sending is switched off" : "Email isn't set up yet"}>
          {data.delivery.message}
        </Alert>
      )}
      <PageStats
        items={[
          { label: "Emails on", value: on, icon: MailCheck, tone: "green", sub: `of ${data.items.length} for your account` },
          { label: "Emails off", value: data.items.length - on, icon: BellOff, sub: "You won't receive these" },
          { label: "Email delivery", value: data.delivery.mode === "smtp" ? "Working" : data.delivery.mode === "off" ? "Off" : "Not set up", icon: Send, tone: data.delivery.mode === "smtp" ? "neutral" : "amber", sub: data.delivery.mode === "smtp" ? "Emails are being sent" : "Emails aren't being sent" },
        ]}
      />
      <ListPanel title="Your emails" meta={`${on} of ${data.items.length} on`}>
      <ul className="divide-y divide-line">
        {data.items.map((i) => (
          <li key={i.key} className="px-4 py-5 sm:px-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className={i.state === "on" ? "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success" : "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink/5 text-muted"}>
                {i.state === "on" ? <MailCheck className="h-5 w-5" aria-hidden /> : <BellOff className="h-5 w-5" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                  {i.title}
                  <Badge tone={i.state === "on" ? "success" : "neutral"}>{i.state === "on" ? "On" : "Off"}</Badge>
                </p>
                <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-[7rem_1fr]">
                  <dt className="text-muted">When</dt>
                  <dd className="text-ink">{i.when}</dd>
                  <dt className="text-muted">Sent to</dt>
                  <dd className="flex items-center gap-1.5 text-ink"><Mail className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />{i.to}</dd>
                </dl>
                {i.note && <p className="mt-2 text-sm text-muted">{i.note}</p>}
              </div>
              {i.manage && (
                <Link href={i.manage.href} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  {i.manage.label}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
      </ListPanel>
    </>
  );
}
