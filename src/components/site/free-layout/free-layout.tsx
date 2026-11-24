"use client";

import dynamic from "next/dynamic";
import { useSectionEditor } from "@/components/site/edit-mode";
import type { LayoutData } from "@/lib/blocks/free-layout";
import { FreeLayoutView, type Slots } from "./view";

/** Loaded only in edit mode (drag-and-drop, widget settings). */
const FreeLayoutEditor = dynamic(() => import("./editor").then((m) => m.FreeLayoutEditor), { ssr: false, loading: () => null });

/** A "Free layout" section: the plain design for visitors, the drag-and-drop editor in edit mode. */
export function FreeLayout({ sectionId, data, slots }: { sectionId: string; data: LayoutData; slots?: Slots }) {
  const editor = useSectionEditor(sectionId);
  if (editor) return <FreeLayoutEditor data={data} editor={editor} slots={slots} />;
  return <FreeLayoutView rows={data.rows} slots={slots} />;
}
