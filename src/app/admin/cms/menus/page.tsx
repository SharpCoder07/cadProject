import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { getMenuForEdit } from "@/server/services/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { PillTabs } from "@/components/admin/list-panel";
import { MenuEditor } from "./menu-editor";
import { listRevisions } from "@/server/revisions";
import { VersionHistory } from "@/components/admin/version-history";
import { restoreMenuAction } from "../actions";

export const metadata = { title: "Menus" };
const BUILT_IN = [
  { key: "header", name: "Header" },
  { key: "footer.software", name: "Footer: Software" },
  { key: "footer.resources", name: "Footer: Resources" },
  { key: "footer.company", name: "Footer: Company" },
];

export default async function MenusPage({ searchParams }: { searchParams: Promise<{ menu?: string }> }) {
  const user = await requirePermission("cms.navigation.view", "/admin/cms/menus");
  const { menu: selected = "header" } = await searchParams;
  const def = BUILT_IN.find((m) => m.key === selected) ?? BUILT_IN[0]!;
  // Ensure built-in menus exist so they can always be edited.
  await db.menu.upsert({ where: { key: def.key }, create: { key: def.key, name: def.name }, update: {} });
  const menu = await getMenuForEdit(user, def.key);
  const versions = await listRevisions("menu", menu.id);
  return (
    <>
      <PageHeader
        title="Menus"
        description="Manage your header and footer navigation."
        actions={
          <div className="max-w-full rounded-2xl border border-line/80 bg-surface p-1.5 shadow-[0_1px_2px_rgb(var(--color-ink)/0.04)]">
            <PillTabs label="Menus" items={BUILT_IN.map((m) => ({ href: `/admin/cms/menus?menu=${m.key}`, label: m.name, active: m.key === def.key }))} />
          </div>
        }
      />
      {/* Keyed by the latest version so the editor reloads after a save or restore. */}
      <MenuEditor key={`${def.key}:${versions[0]?.version ?? 0}`} menuKey={def.key} name={def.name} initial={menu.tree} />
      <div className="mt-6 max-w-xl">
        <VersionHistory what="menu" restore={restoreMenuAction} versions={versions.map((r) => ({ id: r.id, version: r.version, message: r.message, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null }))} />
      </div>
    </>
  );
}
