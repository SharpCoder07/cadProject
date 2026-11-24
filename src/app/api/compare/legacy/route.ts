import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/server/env";
import { legacyCompareTarget } from "@/server/services/compare-urls";

/**
 * Old comparison links (/compare/?products[]=97061&products[]=97341, /compare?p=a,b) are sent here by
 * the middleware and answered with a permanent (301) redirect to /compare/a-vs-b.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const target = await legacyCompareTarget(req.nextUrl.searchParams).catch(() => "/compare");
  const base = new URL(env.APP_URL).origin === req.nextUrl.origin ? env.APP_URL : req.nextUrl.origin;
  return NextResponse.redirect(new URL(target, base), { status: 301, headers: { "Cache-Control": "public, max-age=3600" } });
}
export const HEAD = GET;
