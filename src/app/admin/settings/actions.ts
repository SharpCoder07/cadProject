"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { SETTING_KEYS, updateSetting, type SettingKey } from "@/server/settings";
import { actor, refresh } from "../_lib";

export const saveSettingAction = action(z.object({ key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]), value: z.unknown() }), async ({ key, value }) => {
  await updateSetting(await actor(), key, value);
  refresh("/admin/settings", "/admin/seo", "/admin/integrations", "/", "/admin");
  return ok(undefined, "Settings saved — the site is updated");
});

