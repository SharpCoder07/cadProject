import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { deleteTemplate, getTemplate, renameTemplate } from "@/server/services/edit-templates";
import { editModeUser as editor } from "@/server/edit-api";

/** One template: GET its content (to insert), PATCH to rename, DELETE. */
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    return NextResponse.json(await getTemplate(await editor(), (await params).id), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    const { name } = await readJson(req, z.object({ name: z.string() }), 2_000);
    await renameTemplate(await editor(), (await params).id, name);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    assertSameOrigin(req);
    await deleteTemplate(await editor(), (await params).id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
