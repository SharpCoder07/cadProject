import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { liveRequest, loadLive, saveLive } from "@/server/services/live-edit";
import { assertEditMode } from "@/server/rbac/edit-mode";

/** Website edit mode, editing in place: current values (GET) and saving changed fields (POST). */
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

async function staff() {
  const user = await getCurrentUser();
  if (!user || user.vendorId) throw new AppError("Sign in to the admin panel to edit.", "UNAUTHENTICATED");
  await assertEditMode(user);
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await staff();
    const { kind, id } = liveRequest.parse({ kind: req.nextUrl.searchParams.get("kind"), id: req.nextUrl.searchParams.get("id") ?? "" });
    return NextResponse.json(await loadLive(user, kind, id), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await staff();
    const body = await readJson(req, liveRequest.extend({ values: z.record(z.unknown()) }), 1_000_000);
    const undo = await saveLive(user, body.kind, body.id, body.values);
    return NextResponse.json({ ok: true, undo }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
