import { z } from "zod";

/**
 * Help chat (the website's guided chatbot, no AI): matching a visitor's question to the FAQs.
 * Pure functions, shared by the server (app/api/chat) and the unit tests.
 */

/** Words that carry no meaning for matching ("how do I…", "what is the…"). */
const STOP = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "from", "by", "with", "about", "as", "into", "is", "are", "was", "were", "be", "been",
  "do", "does", "did", "can", "could", "will", "would", "should", "shall", "may", "might", "must", "have", "has", "had", "i", "me", "my", "we", "our", "us", "you", "your",
  "it", "its", "this", "that", "these", "those", "there", "here", "what", "which", "who", "whom", "how", "why", "when", "where", "any", "some", "all", "not", "no", "yes",
  "please", "pls", "plz", "want", "need", "like", "get", "know", "tell", "help", "hi", "hello", "hey", "thanks", "thank", "ok", "okay", "so", "if", "then", "than", "also",
  "just", "very", "much", "many", "more", "most", "one", "am", "im", "kya", "hai", "ka", "ki", "ke", "se", "mein", "kaise", "hota", "karna", "chahiye",
]);

/** Light stemming, so "prices"/"pricing"/"priced" and "listing"/"listed" meet. */
function stem(w: string): string {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** The meaningful words of a text, stemmed: "How do I list my software?" → ["list", "software"]. */
export function keywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
  return [...new Set(words)].slice(0, 12);
}

const close = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

export interface FaqLike { question: string; answer: string }

/**
 * How well an FAQ answers the query, 0–1: the share of the query's words found in the question
 * (full weight) or only in the answer (a third). 0 when no word is in the question.
 */
export function scoreFaq(query: string[], faq: FaqLike): number {
  if (!query.length) return 0;
  const q = keywords(faq.question);
  const a = keywords(faq.answer);
  let sum = 0;
  let inQuestion = 0;
  for (const w of query) {
    if (q.some((x) => close(w, x))) { sum += 1; inQuestion++; }
    else if (a.some((x) => close(w, x))) sum += 1 / 3;
  }
  return inQuestion ? sum / query.length : 0;
}

/** The best FAQ (score 0.5 or more) and up to `related` others worth suggesting (0.3 or more). */
export function matchFaqs<T extends FaqLike>(text: string, faqs: T[], related = 2): { best: T | null; related: T[] } {
  const query = keywords(text);
  const ranked = faqs
    .map((f) => ({ f, s: scoreFaq(query, f) }))
    .filter((r) => r.s >= 0.3)
    .sort((x, y) => y.s - x.s);
  const best = ranked[0] && ranked[0].s >= 0.5 ? ranked[0].f : null;
  return { best, related: ranked.filter((r) => r.f !== best).slice(0, related).map((r) => r.f) };
}

/** A WhatsApp chat link with a ready message, or null without a number. */
export function whatsappUrl(number: string, message = ""): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export const chatQuestionInput = z.object({ q: z.string().trim().min(1).max(200) });

/** What the chat API answers. */
export interface ChatAnswer {
  faq: FaqLike | null;
  related: FaqLike[];
  links: { type: "software" | "category" | "vendor" | "term"; label: string; href: string; meta?: string | null }[];
}
