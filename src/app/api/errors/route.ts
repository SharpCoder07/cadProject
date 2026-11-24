import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta, hashIp } from "@/server/request";
import { recordError } from "@/server/error-log";

/**
 * Errors reported by the browser (src/components/error-reporter.tsx). Anyone may report (visitors too), so it's
 * same-origin only, rate limited per network and size limited; the browser can only report UI and network errors.
 */
const schema = z.object({
  type: z.enum(["UI", "NETWORK"]),
  message: z.string().min(1).max(1000),
  details: z.string().max(8000).nullable().optional(),
  source: z.string().max(500).nullable().optional(),
  digest: z.string().max(100).nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const meta = await getRequestMeta();
    await enforce(RULES.errorReport, hashIp(meta.ip) ?? "unknown", "Too many error reports.");
    const body = await readJson(req, schema, 16_000);
    const user = await getCurrentUser().catch(() => null);
    await recordError({
      type: body.type,
      message: body.message,
      details: body.details ?? null,
      source: body.source ?? null,
      digest: body.digest ?? null,
      userId: user?.id ?? null,
      userName: user ? `${user.name} (${user.email})` : null,
      userAgent: meta.userAgent,
    });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
