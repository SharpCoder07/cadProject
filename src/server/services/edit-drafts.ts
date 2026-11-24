import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { draftKey, drafts, getDraft, setDraft } from "@/server/edit-drafts";
import { assertCanChangeSetting, settingSchemas, SETTING_KEYS, updateSetting, type SettingKey } from "@/server/settings";
import { cleanBlockData, saveSections } from "./cms";
import { isBlockType } from "@/lib/blocks/schemas";
import { audit } from "@/server/audit";
import { isQueued } from "@/server/errors";
import { canDeleteSections } from "@/lib/section-delete";
import { NO_DELETE_MESSAGE } from "@/lib/delete-permission";

/**
 * Website edit mode drafts: saving (with Undo info), listing, publishing and discarding.
 * See server/edit-drafts.ts for how editors see them.
 */
export interface UndoEntry { key: string; before: unknown | null; after: unknown | null }

/** One section of a page draft (same shape as the page builder's sections; new ones get a draft id). */
export interface DraftSection { id: string; type: string; label: string | null; isEnabled: boolean; data: Record<string, unknown>; reusableBlockId: string | null }

const sectionList = z.array(
  z.object({
    id: z.string().max(60).optional(),
    type: z.string().max(40),
    label: z.string().max(120).nullable().optional(),
    isEnabled: z.boolean().default(true),
    data: z.record(z.unknown()).default({}),
    reusableBlockId: z.string().max(60).nullable().optional(),
  }),
).max(80);

/** A page's sections as they are now (its draft if there is one), all of them (hidden too). */
export async function currentPageSections(pageId: string): Promise<DraftSection[]> {
  const draft = await getDraft<DraftSection[]>(draftKey.page(pageId));
  if (draft) return draft;
  const rows = await db.pageSection.findMany({ where: { pageId }, orderBy: { sortOrder: "asc" } });
  return rows.map((s) => ({ id: s.id, type: s.type, label: s.label, isEnabled: s.isEnabled, data: (s.data as Record<string, unknown>) ?? {}, reusableBlockId: s.reusableBlockId }));
}

/** Which page a section is on (also for sections that so far only exist in a draft). */
export async function pageOfSection(sectionId: string): Promise<string | null> {
  const row = await db.pageSection.findUnique({ where: { id: sectionId }, select: { pageId: true } });
  if (row) return row.pageId;
  for (const d of await drafts.findMany({ where: { key: { startsWith: "page:" } } }).catch(() => [])) {
    if ((d.value as DraftSection[]).some((s) => s.id === sectionId)) return d.key.slice(5);
  }
  return null;
}

/** Saves a draft after checking it and the person's rights; null removes it. Returns Undo info. */
export async function saveDraft(user: Principal, key: string, value: unknown | null): Promise<UndoEntry> {
  if (user.readOnly) throw new AppError("View-only accounts can't change anything.", "FORBIDDEN");
  if (key.startsWith("page:")) {
    assertCan(user, "cms.pages");
    const pageId = key.slice(5);
    if (!(await db.page.findUnique({ where: { id: pageId }, select: { id: true } }))) throw notFound("Page");
    if (value === null) return setDraft(user, key, null);
    const parsedList = sectionList.parse(value);
    // Removing a published section needs Delete permission (hiding doesn't). Sections that so far only exist in
    // the draft can always be taken out again (e.g. Undo of "Add section"). Publishing checks everything inside
    // sections too (services/cms.ts › saveSections).
    if (!canDeleteSections(user)) {
      const keep = new Set(parsedList.map((s) => s.id).filter(Boolean));
      const live = new Set((await db.pageSection.findMany({ where: { pageId }, select: { id: true } })).map((s) => s.id));
      if ((await currentPageSections(pageId)).some((s) => live.has(s.id) && !keep.has(s.id))) throw new AppError(NO_DELETE_MESSAGE, "FORBIDDEN");
    }
    const list: DraftSection[] = parsedList.map((s) => {
      if (!isBlockType(s.type)) throw new AppError(`Unknown section type “${s.type}”.`);
      return {
        id: s.id || `d${randomUUID().replace(/-/g, "").slice(0, 20)}`,
        type: s.type,
        label: s.label ?? null,
        isEnabled: s.isEnabled,
        reusableBlockId: s.reusableBlockId ?? null,
        data: s.reusableBlockId ? {} : (cleanBlockData(s.type, s.data) as Record<string, unknown>),
      };
    });
    return setDraft(user, key, list);
  }
  if (key.startsWith("setting:")) {
    const k = key.slice(8) as SettingKey;
    if (!SETTING_KEYS.includes(k) || k === "editMode") throw new AppError("This setting can't be drafted.");
    assertCanChangeSetting(user, k);
    if (value === null) return setDraft(user, key, null);
    const parsed = settingSchemas[k].safeParse(value);
    if (!parsed.success) throw new AppError("Check the highlighted fields.", "BAD_REQUEST", parsed.error.flatten().fieldErrors as Record<string, string[]>);
    return setDraft(user, key, parsed.data);
  }
  throw new AppError("Unknown draft.");
}

