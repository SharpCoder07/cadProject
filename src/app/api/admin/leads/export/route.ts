import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { exportLeadsCsv } from "@/server/services/leads";
import { errorResponse } from "@/server/http";
import { AppError } from "@/server/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("Sign in to continue.", "UNAUTHENTICATED");
    const query = Object.fromEntries(req.nextUrl.searchParams.entries());
    const gen = exportLeadsCsv(user, { ...query, perPage: 100 });
    // Pull the first chunk so permission errors surface as JSON, not a broken download.
    const first = await gen.next();
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
      },
      async pull(controller) {
        const { value, done } = await gen.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      },
    });
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(stream, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${stamp}.csv"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
