import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta, hashIp } from "@/server/request";
import { chatQuestionInput } from "@/lib/chatbot";
import { answerQuestion } from "@/server/services/chatbot";

/** Help chat on the website (Website settings › Help chat): answers from the FAQs and the catalogue. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const meta = await getRequestMeta();
    await enforce(RULES.chat, hashIp(meta.ip) ?? "unknown", "Too many questions. Please wait a moment.");
    const { q } = await readJson(req, chatQuestionInput, 2_000);
    return NextResponse.json(await answerQuestion(q));
  } catch (e) {
    return errorResponse(e);
  }
}
