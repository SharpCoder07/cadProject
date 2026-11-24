import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse } from "@/server/http";
import { assertEditMode } from "@/server/rbac/edit-mode";
import { publishDrafts } from "@/server/services/edit-drafts";

/** Website edit mode: puts every unpublished change live (each with its usual version history). */
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getCurrentUser();
    if (!user || user.vendorId) throw new AppError("Sign in to the admin panel to edit.", "UNAUTHENTICATED");
    await assertEditMode(user);
    return NextResponse.json(await publishDrafts(user), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
