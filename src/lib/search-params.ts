/** Normalises Next.js searchParams (string | string[] | undefined) for Zod parsing. */
export type RawParams = Record<string, string | string[] | undefined>;

const MULTI = new Set(["pricing", "deployment", "opt", "term"]);

export function normaliseParams(raw: RawParams): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    if (MULTI.has(k)) out[k] = (Array.isArray(v) ? v : [v]).flatMap((x) => x.split(",")).filter(Boolean);
    else out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}
