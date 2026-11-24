import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { recordView } from "@/server/services/catalog";
import { hit, RULES } from "@/server/rate-limit";
import { getRequestMeta } from "@/server/request";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ip, userAgent } = await getRequestMeta();
  if (/bot|crawl|spider|slurp|preview/i.test(userAgent ?? "")) return new NextResponse(null, { status: 204 });
  if (!(await hit(RULES.search, ip ?? "unknown")).ok) return new NextResponse(null, { status: 204 });
  const sw = await db.software.findFirst({ where: { slug, status: "PUBLISHED" }, select: { id: true } });
  if (sw) await recordView(sw.id).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
