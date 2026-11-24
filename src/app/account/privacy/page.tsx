import Link from "next/link";
import { ClipboardCheck, FileText } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { myCases } from "@/server/services/compliance/cases";
import { STATUS_LABEL, typeLabel } from "@/lib/compliance/cases";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { CaseForm } from "@/components/compliance/case-form";
import { DownloadMyData } from "./download-button";

export const metadata = { title: "Privacy center" };

const TONE: Record<string, string> = {
  RESOLVED: "bg-success/10 text-success ring-success/20",
  REJECTED: "bg-ink/[0.05] text-ink/70 ring-line",
  CLOSED: "bg-ink/[0.05] text-ink/70 ring-line",
  AWAITING_REQUESTER: "bg-warning/10 text-warning ring-warning/25",
};

/** Account › Privacy center: download my data, my requests and complaints, and a new one. */
export default async function AccountPrivacyPage() {
  const me = await requireUser("/account/privacy");
  const cases = await myCases(me).catch(() => []);
  return (
    <>
      <PageHeader title="Privacy center" description="Your data, your consents, and requests or complaints you've sent us." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Your data" description="Download a copy of the personal data we hold about you (account, consents, favourites, reviews, enquiries…)." />
            <div className="flex flex-wrap items-center gap-3 p-5">
              <DownloadMyData />
              <Link href="/account/settings" className="text-sm font-semibold text-primary hover:underline">Consent choices</Link>
              <Link href="/privacy-policy" className="text-sm font-semibold text-primary hover:underline">Privacy policy</Link>
            </div>
          </Panel>
          <Panel>
            <PanelHeader title="Your requests and complaints" description="Updates from our team appear here and are emailed to you." />
            {cases.length === 0 ? (
              <p className="flex items-center gap-2 p-5 text-sm text-muted"><ClipboardCheck className="h-4 w-4" aria-hidden />Nothing yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {cases.map((c) => (
                  <li key={c.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText className="h-4 w-4 text-muted" aria-hidden />
                      <span className="font-semibold text-ink">{c.subject || typeLabel(c.kind, c.type)}</span>
                      <span className="text-xs text-muted">{c.referenceNo} · {formatDate(c.createdAt)}</span>
                      <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", TONE[c.status] ?? "bg-primary/10 text-primary ring-primary/20")}>{STATUS_LABEL[c.status]}</span>
                    </div>
                    {c.dueAt && !c.resolvedAt && <p className="mt-1 text-xs text-muted">We aim to respond by {formatDate(c.dueAt)}.</p>}
                    {c.events.length > 0 && (
                      <ol className="mt-3 space-y-1.5 border-l border-line pl-4 text-sm">
                        {c.events.map((e) => (
                          <li key={e.id}>
                            <span className="text-xs text-muted">{formatDateTime(e.createdAt)}</span>
                            <span className="block whitespace-pre-line text-ink">{e.message}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <Panel className="h-fit">
          <PanelHeader title="Send a request or complaint" description="For example, to correct your data, delete your account or raise a complaint." />
          <div className="p-5"><CaseForm account={{ name: me.name, email: me.email }} /></div>
        </Panel>
      </div>
    </>
  );
}
