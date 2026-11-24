import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { AppError, forbidden, notFound } from "@/server/errors";
import { audit } from "@/server/audit";
import { can, type Principal } from "@/server/rbac/policy";
import { ERROR_TYPES, type ErrorStatus, type ErrorType } from "@/lib/error-types";

/**
 * Error logs (Admin › Logs › Error logs). Everything that goes wrong is recorded here:
 * - Backend errors: unexpected failures in server actions (src/server/action.ts).
 * - Server errors: API routes answering 500 (src/server/http.ts) and pages that fail to render (src/instrumentation.ts).
 * - Database errors: any of the above caused by the database (Prisma).
 * - UI and network errors: reported by the browser (src/components/error-reporter.tsx → /api/errors).
 * Repeats of a pending error add to its count instead of new rows; an error marked resolved that happens again is
 * reopened (status Pending, "Happened again"). Recording never throws, so it can't cause new errors.
 */

export interface ErrorInput {
  type?: ErrorType;
  message: string;
  details?: string | null;
  source?: string | null;
  method?: string | null;
  statusCode?: number | null;
  digest?: string | null;
  userId?: string | null;
  userName?: string | null;
  userAgent?: string | null;
}

interface Row {
  id: string; type: string; status: string; message: string; details: string | null; source: string | null; method: string | null;
  statusCode: number | null; digest: string | null; fingerprint: string; count: number; firstSeenAt: Date; lastSeenAt: Date;
  userId: string | null; userName: string | null; userAgent: string | null; reopenedAt: Date | null; resolvedAt: Date | null;
  resolvedById: string | null; resolvedByName: string | null; note: string | null;
}
interface Delegate {
  findFirst(q: unknown): Promise<Row | null>;
  findUnique(q: unknown): Promise<Row | null>;
  findMany(q: unknown): Promise<Row[]>;
  count(q: unknown): Promise<number>;
  create(q: unknown): Promise<Row>;
  update(q: unknown): Promise<Row>;
  updateMany(q: unknown): Promise<{ count: number }>;
  deleteMany(q: unknown): Promise<{ count: number }>;
  groupBy(q: unknown): Promise<{ type: string; status: string; _count: { _all: number } }[]>;
}
/** Typed access until `prisma generate` has picked up the new table. */
const logs = (db as unknown as { errorLog: Delegate }).errorLog;

