import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { env } from "@/server/env";
import { safeEqual } from "@/server/auth/tokens";
import { ALL_CACHE_TAGS } from "@/server/cache-tags";

const TAGS = ALL_CACHE_TAGS;

/**
 * Clears the site's data cache so changes made straight in the database (e.g. `npm run db:seed`)
 * show at once. Called by the seed script; needs `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEqual(auth, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  for (const t of TAGS) revalidateTag(t);
  revalidatePath("/", "layout");
  return NextResponse.json({ revalidated: TAGS.length });
}
