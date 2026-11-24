/** Errors whose message is safe to show to the user. Anything else is logged and replaced by a generic message. */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "QUEUED" = "BAD_REQUEST",
    public readonly fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what = "Record") => new AppError(`${what} not found.`, "NOT_FOUND");
/**
 * Not an error for the user: the change wasn't made yet because it needs approval, and a request was sent.
 * Server actions turn it into a success message; nothing was changed.
 */
export const queued = (msg: string) => new AppError(msg, "QUEUED");
export const isQueued = (e: unknown): e is AppError => e instanceof AppError && e.code === "QUEUED";
export const forbidden = (msg = "You don't have permission to do that.") => new AppError(msg, "FORBIDDEN");

export function isUniqueViolation(e: unknown, field?: string): boolean {
  if (typeof e !== "object" || e === null || !("code" in e) || (e as { code: unknown }).code !== "P2002") return false;
  if (!field) return true;
  const target = (e as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) ? target.includes(field) : String(target ?? "").includes(field);
}