const clip = (s: string | null | undefined, n: number) => (s ? String(s).slice(0, n) : null);
/** Secrets never go in the log: tokens and passwords in URLs or messages are masked. */
const scrub = (s: string) =>
  s
    .replace(/((?:token|password|secret|key|code|signature)=)[^&\s"']+/gi, "$1•••")
    .replace(/(\/(?:invite|reset-password|verify-email)\/)[^/?\s"']+/gi, "$1•••")
    .replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1•••@");

/** Same error → same fingerprint: numbers, ids and quoted values don't make a new one. */
function fingerprintOf(type: string, message: string, source: string | null, details: string | null) {
  const norm = (s: string) => s.replace(/[0-9a-f]{8,}/gi, "#").replace(/\d+/g, "#").replace(/“[^”]*”|"[^"]*"|'[^']*'/g, "…").slice(0, 300);
  const frame = details?.split("\n").find((l) => /\bat\b/.test(l))?.trim() ?? "";
  const place = (source ?? "").replace(/\?.*$/, "").replace(/\/[^/]*\d[^/]*/g, "/#");
  return createHash("sha256").update([type, norm(message), place, norm(frame)].join("|")).digest("hex").slice(0, 40);
}

const isDatabaseError = (e: unknown) => {
  const name = (e as { name?: string } | null)?.name ?? "";
  const code = String((e as { code?: unknown } | null)?.code ?? "");
  return name.startsWith("PrismaClient") || /^P\d{4}$/.test(code) || /ECONNREFUSED.*5432|database|prisma/i.test(String((e as Error)?.message ?? ""));
};

/** Turns any thrown value into an ErrorInput. */
export function fromException(e: unknown, fallbackType: ErrorType, extra: Partial<ErrorInput> = {}): ErrorInput {
  const err = e instanceof Error ? e : new Error(typeof e === "string" ? e : JSON.stringify(e));
  return {
    type: isDatabaseError(e) ? "DATABASE" : fallbackType,
    message: `${err.name && err.name !== "Error" ? `${err.name}: ` : ""}${err.message || "Unknown error"}`,
    details: err.stack ?? null,
    digest: (e as { digest?: string } | null)?.digest ?? null,
    ...extra,
  };
}

/** Records an error. Never throws. */
export async function recordError(input: ErrorInput): Promise<void> {
  try {
    const type = input.type && ERROR_TYPES.includes(input.type) ? input.type : "SERVER";
    const message = scrub(clip(input.message, 1000) ?? "Unknown error");
    const details = input.details ? scrub(clip(input.details, 8000)!) : null;
    const source = input.source ? scrub(clip(input.source, 500)!) : null;
    const fingerprint = fingerprintOf(type, message, source, details);
    const now = new Date();
    const last = await logs.findFirst({ where: { fingerprint }, orderBy: { lastSeenAt: "desc" } });
    const seen = { lastSeenAt: now, count: { increment: 1 }, digest: clip(input.digest, 100) ?? undefined, userId: input.userId ?? undefined, userName: clip(input.userName, 120) ?? undefined, userAgent: clip(input.userAgent, 400) ?? undefined, details: details ?? undefined };
    if (last?.status === "PENDING") {
      await logs.update({ where: { id: last.id }, data: seen });
      return;
    }
    if (last?.status === "RESOLVED") {
      await logs.update({ where: { id: last.id }, data: { ...seen, status: "PENDING", reopenedAt: now } });
      return;
    }
    await logs.create({
      data: {
        type, message, details, source, fingerprint,
        method: clip(input.method, 10), statusCode: input.statusCode ?? null, digest: clip(input.digest, 100),
        userId: input.userId ?? null, userName: clip(input.userName, 120), userAgent: clip(input.userAgent, 400),
      },
    });
  } catch (e) {
    // The log itself failed (e.g. the database is down): the console still has it.
    console.error("[error-log] couldn't record an error", e instanceof Error ? e.message : e);
  }
}

/** Records in the background; the caller doesn't wait. */
export const reportError = (input: ErrorInput) => void recordError(input);

/**
 * An unexpected failure inside a server action or API route: recorded with where it happened and who was signed in.
 * Reads the request (path set by the middleware, user agent) but never fails because of it.
 */
export function reportRequestError(e: unknown, type: ErrorType, extra: Partial<ErrorInput> = {}) {
  void (async () => {
    let source: string | null = null, method: string | null = null, userAgent: string | null = null, userId: string | null = null, userName: string | null = null;
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      source = h.get("x-cg-path") ?? (h.get("referer") ? new URL(h.get("referer")!).pathname : null);
      method = h.get("next-action") ? "ACTION" : null;
      userAgent = h.get("user-agent");
      const { getCurrentUser } = await import("@/server/auth/session");
      const u = await getCurrentUser().catch(() => null);
      if (u) { userId = u.id; userName = `${u.name} (${u.email})`; }
    } catch { /* outside a request */ }
    await recordError(fromException(e, type, { source, method, userAgent, userId, userName, ...extra }));
  })();
}

// ─── Admin ───────────────────────────────────────────────────────────────────

const PAGE = 50;

export async function listErrors(user: Principal, q: { status?: ErrorStatus | "ALL"; type?: ErrorType; q?: string; page?: number }) {
  if (!can(user, "errors.view")) throw forbidden();
  const where: Record<string, unknown> = {
    ...(q.status && q.status !== "ALL" ? { status: q.status } : {}),
    ...(q.type ? { type: q.type } : {}),
    ...(q.q?.trim() ? { OR: [{ message: { contains: q.q.trim(), mode: "insensitive" } }, { source: { contains: q.q.trim(), mode: "insensitive" } }, { digest: q.q.trim() }] } : {}),
  };
  const page = Math.max(1, q.page ?? 1);
  const [items, total, counts] = await Promise.all([
    logs.findMany({ where, orderBy: { lastSeenAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE }),
    logs.count({ where }),
    logs.groupBy({ by: ["type", "status"], _count: { _all: true } }),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / PAGE)), counts, perPage: PAGE };
}

export async function getError(user: Principal, id: string) {
  if (!can(user, "errors.view")) throw forbidden();
  const r = await logs.findUnique({ where: { id } });
  if (!r) throw notFound("Error");
  return r;
}

export async function setErrorStatus(user: Principal, ids: string[], status: ErrorStatus, note?: string | null) {
  if (!can(user, "errors.manage")) throw forbidden();
  if (!ids.length) throw new AppError("Choose at least one error.");
  const resolved = status === "RESOLVED";
  const { count } = await logs.updateMany({
    where: { id: { in: ids } },
    data: {
      status,
      resolvedAt: resolved ? new Date() : null,
      resolvedById: resolved ? user.id : null,
      resolvedByName: resolved ? user.name : null,
      ...(note !== undefined ? { note: clip(note?.trim(), 2000) || null } : {}),
    },
  });
  await audit({ actorId: user.id, action: resolved ? "error.resolve" : "error.reopen", entityType: "error_log", entityId: ids.length === 1 ? ids[0] : null, summary: `Marked ${count} error(s) ${resolved ? "resolved" : "pending"}` });
  return count;
}

export async function saveErrorNote(user: Principal, id: string, note: string | null) {
  if (!can(user, "errors.manage")) throw forbidden();
  await logs.update({ where: { id }, data: { note: clip(note?.trim(), 2000) || null } });
}

export async function pendingErrorCount(user: Principal) {
  if (!can(user, "errors.view")) return 0;
  return logs.count({ where: { status: "PENDING" } }).catch(() => 0);
}

/**
 * Automatic resolving (every cron run): a pending error that hasn't happened again for the hours set on the Error
 * logs page (default 24) is marked resolved. If it happens again later it reopens as "happened again".
 */
export async function autoResolveQuietErrors(): Promise<number> {
  const { getSettings } = await import("@/server/settings");
  const hours = (await getSettings()).errorLogs?.autoResolveHours ?? 24;
  if (!hours) return 0;
  const now = new Date();
  const { count } = await logs.updateMany({
    where: { status: "PENDING", lastSeenAt: { lt: new Date(now.getTime() - hours * 3_600_000) } },
    data: { status: "RESOLVED", resolvedAt: now, resolvedById: null, resolvedByName: `Automatically: no repeat for ${hours} h` },
  });
  if (count) await audit({ actorId: null, action: "error.auto_resolve", entityType: "error_log", summary: `${count} error${count === 1 ? "" : "s"} resolved automatically (no repeat for ${hours} hours)` }).catch(() => {});
  return count;
}

/** Resolved errors are removed after 90 days (daily cron). Pending ones stay until someone resolves them. */
export async function pruneErrorLogs(days = 90) {
  const { count } = await logs.deleteMany({ where: { status: "RESOLVED", lastSeenAt: { lt: new Date(Date.now() - days * 86_400_000) } } });
  return count;
}
