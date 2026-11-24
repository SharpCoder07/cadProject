"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { answerQuestion, deleteQuestion, setQuestionStatus } from "@/server/services/questions";
import { actor, refresh } from "../_lib";

const id = z.string().cuid();

export const answerQuestionAction = action(z.object({ id, answer: z.string().trim().min(2, "Write an answer.").max(3000) }), async ({ id: qid, answer }) => {
  await answerQuestion(await actor(), qid, answer);
  refresh("/admin/questions");
  return ok(undefined, "Answer published on the product page");
});

export const setQuestionStatusAction = action(z.object({ id, status: z.enum(["APPROVED", "REJECTED"]) }), async ({ id: qid, status }) => {
  await setQuestionStatus(await actor(), qid, status);
  refresh("/admin/questions");
  return ok(undefined, status === "APPROVED" ? "Published" : "Hidden from the product page");
});

export const deleteQuestionAction = action(z.object({ id }), async ({ id: qid }) => {
  await deleteQuestion(await actor(), qid);
  refresh("/admin/questions");
  return ok(undefined, "Question deleted");
});
