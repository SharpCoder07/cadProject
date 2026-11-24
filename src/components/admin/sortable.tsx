"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Vertical drag-and-drop list (mouse, touch and keyboard: Space to lift, arrows to move). */
export function SortableList<T>({ items, getId, onReorder, renderItem, className }: { items: T[]; getId: (item: T) => string; onReorder: (items: T[]) => void; renderItem: (item: T, index: number, handle: ReactNode) => ReactNode; className?: string }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => getId(i) === e.active.id);
    const to = items.findIndex((i) => getId(i) === e.over!.id);
    if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <ul className={cn("space-y-2", className)}>
          {items.map((item, i) => (
            <SortableRow key={getId(item)} id={getId(item)}>
              {(handle) => renderItem(item, i, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const handle = (
    <button type="button" className="cursor-grab touch-none rounded p-1 text-muted hover:bg-ink/5 hover:text-ink active:cursor-grabbing" aria-label="Drag to reorder" {...attributes} {...listeners}>
      <GripVertical className="h-4 w-4" />
    </button>
  );
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && "relative z-10 opacity-80 shadow-lg")}>
      {children(handle)}
    </li>
  );
}

/** Up/down buttons as an accessible alternative to dragging. */
export function moveItem<T>(items: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (to < 0 || to >= items.length) return items;
  return arrayMove(items, index, to);
}
