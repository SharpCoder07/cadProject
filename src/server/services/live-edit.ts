import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { getSoftwareForEdit, toSoftwareInput, updateSoftware } from "./software";
import { getCategoryForEdit, updateCategory } from "./categories";
import { savePost } from "./blog";
import { comparisonInput, saveComparison } from "./comparisons";
import { deleteBrand, deleteIndustry, deleteVendor, saveBrand, saveIndustry, saveVendor } from "./taxonomy";
import { slugify } from "@/lib/utils";
import { vendorToInput } from "./approvals";
import { getSettings } from "@/server/settings";
import { softwareInput } from "@/lib/validation/software";
import { categoryInput } from "@/lib/validation/taxonomy";
import { brandInput, industryInput, vendorInput } from "@/lib/validation/taxonomy";
import { postInput } from "@/lib/validation/cms";
import { readSections } from "@/lib/comparison-sections";
import { currentPageSections, pageOfSection, saveDraft, type UndoEntry } from "./edit-drafts";
import { cleanBlockData } from "./cms";
import { draftKey } from "@/server/edit-drafts";
import { settingSchemas } from "@/server/settings/schemas";
import { BLOCK_FIELDS } from "@/components/admin/blocks/block-fields";
import { isBlockType } from "@/lib/blocks/schemas";
import { TEXT_DEFAULTS } from "@/lib/site-texts";
import { TEXT_ENTRIES } from "@/lib/site-text-catalog";
import { LIVE_KINDS, liveFieldNames, type LiveKind } from "@/lib/live-edit";

/**
 * Website edit mode, editing in place: loads the current values of one thing (a product, a category,
 * a comparison, site settings, a group of website texts…) and saves the fields changed in the side
 * panel, through the same services and permission checks as the admin screens.
 */
type Seo = { title: string | null; description: string | null; keywords: string | null; canonicalUrl: string | null; noIndex: boolean; ogImageId: string | null } | null;
const seoOf = (s: Seo) => ({ title: s?.title ?? null, description: s?.description ?? null, keywords: s?.keywords ?? null, canonicalUrl: s?.canonicalUrl ?? null, noIndex: s?.noIndex ?? false, ogImageId: s?.ogImageId ?? null });

export const liveRequest = z.object({ kind: z.enum(LIVE_KINDS), id: z.string().max(200).default("") });

