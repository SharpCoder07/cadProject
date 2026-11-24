/** Error log types and statuses. Pure (client-safe). */
export const ERROR_TYPES = ["UI", "BACKEND", "SERVER", "DATABASE", "NETWORK"] as const;
export type ErrorType = (typeof ERROR_TYPES)[number];
export const ERROR_STATUSES = ["PENDING", "RESOLVED"] as const;
export type ErrorStatus = (typeof ERROR_STATUSES)[number];

export const ERROR_TYPE_INFO: Record<ErrorType, { label: string; description: string }> = {
  UI: { label: "UI error", description: "Something broke in the browser: a page or part of a page crashed, or a script failed." },
  BACKEND: { label: "Backend error", description: "A save or other action failed on the server (server actions and services)." },
  SERVER: { label: "Server error", description: "A page failed to load or an API answered with a server error (500)." },
  DATABASE: { label: "Database error", description: "The database refused a query or couldn't be reached." },
  NETWORK: { label: "Network error", description: "The browser couldn't reach the server (offline, timeout, blocked request)." },
};
export const errorTypeLabel = (t: string) => ERROR_TYPE_INFO[t as ErrorType]?.label ?? t;
