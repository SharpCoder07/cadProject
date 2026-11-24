import { CircleHelp, Eye, FolderOpen } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { FaqGroups } from "./faq-groups";
import { listRevisions } from "@/server/revisions";

export const metadata = { title: "FAQs" };

export default async function FaqsPage() {
  await requirePermission("cms.blocks.view", "/admin/cms/faqs");
  const groups = await db.faqGroup.findMany({ orderBy: { sortOrder: "asc" }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  const versions = await Promise.all(groups.map((g) => listRevisions("faq", g.id)));
  return (
    <>
      <PageHeader title="FAQs" description="Manage every FAQ group shown on your website." />
      <PageStats
        items={[
          { label: "FAQ groups", value: groups.length, icon: FolderOpen, tone: "red", sub: "Used by FAQ sections" },
          { label: "Questions", value: groups.reduce((n, g) => n + g.items.length, 0), icon: CircleHelp, tone: "green", sub: "Across all groups" },
          { label: "Visible", value: groups.reduce((n, g) => n + g.items.filter((i) => i.isActive).length, 0), icon: Eye, sub: "Shown on the website" },
        ]}
      />
      <FaqGroups groups={groups.map((g, gi) => ({
        id: g.id, key: g.key, title: g.title,
        items: g.items.map((i) => ({ key: i.id, question: i.question, answer: i.answer, isActive: i.isActive })),
        versions: (versions[gi] ?? []).map((r) => ({ id: r.id, version: r.version, message: r.message, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null })),
      }))} />
    </>
  );
}
