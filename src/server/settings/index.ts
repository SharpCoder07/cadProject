import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit, shallowDiff } from "@/server/audit";
import { AppError } from "@/server/errors";
import type { Principal } from "@/server/rbac/policy";
import { assertCan } from "@/server/rbac/policy";
import { parseSetting, settingSchemas, SETTING_KEYS, type SettingKey, type Settings } from "./schemas";
import { isEditModeRole } from "@/lib/edit-mode-roles";
import { cache } from "react";
import { allDrafts, draftKey, draftViewer } from "@/server/edit-drafts";
import { guardRemovals } from "@/server/rbac/deletion";

export const SETTINGS_TAG = "settings";

/** All settings as saved (live site), cached and invalidated by tag on every update. */
export const getStoredSettings = unstable_cache(
  async (): Promise<Settings> => {
    const rows = await db.setting.findMany({ where: { key: { in: SETTING_KEYS } } });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return Object.fromEntries(SETTING_KEYS.map((k) => [k, parseSetting(k, byKey.get(k))])) as Settings;
  },
  // The key list is part of the cache key, so adding a new settings section never serves an old cached copy without it.
  ["settings:all", SETTING_KEYS.join(",")],
  { tags: [SETTINGS_TAG], revalidate: 3600 },
);

/**
 * All settings. For someone looking at the site in edit mode, unpublished drafts of settings
 * (website texts, labels, theme, box designs, page layouts…) are shown on top (server/edit-drafts).
 */
export const getSettings = cache(async (): Promise<Settings> => {
  const base = await getStoredSettings();
  if (!(await draftViewer(base.editMode.enabled))) return base;
  const all = await allDrafts();
  const out = { ...base } as Record<SettingKey, unknown>;
  for (const k of SETTING_KEYS) {
    const d = all.get(draftKey.setting(k));
    if (d !== undefined) out[k] = parseSetting(k, d);
  }
  return out as Settings;
});

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

/** Who may change a settings section (also used for edit-mode drafts of it). */
export function assertCanChangeSetting(user: Principal, key: SettingKey) {
  if (key === "editMode" && !isEditModeRole(user)) throw new AppError("Only Super Admin and Admin can change website edit mode.", "FORBIDDEN");
  assertCan(user, key === "analytics" ? "integrations.manage" : key === "geo" ? "geo.manage" : key === "compareShowcase" ? "comparisons.manage" : key === "compliance" ? "compliance.manage" : key === "errorLogs" ? "errors.manage" : "settings.manage");
}

export async function updateSetting<K extends SettingKey>(user: Principal, key: K, value: unknown): Promise<Settings[K]> {
  assertCanChangeSetting(user, key);
  const parsed = settingSchemas[key].safeParse(value);
  if (!parsed.success) {
    throw new AppError("Check the highlighted fields.", "BAD_REQUEST", parsed.error.flatten().fieldErrors as Record<string, string[]>);
  }
  const before = await db.setting.findUnique({ where: { key } });
  // Removing items from a settings list (footer links, menus, wording lists…) needs Delete permission.
  await guardRemovals(user, { kind: "setting.save", args: { key, value }, label: `Settings: ${key}`, before: before?.value ?? {}, after: parsed.data, root: "the settings" });
  const data = parsed.data as Prisma.InputJsonValue;
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({ where: { key }, create: { key, value: data }, update: { value: data } });
    await audit(
      {
        actorId: user.id,
        action: "settings.update",
        entityType: "setting",
        entityId: key,
        summary: `Updated ${key} settings`,
        diff: shallowDiff((before?.value as Record<string, unknown>) ?? {}, parsed.data as Record<string, unknown>) as Prisma.InputJsonValue,
      },
      tx,
    );
  });
  revalidateTag(SETTINGS_TAG);
  return parsed.data as Settings[K];
}

export * from "./schemas";
