import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { AppError } from "@/server/errors";
import { env } from "@/server/env";
import { reportRequestError } from "@/server/error-log";

const STATUS: Record<AppError["code"], number> = {
  BAD_REQUEST: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, CONFLICT: 409, RATE_LIMITED: 429, QUEUED: 202,
};

/** Rejects cross-site POSTs to public endpoints (CSRF defence in addition to SameSite cookies). */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; still rate limited
  const allowed = new Set([new URL(env.APP_URL).origin, req.nextUrl.origin]);
  if (!allowed.has(origin)) throw new AppError("Cross-site request blocked.", "FORBIDDEN");
}

export async function readJson<S extends z.ZodTypeAny>(req: NextRequest, schema: S, maxBytes = 64_000): Promise<z.infer<S>> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new AppError("Request is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError("Request is too large.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AppError("Invalid request body.");
  }
  return schema.parse(data);
}

/** Maps errors to JSON responses without leaking internals. */
export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    return NextResponse.json({ error: "Check the highlighted fields.", fieldErrors: e.flatten().fieldErrors }, { status: 400 });
  }
  if (e instanceof AppError) {
    // Sent to the Super Admin for approval (nothing changed): not an error, but carries the message.
    if (e.code === "QUEUED") return NextResponse.json({ queued: true, message: e.message }, { status: 202 });
    return NextResponse.json({ error: e.message, fieldErrors: e.fieldErrors }, { status: STATUS[e.code] });
  }
  console.error("[api] unexpected error", e);
  reportRequestError(e, "SERVER", { statusCode: 500 });
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
