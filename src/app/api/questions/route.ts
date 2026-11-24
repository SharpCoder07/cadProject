import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { askQuestion, questionSubmission } from "@/server/services/questions";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta } from "@/server/request";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/** "Ask a question" on a product page (signed-in buyers). */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { ip } = await getRequestMeta();
    await enforce({ ...RULES.question, limit: (await getSettings()).rules.questionsPerHour }, ip, "Too many questions from this network. Please try again later.");
    const input = await readJson(req, questionSubmission);
    return NextResponse.json(await askQuestion(await getCurrentUser(), input), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** For the question form: is the visitor signed in as a buyer? */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ signedIn: Boolean(user), canAsk: Boolean(user?.permissions.has("buyer.account")) }, { headers: { "Cache-Control": "private, no-store" } });
}
