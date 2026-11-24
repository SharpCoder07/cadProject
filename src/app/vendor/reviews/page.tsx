import { AlertCircle, Clock, MessageSquareQuote, Reply, Star } from "lucide-react";
import { db } from "@/server/db";
import { requestStateFor } from "@/server/services/approvals";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge, Stars } from "@/components/ui/misc";
import { FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PillTabs, SearchField, showingAll } from "@/components/admin/list-panel";
import { requireVendor } from "../_lib";
import { ReplyForm } from "./reply-form";

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function VendorReviews({ searchParams }: { searchParams: Promise<{ q?: string; show?: string }> }) {
  const user = await requireVendor("vendor.reviews", "/vendor/reviews");
  const sp = await searchParams;
  const all = await db.review.findMany({
    where: { status: "APPROVED", software: { vendorId: user.vendorId } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, title: true, body: true, rating: true, authorName: true, companyName: true, createdAt: true, vendorReply: true, software: { select: { name: true } } },
  });
  const q = sp.q?.trim().toLowerCase();
  const show = sp.show === "unreplied" || sp.show === "replied" ? sp.show : "all";
  const reviews = all.filter(
    (r) => (show === "all" || (show === "replied") === Boolean(r.vendorReply)) && (!q || [r.title, r.body, r.authorName, r.software.name].some((t) => t.toLowerCase().includes(q))),
  );
  const replied = all.filter((r) => r.vendorReply).length;
  const avg = all.length ? all.reduce((n, r) => n + r.rating, 0) / all.length : 0;
  const href = (v: string) => {
    const p = new URLSearchParams(Object.entries({ show: v === "all" ? undefined : v, q: sp.q }).filter(([, x]) => x) as [string, string][]);
    return `/vendor/reviews${p.size ? `?${p}` : ""}`;
  };
  const states = await requestStateFor(user.vendorId, "REVIEW_REPLY", reviews.map((r) => r.id));
  const pendingReplies = new Map(
    (await db.approvalRequest.findMany({ where: { vendorId: user.vendorId, entityType: "REVIEW_REPLY", status: "PENDING", entityId: { in: reviews.map((r) => r.id) } }, select: { entityId: true, payload: true } }))
      .map((r) => [r.entityId, (r.payload as { reply?: string } | null)?.reply ?? null]),
  );
  return (
    <>
      <PageHeader title="Reviews" description="Read and reply to every review of your products." />
      <PageStats
        items={[
          { label: "Published reviews", value: formatNumber(all.length), icon: MessageSquareQuote, tone: "red", sub: "Of your products" },
          { label: "Average rating", value: all.length ? avg.toFixed(1) : "—", icon: Star, tone: "green", sub: "Out of 5" },
          { label: "Replied", value: formatNumber(replied), icon: Reply, sub: "With a public reply", href: href("replied") },
          { label: "Awaiting your reply", value: formatNumber(all.length - replied), icon: Clock, tone: all.length - replied ? "amber" : "neutral", sub: all.length - replied ? "Replies build trust" : "All replied", href: href("unreplied") },
        ]}
      />
      <ListPanel
        tabs={<PillTabs label="Show" items={[["all", "All", all.length], ["unreplied", "Not replied", all.length - replied], ["replied", "Replied", replied]].map(([v, label, n]) => ({ href: href(v as string), label: label as string, count: n as number, active: show === v }))} />}
        meta={showingAll(reviews.length)}
        filters={all.length > 0 && (
          <FilterBar action="/vendor/reviews" bare oneLine>
            {show !== "all" && <input type="hidden" name="show" value={show} />}
            <SearchField defaultValue={sp.q} placeholder="Search reviews, reviewers or products…" />
          </FilterBar>
        )}
      >
      {reviews.length === 0 ? (
        <PanelEmpty icon={<MessageSquareQuote className="h-5 w-5" />} title={all.length ? "No matching reviews" : "No published reviews yet"}>{all.length ? "Try another filter or search." : "Reviews show up here once they're approved for the website."}</PanelEmpty>
      ) : (
        <ul className="divide-y divide-line">
          {reviews.map((r) => {
            const st = states.get(r.id);
            return (
              <li key={r.id} className="px-4 py-5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><Stars value={r.rating} /><span className="font-semibold">{r.title}</span></span>
                  <span className="text-xs text-muted">{r.software.name} · {formatDate(r.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line break-words text-sm text-ink/85">{r.body}</p>
                <p className="mt-1 text-xs text-muted">{r.authorName}{r.companyName ? `, ${r.companyName}` : ""}</p>
                {r.vendorReply && (
                  <div className="mt-3 rounded-xl bg-bg p-3 text-sm ring-1 ring-line">
                    <p className="text-xs font-semibold text-muted">Your public reply</p>
                    <p className="mt-1 whitespace-pre-line">{r.vendorReply}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {st?.status === "PENDING" && <Badge tone="accent">{st.action === "DELETE" ? "Removal awaiting approval" : "Reply awaiting approval"}</Badge>}
                  {st?.status === "REJECTED" && <p className="flex max-w-[18rem] items-start gap-1.5 text-xs text-danger"><AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /><span><span className="font-semibold">Reply rejected</span>{st.decisionNote && <span className="line-clamp-2 text-muted">{st.decisionNote}</span>}</span></p>}
                </div>
                <div className="mt-3"><ReplyForm reviewId={r.id} current={r.vendorReply} pending={pendingReplies.get(r.id) ?? null} /></div>
              </li>
            );
          })}
        </ul>
      )}
      </ListPanel>
    </>
  );
}
