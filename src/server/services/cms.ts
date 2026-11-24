import "server-only";
import type { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { db, type Tx } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, isUniqueViolation, notFound } from "@/server/errors";
import { recordRevision } from "@/server/revisions";
import { sanitizeRichText } from "@/server/sanitize";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { blockSchemas, isBlockType, type BlockType } from "@/lib/blocks/schemas";
import type { PageInput, SectionInput } from "@/lib/validation/cms";
import { upsertSeo } from "./seo";
import { addSlugRedirect } from "./navigation";
import { moveToBin, withBin } from "@/server/system/trash";
import { draftKey, draftViewer, getDraft } from "@/server/edit-drafts";
import { getStoredSettings } from "@/server/settings";
import { guardDelete, guardRemovals } from "@/server/rbac/deletion";

export const pageTag = (slug: string) => `page:${slug}`;
export const PAGES_TAG = "pages";
export const HOME_SLUG = "home";

function revalidatePage(...slugs: (string | null | undefined)[]) {
  revalidateTag(PAGES_TAG);
  for (const s of slugs) if (s) revalidateTag(pageTag(s));
}

/** Validates and cleans a block payload for storage. RICH_TEXT html is sanitized. */
export function cleanBlockData(type: string, data: unknown): Prisma.InputJsonValue {
  if (!isBlockType(type)) throw new AppError(`Unknown block type ${type}.`);
  const parsed = blockSchemas[type].safeParse(data ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError(`Section "${type}": ${first ? `${first.path.join(".")} — ${first.message}` : "invalid data"}`);
  }
  const value = parsed.data as Record<string, unknown>;
  if (type === "RICH_TEXT") value.html = sanitizeRichText(String(value.html ?? "")) ?? "";
  // Free layout: text widgets hold formatted text — cleaned the same way.
  if (type === "LAYOUT") {
    for (const r of (value.rows as { columns: { widgets: { type: string; props: Record<string, unknown> }[] }[] }[]) ?? []) {
      for (const c of r.columns) {
        for (const w of c.widgets) {
          if (w.type === "text") w.props.html = sanitizeRichText(String(w.props.html ?? "")) ?? "";
          // A copied section inside a column: checked (and cleaned) like that section on its own.
          if (w.type === "section") {
            const bt = String(w.props.blockType ?? "");
            if (!isBlockType(bt) || bt === "LAYOUT") throw new AppError(`Section "${bt}" can't go inside a Free layout.`);
            w.props.data = cleanBlockData(bt, w.props.data) as Record<string, unknown>;
          }
        }
      }
    }
  }
  return value as Prisma.InputJsonValue;
}

// ─── Public reads ────────────────────────────────────────────────────────────

const pageInclude = {
  seo: { include: { ogImage: true } },
  sections: { where: { isEnabled: true }, orderBy: { sortOrder: "asc" }, include: { reusableBlock: true } },
} satisfies Prisma.PageInclude;
export type PublicPage = Prisma.PageGetPayload<{ include: typeof pageInclude }>;

export interface ResolvedSection {
  id: string;
  type: BlockType;
  data: Record<string, unknown>;
}

/** Resolves reusable blocks and drops sections whose stored data no longer validates. */
export function resolveSections(page: PublicPage): ResolvedSection[] {
  const out: ResolvedSection[] = [];
  for (const s of page.sections) {
    const type = s.reusableBlock?.type ?? s.type;
    const raw = s.reusableBlock?.data ?? s.data;
    if (!isBlockType(type)) continue;
    const parsed = blockSchemas[type].safeParse(raw ?? {});
    if (parsed.success) out.push({ id: s.id, type, data: parsed.data as Record<string, unknown> });
    else console.warn(`[cms] skipping invalid section ${s.id} (${type})`);
  }
  return out;
}

/**
 * The sections to show for a page: for someone looking at the site in edit mode, its unpublished
 * draft (server/edit-drafts) when there is one; for everyone else, the live sections.
 */
export async function pageSectionsFor(page: PublicPage): Promise<ResolvedSection[]> {
  const viewer = await draftViewer((await getStoredSettings()).editMode.enabled);
  const draft = viewer ? await getDraft<{ id: string; type: string; isEnabled: boolean; data: Record<string, unknown>; reusableBlockId: string | null }[]>(draftKey.page(page.id)) : null;
  if (!draft) return resolveSections(page);
  const visible = draft.filter((s) => s.isEnabled);
  const reusableIds = visible.map((s) => s.reusableBlockId).filter((x): x is string => Boolean(x));
  const blocks = reusableIds.length ? await db.reusableBlock.findMany({ where: { id: { in: reusableIds } } }) : [];
  const out: ResolvedSection[] = [];
  for (const s of visible) {
    const rb = s.reusableBlockId ? blocks.find((b) => b.id === s.reusableBlockId) : undefined;
    const type = rb?.type ?? s.type;
    if (!isBlockType(type)) continue;
    const parsed = blockSchemas[type].safeParse((rb?.data ?? s.data) ?? {});
    if (parsed.success) out.push({ id: s.id, type, data: parsed.data as Record<string, unknown> });
  }
  return out;
}

