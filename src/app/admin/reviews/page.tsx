import Link from "next/link";
import { CheckCircle2, Clock, MessageSquareText, Star, XCircle } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listReviews } from "@/server/services/reviews";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge, Stars } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { ListSearch } from "@/components/site/list-search";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, showing } from "@/components/admin/list-panel";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { ReviewBulk, ReviewRowActions } from "./review-actions";

export const metadata = { title: "Reviews" };
const TABS = [
  ["PENDING", "Pending"],
  ["APPROVED", "Approved"],
  ["REJECTED", "Rejected"],
  ["ALL", "All"],
] as const;
const TONE = { PENDING: "warning", APPROVED: "success", REJECTED: "neutral" } as const;

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  const user = await requirePermission("reviews.view", "/admin/reviews");
  const sp = await searchParams;
  const status = TABS.find(([k]) => k === sp.status)?.[0] ?? "PENDING";
  const [data, byStatus, avg] = await Promise.all([
    listReviews(user, { status, page: Number(sp.page) || 1, q: sp.q }),
    db.review.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
    db.review.aggregate({ where: { status: "APPROVED" }, _avg: { rating: true } }),
  ]);
  const count = (s?: string) => byStatus.filter((b) => !s || s === "ALL" || b.status === s).reduce((n, b) => n + (typeof b._count === "object" ? b._count._all ?? 0 : 0), 0);
  const href = (s: string) => `/admin/reviews?status=${s}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;
  const pending = count("PENDING");
  return (
    <SelectionProvider>
      <PageHeader title="Reviews" description="Moderate every buyer review before it goes live." />
      <PageStats
        items={[
          { label: "Waiting for review", value: formatNumber(pending), icon: Clock, tone: pending ? "amber" : "neutral", sub: pending ? "Needs moderation" : "All caught up", href: href("PENDING") },
          { label: "Approved", value: formatNumber(count("APPROVED")), icon: CheckCircle2, tone: "green", sub: "Live on product pages", href: href("APPROVED") },
          { label: "Rejected", value: formatNumber(count("REJECTED")), icon: XCircle, sub: "Hidden from buyers", href: href("REJECTED") },
          { label: "Average rating", value: avg._avg.rating ? avg._avg.rating.toFixed(1) : "—", icon: Star, tone: "red", sub: "Across approved reviews" },
        ]}
      />
      <ReviewBulk />
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.map(([k, label]) => ({ href: href(k), label, count: count(k), active: status === k }))} />}
        meta={showing(data.page, 25, data.total)}
        actions={<ListSearch panel placeholder="Search reviews…" basePath="/admin/reviews" params={{ status, q: sp.q }} scopeLabel="Reviews" className="w-full sm:w-72" />}
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/reviews" params={{ status, q: sp.q }} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<MessageSquareText className="h-5 w-5" />} title={sp.q ? "No matching reviews" : status === "PENDING" ? "Nothing to moderate" : "No reviews here"}>
            {sp.q ? "Try a different search." : "New buyer reviews appear here."}
          </PanelEmpty>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-line bg-bg/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted sm:px-5">
              <AllCheckbox ids={data.items.map((r) => r.id)} /> Select all
            </div>
            <ul className="divide-y divide-line">
              {data.items.map((r) => (
                <li key={r.id} className="flex gap-3 px-4 py-4 transition-colors hover:bg-bg/60 sm:px-5">
                  <div className="pt-1"><RowCheckbox id={r.id} label={r.title} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Stars value={r.rating} />
                      <span className="font-semibold text-ink">{r.title}</span>
                      <Badge tone={TONE[r.status as keyof typeof TONE] ?? "neutral"}>{r.status.charAt(0) + r.status.slice(1).toLowerCase()}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      for <Link href={`/software/${r.software.slug}`} target="_blank" className="font-medium text-ink hover:text-mint-ink">{r.software.name}</Link>
                    </p>
                    <p className="mt-2 line-clamp-4 whitespace-pre-line break-words text-sm text-ink/90">{r.body}</p>
                    {(r.pros || r.cons) && (
                      <div className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                        {r.pros && <p className="break-words rounded-lg bg-success/5 px-2.5 py-1.5 text-ink/80"><span className="font-semibold text-success">Pros </span>{r.pros}</p>}
                        {r.cons && <p className="break-words rounded-lg bg-danger/5 px-2.5 py-1.5 text-ink/80"><span className="font-semibold text-danger">Cons </span>{r.cons}</p>}
                      </div>
                    )}
                    <p className="mt-2 break-words text-xs text-muted">{r.authorName} · {r.authorEmail}{r.companyName && ` · ${r.companyName}`} · {formatDate(r.createdAt)}</p>
                  </div>
                  <div className="shrink-0"><ReviewRowActions id={r.id} status={r.status} /></div>
                </li>
              ))}
            </ul>
          </>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
