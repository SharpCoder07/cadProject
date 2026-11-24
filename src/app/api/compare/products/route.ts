import { NextResponse, type NextRequest } from "next/server";
import { compareCatalog } from "@/server/services/catalog";
import { hit, RULES } from "@/server/rate-limit";
import { getRequestMeta } from "@/server/request";

/** Products for the compare page's "Choose product" dialog (?q= filters by name, brand, vendor or category). */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  const { ip } = await getRequestMeta();
  const limit = await hit(RULES.search, ip ?? "unknown");
  if (!limit.ok) return NextResponse.json({ total: 0, items: [] }, { status: 429 });
  const data = await compareCatalog(q);
  return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600" } });
}