export const getPublishedPage = (slug: string) =>
  unstable_cache(
    () => db.page.findFirst({ where: { slug, status: "PUBLISHED" }, include: pageInclude }),
    // Bump the version when stored page data changes shape, so stale cached copies are ignored.
    ["page", slug, "v2"],
    { tags: [PAGES_TAG, pageTag(slug)], revalidate: 3600 },
  )();

/** Preview: any status, enabled sections only, requires the page's preview key. */
export async function getPreviewPage(slug: string, key: string) {
  const page = await db.page.findUnique({ where: { slug }, include: pageInclude });
  return page && page.previewKey === key ? page : null;
}

export const listPublishedPageSlugs = () =>
  db.page.findMany({
    where: { status: "PUBLISHED", OR: [{ seoId: null }, { seo: { noIndex: false } }] },
    select: { slug: true, updatedAt: true },
  });

// ─── Admin: pages ────────────────────────────────────────────────────────────

export async function listPages(user: Principal) {
  assertCan(user, "cms.pages.view");
  return db.page.findMany({
    orderBy: [{ isSystem: "desc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, slug: true, template: true, status: true, isSystem: true, updatedAt: true, publishedAt: true, scheduledAt: true, updatedBy: { select: { name: true } }, _count: { select: { sections: true } } },
  });
}

export async function getPageForEdit(user: Principal, id: string) {
  assertCan(user, "cms.pages.view");
  const page = await db.page.findUnique({
    where: { id },
    include: { seo: true, sections: { orderBy: { sortOrder: "asc" }, include: { reusableBlock: { select: { id: true, name: true, type: true } } } } },
  });
  if (!page) throw notFound("Page");
  return page;
}

async function pageSnapshot(tx: Tx, id: string): Promise<Prisma.InputJsonValue> {
  const p = await tx.page.findUniqueOrThrow({ where: { id }, include: { seo: true, sections: { orderBy: { sortOrder: "asc" } } } });
  return JSON.parse(JSON.stringify(p)) as Prisma.InputJsonValue;
}

export async function createPage(user: Principal, input: PageInput) {
  assertCan(user, "cms.pages.create");
  try {
    const page = await db.$transaction(async (tx) => {
      const seoId = await upsertSeo(tx, null, input.seo);
      const p = await tx.page.create({ data: { title: input.title, slug: input.slug, template: input.template === "HOMEPAGE" ? "LANDING" : input.template, seoId, updatedById: user.id } });
      // New pages start with a text section so the editor isn't empty.
      await tx.pageSection.create({ data: { pageId: p.id, type: "RICH_TEXT", sortOrder: 0, data: cleanBlockData("RICH_TEXT", { html: "" }) } });
      await recordRevision(tx, "page", p.id, await pageSnapshot(tx, p.id), user.id, "Created");
      await audit({ actorId: user.id, action: "page.create", entityType: "page", entityId: p.id, summary: `Created page /${p.slug}` }, tx);
      return p;
    });
    revalidatePage(page.slug);
    return page;
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new AppError("Another page already uses that URL.", "CONFLICT", { slug: ["Already in use"] });
    throw e;
  }
}

export async function updatePageMeta(user: Principal, id: string, input: PageInput) {
  assertCan(user, "cms.pages");
  const existing = await db.page.findUnique({ where: { id } });
  if (!existing) throw notFound("Page");
  if (existing.isSystem && input.slug !== existing.slug) throw new AppError("System pages keep their URL.");
  try {
    const page = await db.$transaction(async (tx) => {
      const seoId = await upsertSeo(tx, existing.seoId, input.seo);
      const p = await tx.page.update({
        where: { id },
        data: { title: input.title, slug: input.slug, template: existing.isSystem ? existing.template : input.template, seoId, updatedById: user.id },
      });
      await recordRevision(tx, "page", id, await pageSnapshot(tx, id), user.id, input.revisionMessage ?? "Updated settings");
      await audit({ actorId: user.id, action: "page.update", entityType: "page", entityId: id, summary: `Updated page /${p.slug}` }, tx);
      return p;
    });
    if (existing.slug !== page.slug) await addSlugRedirect(`/${existing.slug}`, `/${page.slug}`);
    revalidatePage(existing.slug, page.slug);
    return page;
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new AppError("Another page already uses that URL.", "CONFLICT", { slug: ["Already in use"] });
    throw e;
  }
}

/**
 * Saves the full ordered section list (page builder). Sections not in the list
 * are deleted; order follows array order. Atomic with a revision snapshot.
 */
export async function saveSections(user: Principal, pageId: string, sections: SectionInput[], message?: string | null) {
  assertCan(user, "cms.pages");
  const page = await db.page.findUnique({ where: { id: pageId }, select: { slug: true, title: true } });
  if (!page) throw notFound("Page");

  const cleaned = sections.map((s, i) => ({
    ...s,
    sortOrder: i,
    data: s.reusableBlockId ? undefined : cleanBlockData(s.type, s.data),
  }));

  // Removing a section, or anything inside one (a widget, button, list item…), needs Delete permission;
  // hiding doesn't. Without it the whole change goes to the Super Admin for approval.
  const existing = await db.pageSection.findMany({ where: { pageId }, orderBy: { sortOrder: "asc" }, select: { id: true, type: true, label: true, data: true } });
  await guardRemovals(user, {
    kind: "page.sections",
    args: { pageId, sections, message: message ?? null },
    label: page.slug === "home" ? "Homepage sections" : `Page “${page.title}”`,
    before: existing.map((s) => ({ id: s.id, label: s.label ?? s.type, data: s.data ?? {} })),
    after: cleaned.map((s) => ({ id: s.id, label: s.label ?? s.type, data: s.data ?? {} })),
    root: "the page",
  });

  await db.$transaction(async (tx) => {
    const keepIds = cleaned.map((s) => s.id).filter((x): x is string => Boolean(x));
    // Removed sections go to the recycle bin (for everyone, the Super Admin included), so they can be restored.
    const gone = existing.filter((s) => !keepIds.includes(s.id));
    if (gone.length) {
      const where = page.slug === "home" ? "homepage" : `page “${page.title}”`;
      await moveToBin(tx, user, "PageSection", gone.map((s) => s.id), Object.fromEntries(gone.map((s) => [s.id, `${s.label ?? s.type} (on the ${where})`])));
    }
    await tx.pageSection.deleteMany({ where: { pageId, id: { notIn: keepIds } } });
    for (const s of cleaned) {
      const data = {
        type: s.type,
        label: s.label,
        isEnabled: s.isEnabled,
        sortOrder: s.sortOrder,
        reusableBlockId: s.reusableBlockId ?? null,
        data: s.data ?? undefined,
      };
      const owned = s.id ? await tx.pageSection.findFirst({ where: { id: s.id, pageId }, select: { id: true } }) : null;
      if (owned) await tx.pageSection.update({ where: { id: owned.id }, data });
      else await tx.pageSection.create({ data: { ...data, pageId } });
    }
    await tx.page.update({ where: { id: pageId }, data: { updatedById: user.id } });
    await recordRevision(tx, "page", pageId, await pageSnapshot(tx, pageId), user.id, message ?? "Edited sections");
    await audit({ actorId: user.id, action: "page.sections", entityType: "page", entityId: pageId, summary: `Saved ${cleaned.length} section(s) on /${page.slug}` }, tx);
  }, { timeout: 20_000 });
  revalidatePage(page.slug);
}

/** Saves the data of one section (website edit mode), with a page revision and audit entry. */
export async function savePageSectionData(user: Principal, sectionId: string, data: Prisma.InputJsonValue) {
  assertCan(user, "cms.pages");
  const sec = await db.pageSection.findUnique({ where: { id: sectionId }, select: { pageId: true, type: true, label: true, data: true, page: { select: { slug: true, title: true } } } });
  if (!sec) throw notFound("Section");
  await guardRemovals(user, { kind: "page.section", args: { sectionId, data }, label: `${sec.label ?? sec.type} on ${sec.page.slug === "home" ? "the homepage" : `“${sec.page.title}”`}`, before: sec.data ?? {}, after: data, root: "the section" });
  await db.$transaction(async (tx) => {
    await tx.pageSection.update({ where: { id: sectionId }, data: { data } });
    await tx.page.update({ where: { id: sec.pageId }, data: { updatedById: user.id } });
    await recordRevision(tx, "page", sec.pageId, await pageSnapshot(tx, sec.pageId), user.id, "Edited on the website (edit mode)");
    await audit({ actorId: user.id, action: "page.sections", entityType: "page", entityId: sec.pageId, summary: `Edited a ${sec.type} section on /${sec.page.slug}` }, tx);
  });
  revalidatePage(sec.page.slug);
}

export async function setPageStatus(user: Principal, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED", scheduledAt?: Date | null) {
  assertCan(user, "cms.publish");
  const page = await db.page.findUnique({ where: { id } });
  if (!page) throw notFound("Page");
  if (page.isSystem && status !== "PUBLISHED") throw new AppError("System pages can't be unpublished. Edit their sections instead.");
  const scheduled = status === "PUBLISHED" && scheduledAt && scheduledAt > new Date();
  await db.$transaction(async (tx) => {
    await tx.page.update({
      where: { id },
      data: scheduled ? { scheduledAt, status: "DRAFT" } : { status, scheduledAt: null, ...(status === "PUBLISHED" && !page.publishedAt ? { publishedAt: new Date() } : {}) },
    });
    await audit({ actorId: user.id, action: scheduled ? "page.schedule" : `page.status.${status.toLowerCase()}`, entityType: "page", entityId: id, summary: `/${page.slug}: ${scheduled ? `scheduled ${scheduledAt?.toISOString()}` : status}` }, tx);
  });
  revalidatePage(page.slug);
}

export async function deletePage(user: Principal, id: string) {
  await guardDelete(user, "page", { id });
  const page = await db.page.findUnique({ where: { id } });
  if (!page) throw notFound("Page");
  if (page.isSystem) throw new AppError("System pages can't be deleted.");
  await db.$transaction(async (tx) => {
    await moveToBin(tx, user, "Page", [id]);
    await tx.page.delete({ where: { id } });
    if (page.seoId) await tx.seoMeta.delete({ where: { id: page.seoId } }).catch(() => undefined);
    await tx.revision.deleteMany({ where: { entityType: "page", entityId: id } });
    await audit({ actorId: user.id, action: "page.delete", entityType: "page", entityId: id, summary: `Deleted /${page.slug}` }, tx);
  }, { timeout: 60_000, maxWait: 10_000 });
  revalidatePage(page.slug);
}

export async function restorePageRevision(user: Principal, revisionId: string) {
  assertCan(user, "cms.pages");
  const rev = await db.revision.findUnique({ where: { id: revisionId } });
  if (!rev || rev.entityType !== "page") throw notFound("Revision");
  const snap = rev.snapshot as unknown as { title: string; sections: { type: string; label: string | null; isEnabled: boolean; data: unknown; reusableBlockId: string | null }[] };
  const sections: SectionInput[] = snap.sections.map((s) => ({ type: s.type, label: s.label, isEnabled: s.isEnabled, data: s.data, reusableBlockId: s.reusableBlockId }));
  // Reusable blocks that were deleted since the snapshot are dropped.
  const existingBlocks = new Set((await db.reusableBlock.findMany({ select: { id: true } })).map((b) => b.id));
  await saveSections(
    user,
    rev.entityId,
    sections.filter((s) => !s.reusableBlockId || existingBlocks.has(s.reusableBlockId)),
    `Restored version ${rev.version}`,
  );
}

export async function publishDuePages(): Promise<number> {
  const due = await db.page.findMany({ where: { scheduledAt: { lte: new Date() } }, select: { id: true, slug: true, publishedAt: true } });
  for (const p of due) await db.page.update({ where: { id: p.id }, data: { status: "PUBLISHED", scheduledAt: null, publishedAt: p.publishedAt ?? new Date() } });
  if (due.length) revalidatePage(...due.map((d) => d.slug));
  return due.length;
}

// ─── Reusable blocks ─────────────────────────────────────────────────────────

export async function saveReusableBlock(user: Principal, id: string | null, input: { name: string; type: string; data?: unknown }) {
  assertCan(user, id ? "cms.blocks" : "cms.blocks.create");
  const data = cleanBlockData(input.type, input.data);
  if (id) {
    const cur = await db.reusableBlock.findUnique({ where: { id }, select: { name: true, data: true } });
    if (cur) await guardRemovals(user, { kind: "block.save", args: { id, input }, label: `Reusable block “${cur.name}”`, before: cur.data ?? {}, after: data, root: "the block" });
  }
  const block = id
    ? await db.reusableBlock.update({ where: { id }, data: { name: input.name, data } })
    : await db.reusableBlock.create({ data: { name: input.name, type: input.type, data } });
  await audit({ actorId: user.id, action: id ? "block.update" : "block.create", entityType: "reusable_block", entityId: block.id, summary: block.name });
  // A reusable block may appear on any page.
  revalidateTag(PAGES_TAG);
  return block;
}

export async function deleteReusableBlock(user: Principal, id: string) {
  await guardDelete(user, "reusableBlock", { id });
  const usages = await db.pageSection.count({ where: { reusableBlockId: id } });
  if (usages > 0) throw new AppError(`This block is used in ${usages} section(s). Remove it from those pages first.`, "CONFLICT");
  await withBin(user, "ReusableBlock", [id], (tx) => tx.reusableBlock.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "block.delete", entityType: "reusable_block", entityId: id });
  revalidateTag(PAGES_TAG);
}
