import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { assertEditMode } from "@/server/rbac/edit-mode";
import { getSettings } from "@/server/settings";
import { saveDraft } from "@/server/services/edit-drafts";
import { draftKey } from "@/server/edit-drafts";
import { LAYOUT_KEYS, resolveLayout, type LayoutPageKey } from "@/lib/layouts";

/**
 * Website edit mode: saves the order and visibility of a page type's sections (product, category,
 * blog article, brand, vendor pages) — the same setting as Admin › Pages › Page layouts, for every
 * page of that type, as an edit-mode draft until published. Needs edit mode and "settings.manage".
 */
export const dynamic = "force-dynamic";

const body = z.object({
  page: z.enum(LAYOUT_KEYS as [LayoutPageKey, ...LayoutPageKey[]]),
  entries: z.array(z.object({ id: z.string().max(40), visible: z.boolean() })).max(60),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await getCurrentUser();
    if (!user || user.vendorId) throw new AppError("Sign in to the admin panel to edit.", "UNAUTHENTICATED");
    await assertEditMode(user);
    const { page, entries } = await readJson(req, body, 20_000);
    const layouts = (await getSettings()).layouts;
    // Normalised: unknown sections dropped, required ones kept on, fixed areas keep their order.
    // Saved as an edit-mode draft (published from the edit bar).
    const undo = await saveDraft(user, draftKey.setting("layouts"), { ...layouts, [page]: resolveLayout(page, entries) });
    return NextResponse.json({ ok: true, undo: [undo] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
