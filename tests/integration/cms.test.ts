import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createPage, getPublishedPage, resolveSections, restorePageRevision, saveSections, setPageStatus } from "@/server/services/cms";
import { moveCategory } from "@/server/services/categories";
import { updateSetting } from "@/server/settings";
import { saveMenu, getMenu } from "@/server/services/navigation";
import { makeCategory, makeUser, resetDb } from "./helpers";

describe("pages and sections", () => {
  beforeEach(resetDb);

  it("saves ordered sections, sanitizes rich text and publishes", async () => {
    const editor = await makeUser("CONTENT_EDITOR");
    const page = await createPage(editor, { title: "Offers", slug: "offers", template: "DEFAULT", seo: { noIndex: false, title: null, description: null, keywords: null, canonicalUrl: null, ogImageId: null }, revisionMessage: null });
    // New pages start with a text section; content editors can't remove sections (no Delete), so it's kept and filled in.
    const starter = await db.pageSection.findFirstOrThrow({ where: { pageId: page.id, type: "RICH_TEXT" } });
    await saveSections(editor, page.id, [
      { type: "CTA", isEnabled: true, data: { heading: "Talk to us" }, label: null, reusableBlockId: null },
      { id: starter.id, type: "RICH_TEXT", isEnabled: true, data: { html: '<p onclick="x()">Hi<script>alert(1)</script></p>' }, label: null, reusableBlockId: null },
      { type: "STATS", isEnabled: false, data: {}, label: null, reusableBlockId: null },
    ]);
    expect(await getPublishedPage("offers")).toBeNull();
    await setPageStatus(editor, page.id, "PUBLISHED");
    const published = await getPublishedPage("offers");
    const sections = resolveSections(published!);
    expect(sections.map((s) => s.type)).toEqual(["CTA", "RICH_TEXT"]); // hidden section omitted
    expect(sections[1]!.data.html).toBe("<p>Hi</p>");
  });

  it("rejects invalid block data", async () => {
    const editor = await makeUser("CONTENT_EDITOR");
    const page = await createPage(editor, { title: "X", slug: "x", template: "DEFAULT", seo: { noIndex: false, title: null, description: null, keywords: null, canonicalUrl: null, ogImageId: null }, revisionMessage: null });
    await expect(saveSections(editor, page.id, [{ type: "CTA", isEnabled: true, data: { primaryHref: "javascript:alert(1)" }, label: null, reusableBlockId: null }])).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("restores an earlier revision", async () => {
    // Removing sections needs Delete permission (only the Super Admin has it by default).
    const editor = await makeUser("SUPER_ADMIN");
    const page = await createPage(editor, { title: "R", slug: "r", template: "DEFAULT", seo: { noIndex: false, title: null, description: null, keywords: null, canonicalUrl: null, ogImageId: null }, revisionMessage: null });
    await saveSections(editor, page.id, [{ type: "STATS", isEnabled: true, data: {}, label: "first", reusableBlockId: null }]);
    const v2 = await db.revision.findFirstOrThrow({ where: { entityId: page.id }, orderBy: { version: "desc" } });
    await saveSections(editor, page.id, []);
    await restorePageRevision(editor, v2.id);
    const sections = await db.pageSection.findMany({ where: { pageId: page.id } });
    expect(sections.map((s) => s.label)).toEqual(["first"]);
  });

  it("stops sales users editing content", async () => {
    const sales = await makeUser("SALES_MANAGER");
    await expect(createPage(sales, { title: "No", slug: "no", template: "DEFAULT", seo: { noIndex: false, title: null, description: null, keywords: null, canonicalUrl: null, ogImageId: null }, revisionMessage: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("category tree integrity", () => {
  beforeEach(resetDb);

  it("moves subtrees and refuses cycles", async () => {
    const pm = await makeUser("PRODUCT_MANAGER");
    const a = await makeCategory("a");
    const b = await makeCategory("b", a.id, 1, `/${a.id}/`);
    const c = await makeCategory("c", b.id, 2, `/${a.id}/${b.id}/`);
    const d = await makeCategory("d");
    await moveCategory(pm, b.id, d.id, [b.id]);
    const movedC = await db.category.findUniqueOrThrow({ where: { id: c.id } });
    expect(movedC.path).toBe(`/${d.id}/${b.id}/`);
    expect(movedC.depth).toBe(2);
    await expect(moveCategory(pm, d.id, c.id, [d.id])).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("settings and menus", () => {
  beforeEach(resetDb);

  it("validates and audits settings changes", async () => {
    const admin = await makeUser("ADMIN");
    await expect(updateSetting(admin, "theme", { primary: "blue" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await updateSetting(admin, "theme", { primary: "#123456" });
    expect((await db.setting.findUniqueOrThrow({ where: { key: "theme" } })).value).toMatchObject({ primary: "#123456" });
    expect(await db.auditLog.count({ where: { action: "settings.update" } })).toBe(1);
    const editor = await makeUser("CONTENT_EDITOR");
    await expect(updateSetting(editor, "theme", {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("saves nested menus and hides links to unpublished pages", async () => {
    const editor = await makeUser("CONTENT_EDITOR");
    const draft = await db.page.create({ data: { title: "Draft", slug: "draft" } });
    await saveMenu(editor, "header", "Header", [
      { label: "Resources", url: null, pageId: null, categoryId: null, badge: null, openInNewTab: false, isActive: true, children: [{ label: "Blog", url: "/blog", pageId: null, categoryId: null, badge: null, openInNewTab: false, isActive: true, children: [] }] },
      { label: "Draft page", url: null, pageId: draft.id, categoryId: null, badge: null, openInNewTab: false, isActive: true, children: [] },
    ]);
    const menu = await getMenu("header");
    expect(menu.map((m) => m.label)).toEqual(["Resources"]);
    expect(menu[0]!.children[0]!.href).toBe("/blog");
  });
});
