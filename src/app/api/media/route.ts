import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { listMedia } from "@/server/services/media";
import { errorResponse } from "@/server/http";
import { assertCan } from "@/server/rbac/policy";

/** Media picker feed for admin forms. */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    assertCan(user, "media.view");
    const sp = req.nextUrl.searchParams;
    const kind = sp.get("kind");
    const result = await listMedia(user, { q: sp.get("q") ?? undefined, kind: kind === "image" || kind === "document" ? kind : undefined, page: Number(sp.get("page")) || 1, perPage: 30 });
    return NextResponse.json({ ...result, items: result.items.map((a) => ({ id: a.id, url: a.url, filename: a.filename, mimeType: a.mimeType, alt: a.alt, width: a.width, height: a.height })) });
  } catch (e) {
    return errorResponse(e);
  }
}
