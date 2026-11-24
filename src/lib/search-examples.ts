/** Default "Search bar typing examples" (also the settings default in server/settings/schemas.ts). */
export const DEFAULT_SEARCH_EXAMPLES = "payroll for 20 staff\nGST billing software\nCRM for small teams\nattendance app";

/**
 * Website settings › Labels › "Search bar typing examples" (one per line) as a list for SearchBox's `hints`.
 * Not saved yet (older settings) → the defaults; saved empty → no typing.
 */
export const searchExamples = (labels: { searchExamples?: string }) =>
  (labels.searchExamples ?? DEFAULT_SEARCH_EXAMPLES).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
