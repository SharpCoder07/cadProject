import { Blocks, Layers, LayoutTemplate, PackageOpen } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { BlocksManager, NewBlockButton } from "./blocks-manager";

export const metadata = { title: "Reusable blocks" };

export default async function BlocksPage() {
  await requirePermission("cms.blocks.view", "/admin/cms/blocks");
  const blocks = await db.reusableBlock.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { usages: true } } } });
  return (
    <>
      <PageHeader title="Reusable blocks" description="Manage every section you reuse across pages." actions={<NewBlockButton />} />
      <PageStats
        items={[
          { label: "Blocks", value: blocks.length, icon: Blocks, tone: "red", sub: "Reusable sections" },
          { label: "In use", value: blocks.filter((b) => b._count.usages > 0).length, icon: LayoutTemplate, tone: "green", sub: "Placed on a page" },
          { label: "Placements", value: blocks.reduce((n, b) => n + b._count.usages, 0), icon: Layers, sub: "Sections using a block" },
          { label: "Not used", value: blocks.filter((b) => b._count.usages === 0).length, icon: PackageOpen, sub: "Safe to remove" },
        ]}
      />
      <BlocksManager blocks={blocks.map((b) => ({ id: b.id, name: b.name, type: b.type, data: (b.data as Record<string, unknown>) ?? {}, usages: b._count.usages }))} />
    </>
  );
}
