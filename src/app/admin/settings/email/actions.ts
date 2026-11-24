"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { email } from "@/lib/validation/common";
import { getSettings, updateSetting } from "@/server/settings";
import { resetTemplate, saveSmtpSettings, saveTemplate, sendTestEmail, smtpInput, templateInput, testSmtpConnection } from "@/server/email/config";
import { TEMPLATE_KEYS } from "@/server/email/templates";
import { actor, refresh } from "../../_lib";

export const saveSmtpAction = action(smtpInput, async (input) => {
  await saveSmtpSettings(await actor(), input);
  refresh("/admin/settings/email", "/admin/integrations");
  return ok(undefined, input.enabled ? "Email settings saved" : "Saved. Sending is switched off.");
});

export const testSmtpAction = action(smtpInput, async (input) => {
  await testSmtpConnection(await actor(), input);
  return ok(undefined, `Connected to ${input.host}:${input.port} and signed in successfully`);
});

export const sendTestAction = action(z.object({ to: email }), async ({ to }) => {
  await sendTestEmail(await actor(), to);
  return ok(undefined, `Test email sent to ${to}. Check the inbox (and spam folder).`);
});

export const saveNotificationsAction = action(
  z.object({
    notifyEmails: z.string().max(2000),
    emailSalesOnNewLead: z.boolean(),
    emailAssignee: z.boolean(),
    emailConfirmation: z.boolean(),
    notifyVendor: z.boolean(),
    notifyResellers: z.boolean(),
  }),
  async ({ notifyEmails, ...flags }) => {
    const list = [...new Set(notifyEmails.split(/[,\n;]/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
    const bad = list.filter((e) => !email.safeParse(e).success);
    if (bad.length) return { ok: false as const, error: "Check the highlighted fields.", fieldErrors: { notifyEmails: [`Not a valid email: ${bad.join(", ")}`] } };
    const { leads } = await getSettings();
    await updateSetting(await actor(), "leads", { ...leads, ...flags, notifyEmails: list });
    refresh("/admin/settings/email", "/admin/settings");
    return ok(undefined, "Notification settings saved");
  },
);

export const saveTemplateAction = action(templateInput, async (input) => {
  await saveTemplate(await actor(), input);
  refresh("/admin/settings/email");
  return ok(undefined, "Template saved");
});

export const resetTemplateAction = action(z.object({ key: z.enum(TEMPLATE_KEYS) }), async ({ key }) => {
  await resetTemplate(await actor(), key);
  refresh("/admin/settings/email");
  return ok(undefined, "Template reset to the default");
});
