import { NextResponse, type NextRequest } from "next/server";
import { draftMode } from "next/headers";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { canUseEditMode } from "@/server/rbac/edit-mode";

/**
 * Website edit mode on / off for this browser. On: Next.js draft mode, so pages are rendered fresh
 * with the unpublished drafts (only for people allowed edit mode — checked again on every page).
 */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { on } = await readJson(req, z.object({ on: z.boolean() }), 1_000);
    const dm = await draftMode();
    if (on && (await canUseEditMode(await getCurrentUser()))) dm.enable();
    else dm.disable();
    return NextResponse.json({ ok: true, on: dm.isEnabled }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
