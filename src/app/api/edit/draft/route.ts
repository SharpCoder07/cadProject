import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { assertEditMode } from "@/server/rbac/edit-mode";
import { discardDrafts, listDraftChanges, saveDraft } from "@/server/services/edit-drafts";

/**
 * Website edit mode drafts: GET the unpublished changes, POST one draft (or null to remove it — also
 * how Undo / Redo restore an earlier state), DELETE to discard all of them.
 */
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

async function editor() {
  const user = await getCurrentUser();
  if (!user || user.vendorId) throw new AppError("Sign in to the admin panel to edit.", "UNAUTHENTICATED");
  await assertEditMode(user);
  return user;
}

export async function GET() {
  try {
    await editor();
    return NextResponse.json({ changes: await listDraftChanges() }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await editor();
    const body = await readJson(req, z.object({ key: z.string().max(120), value: z.unknown() }), 2_000_000);
    const undo = await saveDraft(user, body.key, body.value ?? null);
    return NextResponse.json({ ok: true, undo }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await editor();
    return NextResponse.json({ ok: true, discarded: await discardDrafts(user) }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
