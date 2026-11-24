import Link from "next/link";
import { Clock, ExternalLink, MessageSquareText, Star, XCircle } from "lucide-react";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge, Stars } from "@/components/ui/misc";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { deleteMyReviewAction } from "../actions";
import { ListPanel, PanelEmpty, PillTabs, SearchField, showingAll } from "@/components/admin/list-panel";
import { ReviewRowActions } from "./review-actions";

export const metadata = { title: "My reviews" };

const STATUS = {
  PENDING: { label: "Waiting for approval", tone: "warning" },
  APPROVED: { label: "Published", tone: "success" },
  REJECTED: { label: "Not published", tone: "danger" },
} as const;

export default async function MyReviewsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireUser("/account/reviews");
  const sp = await searchParams;
  const status = (["PENDING", "APPROVED", "REJECTED"] as const).find((s) => s === sp.status);
  const q = sp.q?.trim() ?? "";
  const [reviews, byStatus, settings] = await Promise.all([
    db.review.findMany({
      where: {
        userId: user.id,
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { body: { contains: q, mode: "insensitive" as const } }, { software: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, rating: true, ratingEase: true, ratingValue: true, ratingSupport: true, ratingFeatures: true,
        title: true, body: true, pros: true, cons: true, authorRole: true, companyName: true, companySize: true,
        status: true, createdAt: true, vendorReply: true, software: { select: { name: true, slug: true, status: true } },
      },
    }),
    db.review.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true }, orderBy: { status: "asc" } }),
    getSettings(),
  ]);
  const count = (s?: string) => byStatus.filter((b) => !s || b.status === s).reduce((n, b) => n + (typeof b._count === "object" && b._count ? b._count._all ?? 0 : 0), 0);
  const href = (s?: string) => {
    const p = new URLSearchParams(Object.entries({ status: s, q: q || undefined }).filter(([, v]) => v) as [string, string][]);
    return `/account/reviews${p.size ? `?${p}` : ""}`;
  };
  const TABS: [string | undefined, string][] = [[undefined, "All"], ["APPROVED", "Published"], ["PENDING", "Waiting for approval"], ["REJECTED", "Not published"]];
  return (
    <SelectionProvider>
      <PageHeader title="My reviews" description={settings.reviews.autoApprove ? "See, edit and delete every review you've written." : "See and edit every review you've written; changes are checked before going live."} />
      <PageStats
        items={[
          { label: "Reviews written", value: formatNumber(count()), icon: MessageSquareText, tone: "red", sub: "By you" },
          { label: "Published", value: formatNumber(count("APPROVED")), icon: Star, tone: "green", sub: "Live on product pages", href: href("APPROVED") },
          { label: "Waiting for approval", value: formatNumber(count("PENDING")), icon: Clock, tone: count("PENDING") ? "amber" : "neutral", sub: count("PENDING") ? "Being checked" : "Nothing waiting", href: href("PENDING") },
          { label: "Not published", value: formatNumber(count("REJECTED")), icon: XCircle, sub: "Edit and send again", href: href("REJECTED") },
        ]}
      />
      <BulkActionBar noun="review" items={[{ label: "Delete", action: deleteMyReviewAction, done: "Deleted", danger: true, recycleBin: false, confirm: "Deleted reviews are removed from product pages straight away." }]} />
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.map(([k, label]) => ({ href: href(k), label, count: count(k), active: status === k }))} />}
        meta={showingAll(reviews.length)}
        filters={
          count() > 0 && (
            <FilterBar action="/account/reviews" bare oneLine>
              {status && <input type="hidden" name="status" value={status} />}
              <SearchField defaultValue={sp.q} placeholder="Search product or review…" />
            </FilterBar>
          )
        }
      >
      {reviews.length === 0 && (status || q) ? (
        <PanelEmpty title="No matching reviews" icon={<MessageSquareText className="h-5 w-5" />}>Try another status or search.</PanelEmpty>
      ) : reviews.length === 0 ? (
        <PanelEmpty title="No reviews yet" icon={<MessageSquareText className="h-5 w-5" />}>
          Used a product listed here? Open its page and choose <strong>Write a review</strong> — it helps other businesses decide.{" "}
          <Link href="/categories" className="text-primary hover:underline">Browse products</Link>
        </PanelEmpty>
      ) : (
        <AdminTable bare>
          <thead>
            <tr>
              <th className="w-10"><AllCheckbox ids={reviews.map((r) => r.id)} /></th>
              <th>Product</th>
              <th>Review</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Written</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((r) => {
              const st = STATUS[r.status as keyof typeof STATUS] ?? STATUS.PENDING;
              return (
                <tr key={r.id} className="align-top">
                  <td><RowCheckbox id={r.id} label={r.title} /></td>
                  <td className="whitespace-nowrap">
                    {r.software.status === "PUBLISHED" ? (
                      <Link href={`/software/${r.software.slug}#reviews`} target="_blank" className="inline-flex items-center gap-1 font-medium hover:text-mint-ink">
                        {r.software.name} <ExternalLink className="h-3 w-3" aria-hidden />
                      </Link>
                    ) : (
                      <span className="font-medium">{r.software.name}</span>
                    )}
                  </td>
                  <td className="max-w-md">
                    <p className="font-medium text-ink">{r.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{r.body}</p>
                    {r.vendorReply && <p className="mt-1.5 text-xs"><span className="font-semibold text-primary">Vendor reply: </span>{r.vendorReply}</p>}
                  </td>
                  <td><Stars value={r.rating} /></td>
                  <td><Badge tone={st.tone}>{st.label}</Badge></td>
                  <td className="whitespace-nowrap text-muted">{formatDate(r.createdAt)}</td>
                  <td>
                    <ReviewRowActions
                      review={{ ...r, product: r.software.name }}
                      minBodyLength={settings.reviews.minBodyLength}
                      companySizes={settings.leads.companySizes}
                      autoApprove={settings.reviews.autoApprove}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdminTable>
      )}
      </ListPanel>
    </SelectionProvider>
  );
}
