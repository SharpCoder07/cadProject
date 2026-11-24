import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { getCurrentUser } from "@/server/auth/session";
import { can } from "@/server/rbac/policy";
import { HOME_SLUG } from "@/server/services/cms";
import { isBuyerRoleKey } from "@/server/rbac/permissions";
import { BLOCK_META, isBlockType } from "@/lib/blocks/schemas";
import { canUseEditMode, canUseSidebarOnly } from "@/server/rbac/edit-mode";
import { canDeleteSections } from "@/lib/section-delete";
import { getStoredSettings } from "@/server/settings";
import { draftKey, getDraft } from "@/server/edit-drafts";
import type { DraftSection } from "@/server/services/edit-drafts";

/**
 * Website edit mode: the CMS page behind a website address, with all its sections (hidden ones too),
 * for people allowed edit mode (server/rbac/edit-mode.ts) while it's switched on. Everyone else gets { editable: false }.
 */
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  // Edit mode is for staff; what each person can change is checked by the admin screens and actions.
  // Edit mode is only for Super Admin and Admin, and only while it's switched on (Settings).
  if (!user || isBuyerRoleKey(user.roleKey)) return NextResponse.json({ editable: false }, { headers: noStore });
  const ui = await canUseEditMode(user);
  // UI Editor off but the website sidebar editor on: only the admin bar and the admin-menu sidebar.
  const sidebarOnly = !ui && (await canUseSidebarOnly(user));
  if (!ui && !sidebarOnly) return NextResponse.json({ editable: false }, { headers: noStore });
  // What this person's role can change: edit mode only shows outlines and buttons for those parts.
  const perms = [...user.permissions];
  // For the website admin bar ("Howdy, …", site name).
  const stored = await getStoredSettings();
  const me = { name: user.name, siteName: stored.site.name, sidebar: stored.editMode.sidebar, ui };
  if (sidebarOnly) return NextResponse.json({ editable: true, perms, me, page: null, sections: [], reusable: [] }, { headers: noStore });
  const editorOnly = NextResponse.json({ editable: true, perms, me, page: null, sections: [], reusable: [] }, { headers: noStore });
  if (!can(user, "cms.pages")) return editorOnly;
  const path = (req.nextUrl.searchParams.get("path") ?? "/").split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  const slug = path === "/" ? HOME_SLUG : /^\/[a-z0-9-]{1,120}$/.test(path) ? path.slice(1) : null;
  if (!slug) return editorOnly;
  const page = await db.page.findUnique({
    where: { slug },
    select: {
      id: true, slug: true, title: true, status: true,
      sections: { orderBy: { sortOrder: "asc" }, select: { id: true, type: true, label: true, isEnabled: true, data: true, reusableBlockId: true, reusableBlock: { select: { name: true } } } },
    },
  });
  if (!page || (slug !== HOME_SLUG && page.status !== "PUBLISHED")) return editorOnly;
  const reusable = await db.reusableBlock.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, type: true } });
  const draft = await getDraft<DraftSection[]>(draftKey.page(page.id));
  return NextResponse.json(
    {
      editable: true,
      perms,
      me,
      canDeleteSections: canDeleteSections(user),
      canPublish: can(user, "cms.publish"),
      page: { id: page.id, slug: page.slug, title: page.slug === HOME_SLUG ? "Homepage" : page.title },
      // In edit mode the page is edited as a draft: show the draft's sections when there is one.
      sections: (draft ?? page.sections.map((s) => ({ id: s.id, type: s.type, label: s.label, isEnabled: s.isEnabled, data: (s.data as Record<string, unknown>) ?? {}, reusableBlockId: s.reusableBlockId }))).map((s) => ({
        key: s.id, id: s.id, type: s.type, label: s.label, isEnabled: s.isEnabled, data: s.data ?? {}, reusableBlockId: s.reusableBlockId,
        reusableName: reusable.find((r) => r.id === s.reusableBlockId)?.name, typeName: isBlockType(s.type) ? BLOCK_META[s.type].label : undefined,
      })),
      reusable,
    },
    { headers: noStore },
  );
}
