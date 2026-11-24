import { PRESET_BLOCKED_WORDS } from "./preset";

/**
 * Finds blocked (abusive) words in text. Matching is whole-word and Unicode-aware (works for
 * Devanagari too), case-insensitive, and sees through simple disguises: l33t digits/symbols
 * (f@ck, sh1t, a$$), zero-width characters and stretched letters (fuuuuck).
 *
 *   "fuck*"  → fuck, fucking, fucker …   (trailing * = any ending)
 *   "ass"    → ass, but not class / assessment / passion
 *   "piss off" → phrases match across spaces, dots, dashes or underscores
 */

const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
const LEET: Record<string, string> = { "@": "a", "4": "a", "0": "o", "1": "i", "!": "i", "3": "e", "$": "s", "5": "s", "7": "t" };
const LETTER = "\\p{L}\\p{M}\\p{N}";

/** Lower-case, Unicode-normalised text with zero-width characters removed. */
function base(text: string) {
  return text.normalize("NFC").replace(ZERO_WIDTH, "").toLowerCase();
}

/** Undo common disguises: l33t characters and letters repeated three or more times. */
function unmask(text: string, at = "a") {
  return text.replace(/[@4013!$57*]/g, (c, i: number, s: string) => {
    // Only treat digits/symbols as letters when they sit next to a letter (keeps "2025", "$5" readable).
    const near = /\p{L}/u.test(s[i - 1] ?? "") || /\p{L}/u.test(s[i + 1] ?? "");
    if (!near) return c;
    // "@" and "*" usually hide a vowel: try them as "a" and, in a second pass, as "u" (f@ck, f*ck).
    return c === "@" || c === "*" ? at : LEET[c] ?? c;
  }).replace(/(\p{L})\1{2,}/gu, "$1");
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Normalises a list entry the same way text is normalised, so both sides compare equally. */
function entryPattern(raw: string): string | null {
  const word = base(raw.trim());
  if (!word || word === "*") return null;
  const prefix = word.endsWith("*");
  const core = (prefix ? word.slice(0, -1) : word).replace(/(\p{L})\1{2,}/gu, "$1").trim();
  if (!core) return null;
  const body = core.split(/\s+/).map(escape).join("[\\s._-]+");
  return prefix ? `${body}[${LETTER}]*` : body;
}

export interface WordMatcher {
  /** Blocked words found in the text (as written in the text), without duplicates. */
  find(text: string | null | undefined): string[];
}

/** Builds a matcher from the preset list plus extra words, minus always-allowed words. */
export function buildMatcher(extra: readonly string[] = [], allowed: readonly string[] = [], includePreset = true): WordMatcher {
  const allow = new Set(allowed.map((w) => base(w.trim())).filter(Boolean));
  const words = [...(includePreset ? PRESET_BLOCKED_WORDS : []), ...extra].filter((w) => !allow.has(base(w.trim()).replace(/\*$/, "")));
  const patterns = [...new Set(words.map(entryPattern).filter((p): p is string => Boolean(p)))]
    // Longer patterns first so phrases win over their parts.
    .sort((a, b) => b.length - a.length);
  if (!patterns.length) return { find: () => [] };
  const re = new RegExp(`(?<![${LETTER}])(?:${patterns.join("|")})(?![${LETTER}])`, "giu");
  return {
    find(text) {
      if (!text) return [];
      const found = new Set<string>();
      const plain = base(text.replace(/<[^>]*>/g, " "));
      for (const variant of new Set([plain, unmask(plain), unmask(plain, "u"), unmask(plain, "i")])) {
        for (const m of variant.matchAll(re)) if (!allow.has(m[0])) found.add(m[0]);
      }
      return [...found];
    },
  };
}

/** Splits an admin-entered list ("one per line or comma separated") into entries. */
export const parseWordList = (raw: string | null | undefined) =>
  (raw ?? "")
    .split(/[\n,]+/)
    .map((w) => w.trim())
    .filter(Boolean);

export { PRESET_BLOCKED_WORDS };
