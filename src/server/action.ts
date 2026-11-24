import "server-only";
import { z } from "zod";
import { AppError } from "@/server/errors";
import { getCurrentUser } from "@/server/auth/session";
import { VIEW_ONLY_MESSAGE } from "@/server/rbac/permissions";
import { reportRequestError } from "@/server/error-log";

/** Uniform result for server actions, consumed by forms on the client. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string; /** Sent to the Super Admin for approval; nothing changed yet. */ queued?: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const ok = <T>(data: T, message?: string): ActionResult<T> => ({ ok: true, data, message });

/**
 * Wraps a server action body: validates input with Zod, maps AppError to a
 * user-facing message, and logs unexpected errors without leaking details.
 */
export function action<S extends z.ZodTypeAny, T>(schema: S, handler: (input: z.infer<S>) => Promise<ActionResult<T>>) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
    }
    try {
      // View-only (demo) accounts can look around but never change anything.
      if ((await getCurrentUser())?.readOnly) return { ok: false, error: VIEW_ONLY_MESSAGE };
      return await handler(parsed.data);
    } catch (e) {
      // A deletion (or a change that removes elements) without the Delete permission: a request went to the
      // Super Admin. Shown as a success message; the data wasn't changed.
      if (e instanceof AppError && e.code === "QUEUED") return { ok: true, data: undefined as T, message: e.message, queued: true };
      return toActionError(e);
    }
  };
}

export function toActionError(e: unknown): { ok: false; error: string; fieldErrors?: Record<string, string[]> } {
  if (e instanceof AppError && e.code !== "QUEUED") return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  // Next.js uses thrown errors for redirect()/notFound(); let them propagate.
  if (typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
  console.error("[action] unexpected error", e);
  reportRequestError(e, "BACKEND");
  return { ok: false, error: "Something went wrong on our side. The error has been logged; please try again." };
}
