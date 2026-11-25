import { unstable_cache } from "next/cache";
import { db } from "@/server/db";
import { BLOCKS_TAG } from "@/server/services/navigation";
import { searchProvider, termQueryText } from "@/server/services/search";
import { matchFaqs, type ChatAnswer } from "@/lib/chatbot";

/** Every active FAQ (Admin › Website & content › FAQs), cached like the FAQ blocks. */
const activeFaqs = unstable_cache(
  () => db.faqItem.findMany({ where: { isActive: true }, select: { question: true, answer: true }, orderBy: [{ group: { sortOrder: "asc" } }, { sortOrder: "asc" }] }),
  ["chat:faqs"],
  { tags: [BLOCKS_TAG], revalidate: 3600 },
);

/**
 * Help chat answer: the best-matching FAQ, related questions, and catalogue links (categories,
 * classification pages, products, vendors) for the words that matter in the question.
 */
export async function answerQuestion(text: string): Promise<ChatAnswer> {
  const q = text.trim().slice(0, 200);
  const words = termQueryText(q).split(" ").filter((w) => w.length > 1).slice(0, 4);
  // The whole phrase ("crm small business"), then its main words on their own ("crm", "small"), so a
  // category is found even when the question says more than its name.
  const phrases = [...new Set([words.join(" "), ...words.filter((w) => w.length >= 3).slice(0, 2)])].filter((p) => p.length >= 2);
  const [faqs, ...found] = await Promise.all([
    activeFaqs(),
    ...phrases.map((p) => searchProvider.suggest(p, 4).catch(() => [])),
  ]);
  const { best, related } = matchFaqs(q, faqs);
  // Categories and classification pages first, then products and vendors; each page once.
  const rank = { category: 0, term: 1, software: 2, vendor: 3 } as const;
  const seen = new Set<string>();
  const links = found
    .flat()
    .filter((l) => !seen.has(l.href) && seen.add(l.href))
    .sort((a, b) => rank[a.type] - rank[b.type])
    .slice(0, 5)
    .map((l) => ({ type: l.type, label: l.label, href: l.href, meta: l.meta ?? null }));
  return { faq: best, related, links };
}