/** Current values, plus image previews (media id → url) for the panel. */
export async function loadLive(user: Principal, kind: LiveKind, id: string): Promise<{ values: Record<string, unknown>; media: Record<string, string> }> {
  const media: Record<string, string> = {};
  switch (kind) {
    case "software": {
      const sw = await getSoftwareForEdit(user, id);
      if (sw.logo) media[sw.logo.id] = sw.logo.url;
      for (const m of sw.media) if (m.media) media[m.media.id] = m.media.url;
      return { values: toSoftwareInput(sw) as unknown as Record<string, unknown>, media };
    }
    case "category": {
      const c = await getCategoryForEdit(user, id);
      if (c.image) media[c.image.id] = c.image.url;
      if (c.banner) media[c.banner.id] = c.banner.url;
      return {
        values: {
          name: c.name, slug: c.slug, shortName: c.shortName, description: c.description, content: c.content ?? "", icon: c.icon, parentId: c.parentId, isActive: c.isActive, showInNav: c.showInNav,
          imageId: c.imageId, bannerId: c.bannerId, layout: c.layout ?? {}, featuredSoftwareIds: c.featured.map((f) => f.softwareId),
          attributes: c.attributes.map((a) => ({ attributeId: a.attributeId, isFilter: a.isFilter })), seo: seoOf(c.seo),
        },
        media,
      };
    }
    case "post": {
      assertCan(user, "blog.manage");
      const p = await db.post.findUnique({ where: { id }, include: { seo: true, cover: true, tags: { include: { tag: true } }, software: true } });
      if (!p) throw notFound("Post");
      if (p.cover) media[p.cover.id] = p.cover.url;
      return {
        values: {
          title: p.title, slug: p.slug, type: p.type, excerpt: p.excerpt, content: p.content, coverId: p.coverId, authorId: p.authorId, categoryId: p.categoryId,
          tags: p.tags.map((t) => t.tag.name), softwareIds: p.software.map((s) => s.softwareId), isFeatured: p.isFeatured, revisionMessage: null, seo: seoOf(p.seo),
        },
        media,
      };
    }
    case "comparison": {
      assertCan(user, "comparisons.manage");
      const c = await db.comparisonPage.findUnique({ where: { id }, include: { seo: true, items: { orderBy: { sortOrder: "asc" } } } });
      if (!c) throw notFound("Comparison");
      return {
        values: { title: c.title, slug: c.slug, intro: c.intro ?? "", verdict: c.verdict ?? "", sections: readSections(c.sections), softwareIds: c.items.map((i) => i.softwareId), status: c.status === "IN_REVIEW" ? "DRAFT" : c.status, seo: seoOf(c.seo) },
        media,
      };
    }
    case "vendor": {
      assertCan(user, "vendors.manage");
      const v = await db.vendor.findUnique({ where: { id }, include: { seo: true, logo: true } });
      if (!v) throw notFound("Vendor");
      if (v.logo) media[v.logo.id] = v.logo.url;
      return { values: vendorToInput(v) as unknown as Record<string, unknown>, media };
    }
    case "brands": {
      assertCan(user, "vendors.manage");
      const rows = await db.brand.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { seo: true, logo: true } });
      for (const b of rows) if (b.logo) media[b.logo.id] = b.logo.url;
      return { values: { items: rows.map((b) => ({ _id: b.id, name: b.name, slug: b.slug, description: b.description, website: b.website, vendorId: b.vendorId, logoId: b.logoId, isActive: b.isActive, sortOrder: b.sortOrder, seo: seoOf(b.seo) })) }, media };
    }
    case "industries": {
      assertCan(user, "taxonomy.manage");
      const rows = await db.industry.findMany({ orderBy: { name: "asc" }, include: { seo: true, image: true } });
      for (const r of rows) if (r.image) media[r.image.id] = r.image.url;
      return { values: { items: rows.map((r) => ({ _id: r.id, name: r.name, slug: r.slug, description: r.description, content: r.content ?? "", icon: r.icon, imageId: r.imageId, isActive: r.isActive, seo: seoOf(r.seo) })) }, media };
    }
    case "vendors": {
      assertCan(user, "vendors.manage");
      const rows = await db.vendor.findMany({ where: { kind: "VENDOR" }, orderBy: { name: "asc" }, include: { seo: true, logo: true } });
      for (const v of rows) if (v.logo) media[v.logo.id] = v.logo.url;
      return { values: { items: rows.map((v) => ({ _id: v.id, ...vendorToInput(v) })) }, media };
    }
    case "site":
    case "labels":
    case "theme": {
      assertCan(user, "settings.manage");
      return { values: (await getSettings())[kind] as unknown as Record<string, unknown>, media };
    }
    case "block": {
      // One section of a website page (e.g. the homepage hero's "Top software brands" strip).
      assertCan(user, "cms.pages");
      // As it is now in edit mode: from the page's draft when there is one.
      const pageId = await pageOfSection(id);
      const sec = pageId ? (await currentPageSections(pageId)).find((x) => x.id === id) : null;
      if (!sec) throw notFound("Section");
      return { values: { ...sec.data }, media };
    }
    case "style": {
      // Design of one box / section (Design tab): colours and fonts, by style key.
      assertCan(user, "settings.manage");
      return { values: { ...((await getSettings()).regionStyles[id] ?? {}) } as Record<string, unknown>, media };
    }
    case "texts": {
      assertCan(user, "settings.manage");
      const saved = (await getSettings()).texts;
      const values: Record<string, unknown> = {};
      for (const e of TEXT_ENTRIES) if (id === "*" || e.group === id) values[e.key] = saved[e.key] ?? TEXT_DEFAULTS[e.key] ?? "";
      return { values, media };
    }
  }
}

/**
 * Saves the changed fields (only the ones this kind allows) on top of the current values.
 * Page sections and settings (wording, labels, company details, theme, box designs) go to the
 * edit-mode draft (published from the edit bar) and return Undo info; catalogue content (products,
 * categories, articles, vendors, brands…) is saved straight away, with its own version history.
 */
