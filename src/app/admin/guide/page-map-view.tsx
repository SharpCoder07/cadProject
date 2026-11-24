"use client";

import { useState } from "react";
import { PathLink, Where } from "./guide-view";
import type { PageMap } from "@/lib/page-maps";

/** One website page, split into numbered sections from the top of the screen to the bottom. */
export function PageMapView({ maps }: { maps: PageMap[] }) {
  const [id, setId] = useState(maps[0]?.id);
  const map = maps.find((m) => m.id === id) ?? maps[0];
  if (!map) return null;
  const groups = [...maps.reduce((acc, m) => acc.set(m.group, [...(acc.get(m.group) ?? []), m]), new Map<string, PageMap[]>())];
  return (
    <div className="space-y-5">
      <div className="space-y-2.5" role="tablist" aria-label="Choose a page">
        {groups.map(([group, list]) => (
          <div key={group} className="grid gap-1.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted sm:pt-1.5">{group}</span>
            <div className="flex flex-wrap gap-1.5">
            {list.map((m) => {
              const on = m.id === map.id;
              return (
                <button key={m.id} type="button" role="tab" aria-selected={on} title={m.url} onClick={() => setId(m.id)}
                  className={`rounded-full border px-3 py-1 text-[13px] font-semibold transition ${on ? "border-mint bg-mint-soft text-mint-ink" : "border-line bg-surface text-ink hover:border-mint"}`}>
                  {m.name}
                </button>
              );
            })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-line pt-4">
        <h2 className="text-lg font-semibold text-ink">{map.name}</h2>
        <code className="break-all rounded bg-ink/5 px-1.5 py-0.5 text-xs text-muted">{map.url}</code>
      </div>

      {map.intro && <p className="text-sm text-muted">{map.intro}</p>}
      <p className="text-sm text-muted">Scroll the page on the website from top to bottom: section 1 is the first thing you see.</p>

      <ol className="space-y-3">
        {map.sections.map((sec, i) => (
          <li key={`${i}-${sec.title}`} className="overflow-hidden rounded-[20px] border border-line/80 bg-surface shadow-[0_1px_2px_rgb(var(--color-ink)/0.04),0_12px_32px_-24px_rgb(var(--color-ink)/0.25)]">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold tabular-nums text-surface" aria-hidden>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-ink">
                  <span className="sr-only">Section {i + 1}: </span>{sec.title}
                  {sec.shared && <span className="ml-2 rounded bg-ink/5 px-1.5 py-0.5 align-middle text-[11px] font-medium text-muted">{sec.shared === "header" ? "header, same on every page" : "footer, same on every page"}</span>}
                </h3>
                {sec.summary && <p className="text-xs text-muted">{sec.summary}</p>}
              </div>
              {sec.edit && <span className="inline-flex items-center gap-1.5 text-sm text-muted">Edit in <PathLink where={sec.edit} /></span>}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {sec.rows.map((r, j) => (
                  <tr key={j} className="block border-t border-line first:border-t-0 sm:table-row">
                    <td className="block px-5 pb-0.5 pt-2.5 font-medium text-ink sm:table-cell sm:w-[42%] sm:py-2.5 sm:align-top">
                      <span className="mr-2 tabular-nums text-muted">{i + 1}.{j + 1}</span>{r.part}
                    </td>
                    <td className="block px-5 pb-2.5 pt-0.5 sm:table-cell sm:py-2.5 sm:align-top"><Where row={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </li>
        ))}
      </ol>
    </div>
  );
}
