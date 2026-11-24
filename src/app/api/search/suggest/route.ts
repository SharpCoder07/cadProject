import { NextResponse, type NextRequest } from "next/server";
import { searchProvider } from "@/server/services/search";
import { hit, RULES } from "@/server/rate-limit";
import { getRequestMeta } from "@/server/request";

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  const { ip } = await getRequestMeta();
  const limit = await hit(RULES.search, ip ?? "unknown");
  if (!limit.ok) return NextResponse.json({ suggestions: [] }, { status: 429 });
  const suggestions = await searchProvider.suggest(q, 8);
  return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } });
}