export async function saveLive(user: Principal, kind: LiveKind, id: string, raw: Record<string, unknown>): Promise<UndoEntry[]> {
  if (user.readOnly) throw new AppError("View-only accounts can't change anything.", "FORBIDDEN");
  if (kind === "block") {
    assertCan(user, "cms.pages");
    const pageId = await pageOfSection(id);
    const list = pageId ? await currentPageSections(pageId) : [];
    const sec = list.find((x) => x.id === id);
    if (!pageId || !sec || !isBlockType(sec.type)) throw notFound("Section");
    const type = sec.type;
    const names = new Set(BLOCK_FIELDS[type].map((f) => f.name));
    const patch = Object.fromEntries(Object.entries(raw).filter(([k]) => names.has(k)));
    if (!Object.keys(patch).length) return [];
    const data = cleanBlockData(type, { ...sec.data, ...patch }) as Record<string, unknown>;
    return [await saveDraft(user, draftKey.page(pageId), list.map((x) => (x.id === id ? { ...x, data } : x)))];
  }
  const allowed = liveFieldNames(kind, id);
  const patch = Object.fromEntries(Object.entries(raw).filter(([k]) => allowed.has(k)));
  if (!Object.keys(patch).length) return [];
  const { values } = await loadLive(user, kind, id);
  const merged = { ...values, ...patch };
  switch (kind) {
    case "software":
      await updateSoftware(user, id, softwareInput.parse({ ...merged, revisionMessage: "Edited on the website (edit mode)" }));
      return [];
    case "category":
      await updateCategory(user, id, categoryInput.parse(merged));
      return [];
    case "post":
      await savePost(user, id, postInput.parse({ ...merged, revisionMessage: "Edited on the website (edit mode)" }));
      return [];
    case "comparison":
      await saveComparison(user, id, comparisonInput.parse(merged));
      return [];
    case "vendor":
      await saveVendor(user, id, vendorInput.parse(merged));
      return [];
    case "site":
    case "labels":
    case "theme":
      return [await saveDraft(user, draftKey.setting(kind), settingSchemas[kind].parse(merged))];
    case "brands":
    case "industries":
    case "vendors": {
      // A list: changed rows are saved, new rows created, removed rows go to the recycle bin.
      type Row = Record<string, unknown> & { _id?: string };
      const before = (values.items as Row[]) ?? [];
      const after = ((patch.items as Row[]) ?? []).filter((r) => String(r.name ?? "").trim());
      const byId = new Map(before.map((r) => [r._id!, r]));
      const keep = new Set(after.map((r) => r._id).filter(Boolean));
      for (const [i, row] of after.entries()) {
        const old = row._id ? byId.get(row._id) : undefined;
        const merged: Row = { ...(old ?? {}), ...row, ...(kind === "brands" ? { sortOrder: i } : {}) };
        if (old && JSON.stringify(merged) === JSON.stringify(old)) continue;
        const { _id, ...data } = merged;
        const slug = String(data.slug || slugify(String(data.name)));
        if (kind === "brands") await saveBrand(user, _id ?? null, brandInput.parse({ ...data, slug }));
        else if (kind === "industries") await saveIndustry(user, _id ?? null, industryInput.parse({ ...data, slug }));
        else await saveVendor(user, _id ?? null, vendorInput.parse({ ...data, slug, kind: _id ? undefined : "VENDOR" }));
      }
      for (const r of before) {
        if (keep.has(r._id)) continue;
        if (kind === "brands") await deleteBrand(user, r._id!);
        else if (kind === "industries") await deleteIndustry(user, r._id!);
        else await deleteVendor(user, r._id!);
      }
      return [];
    }
    case "style": {
      const all = { ...(await getSettings()).regionStyles };
      const clean = Object.fromEntries(Object.entries(merged).filter(([, v]) => typeof v === "string" && v !== ""));
      if (Object.keys(clean).length) all[id] = clean;
      else delete all[id];
      return [await saveDraft(user, draftKey.setting("regionStyles"), all)];
    }
    case "texts": {
      const all = { ...(await getSettings()).texts };
      for (const [k, v] of Object.entries(patch)) {
        const text = String(v ?? "");
        if (text === (TEXT_DEFAULTS[k] ?? "") || text === "") delete all[k];
        else all[k] = text;
      }
      return [await saveDraft(user, draftKey.setting("texts"), all)];
    }
  }
}
