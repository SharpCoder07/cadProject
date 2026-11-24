"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, EyeOff } from "lucide-react";
import type { CategoryNode } from "@/server/services/categories";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/misc";
import { SortableList } from "@/components/admin/sortable";
import { useServerAction } from "@/components/admin/use-action";
import { cn } from "@/lib/utils";
import { moveCategoryAction } from "./actions";

/** Drag to reorder within a level; use “Move to” to change the parent. Saves immediately. */
export function CategoryTree({ roots, flat }: { roots: CategoryNode[]; flat: { id: string; name: string; depth: number }[] }) {
  const { run, pending } = useServerAction(moveCategoryAction);
  return (
    <div className={cn(pending && "pointer-events-none opacity-60")}>
      <Level nodes={roots} parentId={null} flat={flat} onMove={(id, parentId, order) => void run({ id, parentId, orderedSiblingIds: order })} />
    </div>
  );
}

function Level({ nodes, parentId, flat, onMove }: { nodes: CategoryNode[]; parentId: string | null; flat: { id: string; name: string; depth: number }[]; onMove: (id: string, parentId: string | null, order: string[]) => void }) {
  const [items, setItems] = useState(nodes);
  // Server data wins after each save/refresh.
  useEffect(() => setItems(nodes), [nodes]);
  return (
    <SortableList
      items={items}
      getId={(n) => n.id}
      onReorder={(next) => {
        setItems(next);
        const moved = next.find((n, i) => n.id !== items[i]?.id);
        if (moved) onMove(moved.id, parentId, next.map((n) => n.id));
      }}
      renderItem={(node, _i, handle) => <Node node={node} handle={handle} flat={flat} onMove={onMove} />}
    />
  );
}

function Node({ node, handle, flat, onMove }: { node: CategoryNode; handle: React.ReactNode; flat: { id: string; name: string; depth: number }[]; onMove: (id: string, parentId: string | null, order: string[]) => void }) {
  const [open, setOpen] = useState(node.depth === 0);
  const descendantIds = new Set<string>();
  const walk = (n: CategoryNode) => n.children.forEach((c) => { descendantIds.add(c.id); walk(c); });
  walk(node);
  return (
    <div>
      <div className="flex items-center gap-2 admin-card px-2 py-2">
        {handle}
        <button type="button" onClick={() => setOpen((o) => !o)} disabled={!node.children.length} className="rounded p-0.5 text-muted disabled:invisible" aria-label={open ? "Collapse" : "Expand"} aria-expanded={open}>
          <ChevronRight className={cn("h-4 w-4 transition-transform", open && "rotate-90")} />
        </button>
        <Icon name={node.icon} className="h-4 w-4 text-mint-ink" />
        <Link href={`/admin/categories/${node.id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-mint-ink">{node.name}</Link>
        {!node.isActive && <Badge><EyeOff className="h-3 w-3" aria-hidden /> Hidden</Badge>}
        <span className="hidden text-xs text-muted sm:inline">{node.softwareCount} published</span>
        <label className="hidden items-center gap-1 text-xs text-muted md:flex">
          Move to
          <select
            className="h-7 max-w-[10rem] rounded-control border border-line bg-surface px-1 text-xs"
            value={node.parentId ?? ""}
            onChange={(e) => onMove(node.id, e.target.value || null, [node.id])}
          >
            <option value="">Top level</option>
            {flat.filter((f) => f.id !== node.id && !descendantIds.has(f.id) && f.depth < 4).map((f) => <option key={f.id} value={f.id}>{"— ".repeat(f.depth)}{f.name}</option>)}
          </select>
        </label>
      </div>
      {open && node.children.length > 0 && (
        <div className="ml-8 mt-2">
          <Level nodes={node.children} parentId={node.id} flat={flat} onMove={onMove} />
        </div>
      )}
    </div>
  );
}
