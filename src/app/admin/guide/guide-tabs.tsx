"use client";

import { PILL_TRACK, pillTab } from "@/components/admin/list-panel";
import { useState } from "react";
import { GuideView } from "./guide-view";
import { PageMapView } from "./page-map-view";
import type { GuideGroup } from "@/lib/editing-guide";
import type { PageMap } from "@/lib/page-maps";

const TABS = [
  { id: "map", label: "Page by page (top to bottom)" },
  { id: "all", label: "Search every part" },
] as const;

export function GuideTabs({ groups, maps }: { groups: GuideGroup[]; maps: PageMap[] }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("map");
  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Guide view" className={PILL_TRACK}>
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={pillTab(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "map" ? <PageMapView maps={maps} /> : <GuideView groups={groups} />}
    </div>
  );
}
