import Link from "next/link";
import { CheckCircle2, Clock, EyeOff, MessageSquareQuote } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listQuestions } from "@/server/services/questions";
import { formatDate, formatNumber } from "@/lib/format";
import { Badge } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { ListSearch } from "@/components/site/list-search";
import { PageStats } from "@/components/admin/page-stats";
import { ListPanel, PanelEmpty, PanelPagination, PillTabs, showing } from "@/components/admin/list-panel";
import { QuestionAnswer } from "./question-row";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { deleteQuestionAction, setQuestionStatusAction } from "./actions";

export const metadata = { title: "Questions" };
const TABS = [
  ["PENDING", "To answer"],
  ["APPROVED", "Published"],
  ["REJECTED", "Hidden"],
  ["ALL", "All"],
] as const;
const STATUS = { PENDING: { label: "To answer", tone: "warning" }, APPROVED: { label: "Published", tone: "success" }, REJECTED: { label: "Hidden", tone: "neutral" } } as const;

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  const user = await requirePermission("reviews.view", "/admin/questions");
  const sp = await searchParams;
  const status = TABS.find(([k]) => k === sp.status)?.[0] ?? "PENDING";
  const [data, byStatus] = await Promise.all([
    listQuestions(user, { status, page: Number(sp.page) || 1, q: sp.q }),
    db.productQuestion.groupBy({ by: ["status"], _count: { _all: true }, orderBy: { status: "asc" } }),
  ]);
  const count = (s?: string) => byStatus.filter((b) => !s || s === "ALL" || b.status === s).reduce((n, b) => n + (typeof b._count === "object" ? b._count._all ?? 0 : 0), 0);
  const href = (s: string) => `/admin/questions?status=${s}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`;
  const pending = count("PENDING");
  return (
    <SelectionProvider>
      <PageHeader title="Questions" description="Answer every buyer question asked on product pages." />
      <PageStats
        items={[
          { label: "To answer", value: formatNumber(pending), icon: Clock, tone: pending ? "amber" : "neutral", sub: pending ? "Buyers are waiting" : "All caught up", href: href("PENDING") },
          { label: "Published", value: formatNumber(count("APPROVED")), icon: CheckCircle2, tone: "green", sub: "Shown on product pages", href: href("APPROVED") },
          { label: "Hidden", value: formatNumber(count("REJECTED")), icon: EyeOff, sub: "Not shown to buyers", href: href("REJECTED") },
          { label: "All questions", value: formatNumber(count()), icon: MessageSquareQuote, tone: "red", sub: "Asked on product pages" },
        ]}
      />
      <BulkActionBar
        noun="question"
        items={[
          { label: "Publish", action: setQuestionStatusAction, extra: { status: "APPROVED" }, done: "Published" },
          { label: "Hide", action: setQuestionStatusAction, extra: { status: "REJECTED" }, done: "Hid" },
          { label: "Delete", action: deleteQuestionAction, done: "Deleted", danger: true },
        ]}
      />
      <ListPanel
        tabs={<PillTabs label="Status" items={TABS.map(([k, label]) => ({ href: href(k), label, count: count(k), active: status === k }))} />}
        meta={showing(data.page, 25, data.total)}
        actions={<ListSearch panel placeholder="Search questions…" basePath="/admin/questions" params={{ status, q: sp.q }} scopeLabel="Questions" className="w-full sm:w-72" />}
        footer={<PanelPagination page={data.page} pages={data.pages} basePath="/admin/questions" params={{ status, q: sp.q }} />}
      >
        {data.items.length === 0 ? (
          <PanelEmpty icon={<MessageSquareQuote className="h-5 w-5" />} title={sp.q ? "No matching questions" : status === "PENDING" ? "No questions to answer" : "No questions here"}>
            {sp.q ? "Try a different search." : "Questions buyers ask on product pages appear here."}
          </PanelEmpty>
        ) : (
          <>
          <div className="flex items-center gap-2 border-b border-line bg-bg/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted sm:px-5">
            <AllCheckbox ids={data.items.map((q) => q.id)} /> Select all
          </div>
          <ul className="divide-y divide-line">
            {data.items.map((q) => {
              const st = STATUS[q.status as keyof typeof STATUS] ?? STATUS.PENDING;
              return (
                <li key={q.id} className="flex gap-3 px-4 py-4 sm:px-5">
                  <div className="pt-0.5"><RowCheckbox id={q.id} label={q.question} /></div>
                  <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-xs text-muted">
                        About <Link href={`/software/${q.software.slug}#questions`} target="_blank" className="font-semibold text-ink hover:text-mint-ink">{q.software.name}</Link> · {q.authorName}{q.user?.email && ` (${q.user.email})`} · {formatDate(q.createdAt)}
                      </p>
                      <p className="mt-1.5 whitespace-pre-line break-words font-semibold text-ink">{q.question}</p>
                    </div>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <QuestionAnswer id={q.id} answer={q.answer} status={q.status} />
                  {q.answeredBy && <p className="mt-2 text-xs text-muted">Answered by {q.answeredBy.name}{q.answeredAt && ` · ${formatDate(q.answeredAt)}`}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </ListPanel>
    </SelectionProvider>
  );
}
