import { Columns3, Filter, Package, SlidersHorizontal } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { AttributeManager } from "./attribute-manager";

export const metadata = { title: "Attributes & filters" };

export default async function AttributesPage() {
  await requirePermission("taxonomy.view", "/admin/attributes");
  const attrs = await db.attribute.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }], include: { options: { orderBy: { sortOrder: "asc" } }, values: { distinct: ["softwareId"], select: { softwareId: true } } } });
  return (
    <>
      <PageHeader title="Attributes & filters" description="Manage every product spec, listing filter and comparison row." />
      <PageStats
        items={[
          { label: "Attributes", value: attrs.length, icon: SlidersHorizontal, tone: "red", sub: `${new Set(attrs.map((a) => a.group)).size} groups` },
          { label: "Listing filters", value: attrs.filter((a) => a.isFilterable).length, icon: Filter, tone: "green", sub: "Buyers can filter by these" },
          { label: "Comparison rows", value: attrs.filter((a) => a.isComparable).length, icon: Columns3, sub: "Shown on compare pages" },
          { label: "Unused", value: attrs.filter((a) => a.values.length === 0).length, icon: Package, tone: attrs.some((a) => a.values.length === 0) ? "amber" : "neutral", sub: "No product uses them yet" },
        ]}
      />
      <AttributeManager attributes={attrs.map((a) => ({ id: a.id, key: a.key, label: a.label, type: a.type, group: a.group, unit: a.unit, description: a.description, isFilterable: a.isFilterable, isComparable: a.isComparable, showOnDetail: a.showOnDetail, usage: a.values.length, options: a.options.map((o) => ({ id: o.id, value: o.value, label: o.label, _k: o.id })) }))} />
    </>
  );
}
