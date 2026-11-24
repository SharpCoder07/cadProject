import "server-only";
import { cache } from "react";
import { draftMode, headers } from "next/headers";
import { db } from "@/server/db";
import { isEditModeUser } from "@/lib/edit-mode-roles";
import type { Principal } from "@/server/rbac/policy";

/**
 * Website edit mode drafts. Everything changed through edit mode on a CMS page's sections or on a
 * settings section (website texts, buttons & labels, company details, theme, page layouts, box
 * designs) is saved here first, not on the live site. Editors see the drafts while edit mode is on
 * (Next.js draft mode, only switched on for people allowed edit mode); visitors never do.
 * "Publish" in the edit bar puts them live (services/edit-drafts.ts), "Discard" deletes them.
 */
export const draftKey = { page: (id: string) => `page:${id}`, setting: (key: string) => `setting:${key}` };

interface DraftRow { key: string; value: unknown; updatedById: string | null; updatedAt: Date }
interface DraftDelegate {
  findMany(args?: { where?: { key?: { startsWith?: string } }; orderBy?: { updatedAt: "asc" | "desc" } }): Promise<DraftRow[]>;
  findUnique(args: { where: { key: string } }): Promise<DraftRow | null>;
  upsert(args: { where: { key: string }; create: { key: string; value: object; updatedById: string | null }; update: { value: object; updatedById: string | null } }): Promise<DraftRow>;
  deleteMany(args?: { where?: { key?: string | { in: string[] } } }): Promise<{ count: number }>;
}
/** The EditDraft table (typed here so this works before and after `prisma generate`). */
export const drafts = (db as unknown as { editDraft: DraftDelegate }).editDraft;

/**
 * Is this request from someone looking at the site through edit mode (draft mode on + allowed)?
 * `editModeOn` is the stored "Website edit mode" switch. Never throws: outside a request, or inside
 * cached code, it's simply "no".
 */
export const draftViewer = cache(async (editModeOn: boolean): Promise<Principal | null> => {
  if (!editModeOn) return null;
  try {
    if (!(await draftMode()).isEnabled) return null;
    // The admin panel and portals always show the live data (middleware marks those requests).
    if ((await headers()).get("x-cg-area") === "staff") return null;
    const { getCurrentUser } = await import("@/server/auth/session");
    const user = await getCurrentUser();
    return isEditModeUser(user) ? user : null;
  } catch {
    return null;
  }
});

/** All drafts (once per request). */
export const allDrafts = cache(async (): Promise<Map<string, unknown>> => {
  try {
    return new Map((await drafts.findMany()).map((d) => [d.key, d.value]));
  } catch {
    return new Map(); // table not created yet (migration not run)
  }
});

export async function getDraft<T = unknown>(key: string): Promise<T | null> {
  const row = await drafts.findUnique({ where: { key } }).catch(() => null);
  return (row?.value as T) ?? null;
}

/** Saves a draft (or removes it with null) and returns what was there before, for Undo. */
export async function setDraft(user: Principal, key: string, value: unknown | null): Promise<{ key: string; before: unknown | null; after: unknown | null }> {
  const before = await getDraft(key);
  if (value === null) await drafts.deleteMany({ where: { key } });
  else await drafts.upsert({ where: { key }, create: { key, value: value as object, updatedById: user.id }, update: { value: value as object, updatedById: user.id } });
  return { key, before, after: value };
}
