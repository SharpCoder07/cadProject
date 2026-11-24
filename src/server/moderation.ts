import "server-only";
import { buildMatcher, parseWordList, type WordMatcher } from "@/lib/word-filter";
import { getSettings } from "@/server/settings";
import { AppError } from "@/server/errors";

let cached: { key: string; matcher: WordMatcher } | null = null;

async function matcher(): Promise<WordMatcher | null> {
  const { moderation } = await getSettings();
  if (!moderation.blockWords) return null;
  const key = `${moderation.extraWords}\u0000${moderation.allowedWords}`;
  if (cached?.key !== key) cached = { key, matcher: buildMatcher(parseWordList(moderation.extraWords), parseWordList(moderation.allowedWords)) };
  return cached.matcher;
}

export const BLOCKED_WORDS_MESSAGE = "Please remove offensive or abusive words before posting.";

/**
 * Rejects text containing blocked (abusive) words — Website settings → Moderation. Pass the
 * submitted fields by their form names so each offending field is highlighted in the form.
 * Rich text (HTML) is fine: tags are ignored.
 */
export async function assertNoBlockedWords(fields: Record<string, string | null | undefined>) {
  const m = await matcher();
  if (!m) return;
  const bad = Object.entries(fields).filter(([, v]) => m.find(v).length > 0);
  if (!bad.length) return;
  throw new AppError(BLOCKED_WORDS_MESSAGE, "BAD_REQUEST", Object.fromEntries(bad.map(([k]) => [k, ["This contains a word that isn't allowed. Please rephrase it."]])));
}
