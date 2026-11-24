/** Legal document rules shared by the server, admin and tests (no server-only imports). */

export type LegalAudience = "all" | "buyer" | "vendor" | "reseller";
export const LEGAL_AUDIENCES: { value: LegalAudience; label: string }[] = [
  { value: "all", label: "Everyone (buyers, vendors and resellers)" },
  { value: "buyer", label: "Buyers" },
  { value: "vendor", label: "Vendors" },
  { value: "reseller", label: "Resellers" },
];

export interface VersionLike { id: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; effectiveAt: Date | null; version: string }

/** The version in force: the published one with the latest effective date that has started. */
export function versionInForce<V extends VersionLike>(versions: V[], now = new Date()): V | null {
  let best: V | null = null;
  for (const v of versions) {
    if (v.status !== "PUBLISHED" || !v.effectiveAt || v.effectiveAt > now) continue;
    if (!best || v.effectiveAt > best.effectiveAt! || (+v.effectiveAt === +best.effectiveAt! && compareVersions(v.version, best.version) > 0)) best = v;
  }
  return best;
}

/** Published versions that haven't started yet. */
export const scheduledVersions = <V extends VersionLike>(versions: V[], now = new Date()) =>
  versions.filter((v) => v.status === "PUBLISHED" && v.effectiveAt && v.effectiveAt > now).sort((a, b) => +a.effectiveAt! - +b.effectiveAt!);

/** "1.10" > "1.9"; non-numeric parts compare as text. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.\-]/), pb = b.split(/[.\-]/);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? "0", y = pb[i] ?? "0";
    const nx = Number(x), ny = Number(y);
    const c = Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : x.localeCompare(y);
    if (c) return c;
  }
  return 0;
}

/** Suggests the next version number: 1.0 → 1.1, none → 1.0. */
export function nextVersion(existing: string[]): string {
  if (!existing.length) return "1.0";
  const top = [...existing].sort(compareVersions).pop()!;
  const parts = top.split(".");
  const last = Number(parts[parts.length - 1]);
  if (!Number.isFinite(last)) return `${top}.1`;
  parts[parts.length - 1] = String(last + 1);
  return parts.join(".");
}

export const VERSION_RE = /^[0-9]+(\.[0-9]+){0,3}$/;

/** Who a document applies to. Staff accounts are never asked to accept. */
export function appliesTo(audience: string, who: "buyer" | "vendor" | "reseller" | "staff"): boolean {
  if (who === "staff") return false;
  return audience === "all" || audience === who;
}

/** Does this person need to accept the version in force? Only when it asks for (re)acceptance and they haven't. */
export function needsAcceptance(doc: { requiresAcceptance: boolean; isActive: boolean }, current: { id: string; requireReacceptance: boolean } | null, acceptedVersionIds: Set<string>): boolean {
  return Boolean(doc.isActive && doc.requiresAcceptance && current && current.requireReacceptance && !acceptedVersionIds.has(current.id));
}

/** Splits HTML into readable text blocks (paragraphs, headings, list items) for comparing versions. */
export function htmlToBlocks(html: string): string[] {
  return html
    .replace(/<\s*(br)\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|h[1-6]|li|tr|blockquote|div|pre)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export type DiffLine = { op: "same" | "add" | "remove"; text: string };

/** Line diff (longest common subsequence) between two versions' text blocks. */
export function diffBlocks(before: string[], after: string[]): DiffLine[] {
  const n = before.length, m = after.length;
  // Big documents: fall back to a simple before/after listing rather than an O(n·m) table.
  if (n * m > 4_000_000) return [...before.map((text) => ({ op: "remove" as const, text })), ...after.map((text) => ({ op: "add" as const, text }))];
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = before[i] === after[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) { out.push({ op: "same", text: before[i]! }); i++; j++; }
    else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) out.push({ op: "remove", text: before[i++]! });
    else out.push({ op: "add", text: after[j++]! });
  }
  while (i < n) out.push({ op: "remove", text: before[i++]! });
  while (j < m) out.push({ op: "add", text: after[j++]! });
  return out;
}
