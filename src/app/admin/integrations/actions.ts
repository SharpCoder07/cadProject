"use server";

import { action, ok } from "@/server/action";
import { saveSlack, saveWebhook, slackInput, testSlack, testWebhook, webhookInput } from "@/server/integrations";
import { actor, refresh } from "../_lib";

export const saveWebhookAction = action(webhookInput, async (input) => {
  await saveWebhook(await actor(), input);
  refresh("/admin/integrations");
  return ok(undefined, input.isEnabled ? "Lead webhook saved and switched on" : "Lead webhook saved (switched off)");
});

export const testWebhookAction = action(webhookInput, async (input) => {
  await testWebhook(await actor(), input);
  return ok(undefined, "Test lead sent — check your CRM or automation tool");
});

export const saveSlackAction = action(slackInput, async (input) => {
  await saveSlack(await actor(), input);
  refresh("/admin/integrations");
  return ok(undefined, input.isEnabled ? "Slack alerts saved and switched on" : "Slack alerts saved (switched off)");
});

export const testSlackAction = action(slackInput, async (input) => {
  await testSlack(await actor(), input);
  return ok(undefined, "Test message posted — check your Slack channel");
});
