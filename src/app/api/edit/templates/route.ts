import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { editModeUser as editor } from "@/server/edit-api";
import { listTemplates, saveTemplate, TEMPLATE_KINDS } from "@/server/services/edit-templates";

/** Website edit mode templates: GET the list, POST to save one. */
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    return NextResponse.json({ templates: await listTemplates(await editor()) }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await editor();
    const body = await readJson(req, z.object({ name: z.string(), kind: z.enum(TEMPLATE_KINDS), data: z.unknown() }), 2_000_000);
    return NextResponse.json({ ok: true, template: await saveTemplate(user, body) }, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