const SETTING_LABELS: Partial<Record<SettingKey, string>> = {
  texts: "Website wording", labels: "Buttons & labels", site: "Company & contact", theme: "Website design", regionStyles: "Box & section designs", layouts: "Page layouts",
};

/** Unpublished changes, for the edit bar. */
export async function listDraftChanges() {
  const rows = await drafts.findMany({ orderBy: { updatedAt: "desc" } }).catch(() => []);
  const pageIds = rows.filter((r) => r.key.startsWith("page:")).map((r) => r.key.slice(5));
  const pages = pageIds.length ? await db.page.findMany({ where: { id: { in: pageIds } }, select: { id: true, slug: true, title: true } }) : [];
  return rows.map((r) => {
    const page = r.key.startsWith("page:") ? pages.find((p) => p.id === r.key.slice(5)) : null;
    const label = page ? (page.slug === "home" ? "Homepage sections" : `Page “${page.title}” sections`) : SETTING_LABELS[r.key.slice(8) as SettingKey] ?? r.key.slice(8);
    return { key: r.key, label, updatedAt: r.updatedAt };
  });
}

/** Puts every draft live (each as one saved change with its usual version history), then removes it. */
export async function publishDrafts(user: Principal) {
  const rows = await drafts.findMany({ orderBy: { updatedAt: "asc" } });
  const errors: string[] = [];
  /** Changes that remove something the person may not delete: sent to the Super Admin, the draft stays. */
  const queued: string[] = [];
  let published = 0;
  for (const r of rows) {
    try {
      if (r.key.startsWith("page:")) {
        const list = r.value as DraftSection[];
        await saveSections(user, r.key.slice(5), list.map((s) => ({ id: s.id, type: s.type, label: s.label, isEnabled: s.isEnabled, data: s.data, reusableBlockId: s.reusableBlockId })) as never, "Published from website edit mode");
      } else if (r.key.startsWith("setting:")) {
        await updateSetting(user, r.key.slice(8) as SettingKey, r.value);
      }
      await drafts.deleteMany({ where: { key: r.key } });
      published++;
    } catch (e) {
      if (isQueued(e)) queued.push(e.message);
      else errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  if (published) await audit({ actorId: user.id, action: "editmode.publish", entityType: "site", entityId: "drafts", summary: `Published ${published} edit-mode change(s)` });
  return { published, errors, queued };
}

export async function discardDrafts(user: Principal) {
  if (user.readOnly) throw new AppError("View-only accounts can't change anything.", "FORBIDDEN");
  const { count } = await drafts.deleteMany();
  if (count) await audit({ actorId: user.id, action: "editmode.discard", entityType: "site", entityId: "drafts", summary: `Discarded ${count} unpublished edit-mode change(s)` });
  return count;
}
