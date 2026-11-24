import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta, hashIp } from "@/server/request";
import { cookieChoiceInput } from "@/lib/compliance/consent";
import { recordCookieChoice } from "@/server/services/compliance/cookies";

/** Logs a cookie banner choice (the choice itself lives in the visitor's cg_cookie_consent cookie). */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const meta = await getRequestMeta();
    const ipHash = hashIp(meta.ip);
    await enforce(RULES.cookieConsent, ipHash ?? "unknown", "Too many requests.");
    const body = await readJson(req, cookieChoiceInput, 4_000);
    const user = await getCurrentUser().catch(() => null);
    await recordCookieChoice(body, { userId: user?.id ?? null, ipHash, userAgent: meta.userAgent });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
