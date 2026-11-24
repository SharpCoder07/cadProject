import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/errors";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { getVapid, sendWebPush } from "@/server/notifications/web-push";
import { removePushSubscription, savePushSubscription } from "@/server/services/inbox";
import { db } from "@/server/db";

/** Browser push: the public key (GET), turning it on for this browser (POST) or off (DELETE). */
export const dynamic = "force-dynamic";

async function me() {
  const user = await getCurrentUser();
  if (!user) throw new AppError("Sign in again.", "UNAUTHENTICATED");
  return user;
}

export async function GET() {
  try {
    await me();
    return NextResponse.json({ publicKey: (await getVapid()).publicKey }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

const subscription = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(10).max(100) }),
  test: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await me();
    const sub = await readJson(req, subscription, 4_000);
    await savePushSubscription(user.id, { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, req.headers.get("user-agent"));
    if (sub.test) {
      const status = await sendWebPush({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { title: "Notifications are on", body: "You'll see updates here even when the site is closed.", tag: "test" });
      if (status === 404 || status === 410) {
        await db.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        throw new AppError("The browser's push service refused this device. Turn notifications off and on again.");
      }
      if (status >= 300) throw new AppError(`The browser's push service answered ${status}. Try again in a minute.`);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const user = await me();
    const { endpoint } = await readJson(req, z.object({ endpoint: z.string().url().max(1000) }), 2_000);
    await removePushSubscription(user.id, endpoint);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
