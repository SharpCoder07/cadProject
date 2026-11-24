import "server-only";
import { z } from "zod";
import { revalidateTag } from "next/cache";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { sanitizePlain } from "@/server/sanitize";
import { assertNoBlockedWords } from "@/server/moderation";
import { assertCan, can, type Principal } from "@/server/rbac/policy";
import { env } from "@/server/env";
import { sendTemplate } from "@/server/email/config";
import { escapeHtml } from "@/server/email/templates";
import { softwareTag } from "./software";
import { withBin } from "@/server/system/trash";
import { notify } from "@/server/notifications/notify";
import { guardDelete } from "@/server/rbac/deletion";

/**
 * Product questions: signed-in buyers ask on the product page; staff who moderate reviews answer
 * them in Admin → Products → Questions. Only answered, published questions appear on the page.
 */

export const questionSubmission = z.object({
  softwareSlug: z.string().max(80),
  question: z.string().trim().min(10, "Write at least 10 characters.").max(600),
  website: z.string().max(0).optional().default(""), // honeypot
});

export async function askQuestion(user: Principal | null, input: z.infer<typeof questionSubmission>) {
  if (!user) throw new AppError("Sign in to ask a question.", "UNAUTHENTICATED");
  assertCan(user, "buyer.account");
  if (input.website) return { ok: true }; // bot: pretend success
  await assertNoBlockedWords({ question: input.question });
  const sw = await db.software.findFirst({ where: { slug: input.softwareSlug, status: "PUBLISHED" }, select: { id: true, name: true } });
  if (!sw) throw notFound("Software");
  const pending = await db.productQuestion.count({ where: { userId: user.id, status: "PENDING" } });
  if (pending >= 5) throw new AppError("You have 5 questions waiting for an answer. Please wait for those first.", "CONFLICT");
  const q = await db.productQuestion.create({ data: { softwareId: sw.id, userId: user.id, authorName: sanitizePlain(user.name), question: sanitizePlain(input.question) } });
  notify({ staff: "reviews.moderate" }, { type: "question.new", title: `Question to answer: ${sw.name}`, body: `${user.name}: ${q.question}`, href: "/admin/questions" });
  void notifyModerators(sw.name, user.name, q.question).catch((e) => console.error("[questions] notify failed", e));
  return { ok: true };
}

async function notifyModerators(product: string, asker: string, question: string) {
  const moderators = await db.user.findMany({ where: { status: "ACTIVE", vendorId: null, role: { permissions: { some: { permission: { key: "reviews.moderate" } } } } }, select: { email: true } });
  if (!moderators.length) return;
  await sendTemplate("question_new", moderators.map((m) => m.email), { asker_name: asker, product_name: product, question, moderate_url: `${env.APP_URL}/admin/questions` });
}

/** Answered questions shown on a product page, newest first. */
export async function publishedQuestions(softwareId: string, take = 20) {
  return db.productQuestion.findMany({
    where: { softwareId, status: "APPROVED", answer: { not: null } },
    orderBy: { answeredAt: "desc" },
    take,
    select: { id: true, question: true, answer: true, authorName: true, createdAt: true, answeredAt: true },
  });
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function listQuestions(user: Principal, opts: { status: "PENDING" | "APPROVED" | "REJECTED" | "ALL"; page?: number; q?: string }) {
  assertCan(user, "reviews.view");
  const page = opts.page ?? 1;
  const perPage = 25;
  const q = opts.q?.trim();
  const where = {
    ...(opts.status === "ALL" ? {} : { status: opts.status }),
    ...(q ? { OR: [{ question: { contains: q, mode: "insensitive" as const } }, { authorName: { contains: q, mode: "insensitive" as const } }, { software: { name: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };
  const [items, total] = await Promise.all([
    db.productQuestion.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { software: { select: { name: true, slug: true } }, user: { select: { email: true } }, answeredBy: { select: { name: true } } },
    }),
    db.productQuestion.count({ where }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Saves the answer and publishes the question on the product page; emails the buyer the first time. */
export async function answerQuestion(user: Principal, id: string, answer: string) {
  assertCan(user, "reviews.moderate");
  await assertNoBlockedWords({ answer });
  const q = await db.productQuestion.findUnique({ where: { id }, include: { software: { select: { name: true, slug: true } }, user: { select: { name: true, email: true, status: true } } } });
  if (!q) throw notFound("Question");
  const firstAnswer = !q.answer;
  const text = sanitizePlain(answer);
  await db.productQuestion.update({ where: { id }, data: { answer: text, status: "APPROVED", answeredById: user.id, answeredAt: q.answeredAt ?? new Date() } });
  revalidateTag(softwareTag(q.software.slug));
  await audit({ actorId: user.id, action: "question.answer", entityType: "question", entityId: id, summary: `${q.software.name}: ${q.question.slice(0, 80)}` });
  if (firstAnswer && q.userId) {
    notify({ users: [q.userId] }, { type: "question.answered", title: `Your question about ${q.software.name} was answered`, body: text, href: `/software/${q.software.slug}#questions` });
  }
  if (firstAnswer && q.user?.email && q.user.status === "ACTIVE") {
    void sendTemplate("question_answered", q.user.email, {
      user_name: q.user.name,
      product_name: q.software.name,
      question: q.question,
      answer_html: `<p style="white-space:pre-line">${escapeHtml(text)}</p>`,
      product_url: `${env.APP_URL}/software/${q.software.slug}#questions`,
    }).catch((e) => console.error("[questions] answer email failed", e));
  }
}

export async function setQuestionStatus(user: Principal, id: string, status: "APPROVED" | "REJECTED") {
  assertCan(user, "reviews.moderate");
  const q = await db.productQuestion.findUnique({ where: { id }, include: { software: { select: { slug: true } } } });
  if (!q) throw notFound("Question");
  if (status === "APPROVED" && !q.answer) throw new AppError("Write an answer before publishing.");
  await db.productQuestion.update({ where: { id }, data: { status } });
  revalidateTag(softwareTag(q.software.slug));
}

export async function deleteQuestion(user: Principal, id: string) {
  await guardDelete(user, "question", { id });
  const q = await db.productQuestion.findUnique({ where: { id }, include: { software: { select: { slug: true } } } });
  if (!q) return;
  await withBin(user, "ProductQuestion", [id], (tx) => tx.productQuestion.delete({ where: { id } }));
  revalidateTag(softwareTag(q.software.slug));
}

/** Unanswered questions for the admin notifications bell and sidebar badge. */
export async function pendingQuestionSummary(user: Principal) {
  if (!can(user, "reviews.view")) return { count: 0, latest: [] };
  const [count, latest] = await Promise.all([
    db.productQuestion.count({ where: { status: "PENDING" } }),
    db.productQuestion.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, question: true, authorName: true, createdAt: true, software: { select: { name: true } } } }),
  ]);
  return { count, latest };
}
