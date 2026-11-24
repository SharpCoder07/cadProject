import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { clearRead, listInbox, markRead, setNotifyPref } from "@/server/services/inbox";

/** The signed-in person's bell: list (GET), mark read / clear / switch a type on or off (POST). */
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Sign in again.", "UNAUTHENTICATED");
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await me();
    const p = req.nextUrl.searchParams;
    const data = await listInbox(user.id, { take: Number(p.get("take")) || 15, before: p.get("before"), unreadOnly: p.get("unread") === "1" });
    return NextResponse.json(data, { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("read"), ids: z.union([z.array(z.string().cuid()).max(200), z.literal("all")]) }),
  z.object({ op: z.literal("clear") }),
  z.object({ op: z.literal("pref"), type: z.string().max(60), on: z.boolean() }),
]);

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await me();
    const input = await readJson(req, body, 20_000);
    if (input.op === "read") return NextResponse.json({ ok: true, updated: await markRead(user.id, input.ids) });
    if (input.op === "clear") return NextResponse.json({ ok: true, removed: await clearRead(user.id) });
    await setNotifyPref(user, input.type, input.on);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
