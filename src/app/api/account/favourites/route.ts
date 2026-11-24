import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { favouriteStatus, setFavourite } from "@/server/services/offers";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";

/** Favourite state for the heart on a public product page (buyer accounts; signed-out visitors are asked to sign in). */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug") ?? "";
  const status = await favouriteStatus(await getCurrentUser(), slug.slice(0, 200));
  return NextResponse.json(status, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { softwareId, on } = await readJson(req, z.object({ softwareId: z.string().cuid(), on: z.boolean() }), 2_000);
    await setFavourite(await getCurrentUser(), softwareId, on);
    return NextResponse.json({ ok: true, favourited: on });
  } catch (e) {
    return errorResponse(e);
  }
}
