import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { myReviewFor, reviewSubmission, submitReview } from "@/server/services/reviews";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta } from "@/server/request";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { ip } = await getRequestMeta();
    await enforce({ ...RULES.review, limit: (await getSettings()).rules.reviewsPerHour }, ip, "Too many reviews from this network. Please try again later.");
    const input = await readJson(req, reviewSubmission);
    const result = await submitReview(await getCurrentUser(), input, ip);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** For the review form: is the visitor signed in as a buyer, and have they reviewed this product already? */
export async function GET(req: NextRequest) {
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").slice(0, 200);
  const user = await getCurrentUser();
  const body = user
    ? { signedIn: true, canReview: user.permissions.has("buyer.account"), name: user.name, existing: user.permissions.has("buyer.account") ? await myReviewFor(user.id, slug) : null }
    : { signedIn: false, canReview: false, name: null, existing: null };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
