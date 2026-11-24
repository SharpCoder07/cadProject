import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { EDITING_GUIDE } from "@/lib/editing-guide";
import { BLOCK_META, isBlockType } from "@/lib/blocks/schemas";
import { FIXED_PAGE_MAPS, FOOTER_SECTIONS, HEADER_SECTIONS, blockSections, type MapSection, type PageMap } from "@/lib/page-maps";
import { GuideTabs } from "./guide-tabs";

export const metadata = { title: "Editing guide" };

export default async function EditingGuidePage() {
  await requirePermission("dashboard.view", "/admin/guide");
  const home = await db.page.findFirst({
    where: { slug: "home" },
    select: {
      id: true,
      sections: {
        orderBy: { sortOrder: "asc" },
        select: { type: true, label: true, data: true, isEnabled: true, reusableBlock: { select: { name: true, type: true, data: true } } },
      },
    },
  });
  const homeHref = home ? `/admin/cms/pages/${home.id}` : "/admin/cms/pages";

  // Homepage: header, then its blocks in the order they appear, then the footer.
  const blocks: MapSection[] = (home?.sections ?? []).flatMap((s, i) => {
    const type = s.reusableBlock?.type ?? s.type;
    if (!s.isEnabled || !isBlockType(type)) return [];
    const data = ((s.reusableBlock?.data ?? s.data) as Record<string, unknown> | null) ?? {};
    const label = s.label || s.reusableBlock?.name || BLOCK_META[type].label;
    return blockSections(type, label, data).map((sec) => ({
      ...sec,
      summary: [sec.summary, s.reusableBlock ? `Reusable block “${s.reusableBlock.name}” (edit it in Pages › Reusable blocks).` : `Block ${i + 1} in the homepage editor.`].filter(Boolean).join(" "),
    }));
  });
  const homepage: PageMap = {
    id: "home", group: "Homepage", name: "Homepage", url: "/",
    intro: "Homepage sections 3 onwards are blocks: open Pages › Pages & homepage › Home, click a block to edit it, drag to reorder, or switch it off.",
    sections: [...HEADER_SECTIONS, ...blocks, ...FOOTER_SECTIONS],
  };
  const fixed = FIXED_PAGE_MAPS.map((m) => ({ ...m, sections: [...HEADER_SECTIONS, ...m.sections, ...FOOTER_SECTIONS] }));

  // Links to the homepage editor need its id.
  const fill = <T,>(v: T): T => JSON.parse(JSON.stringify(v).replaceAll('"@home"', JSON.stringify(homeHref)));
  return (
    <>
      <PageHeader title="Editing guide" description="Pick a page and follow it from top to bottom, or search for any part of the website (for example “cookie”, “privacy”, “search bar”). Every grey path is a link straight to the screen where it’s edited." />
      <GuideTabs groups={fill(EDITING_GUIDE)} maps={fill([homepage, ...fixed])} />
    </>
  );
}
