"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Search, X } from "lucide-react";
import { Panel } from "@/components/ui/misc";
import type { GuideGroup, GuideRow, GuideWhere } from "@/lib/editing-guide";

export function PathLink({ where }: { where: { path: string[]; href: string } }) {
  return (
    <Link href={where.href} className="group inline-flex flex-wrap items-center gap-x-1 font-semibold text-ink hover:text-mint-ink">
      {where.path.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted" aria-hidden />}
          <span className="whitespace-nowrap group-hover:underline">{p}</span>
        </span>
      ))}
    </Link>
  );
}

export function Where({ row }: { row: GuideRow }) {
  const w: GuideWhere = row.where;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {w === "code" ? (
          <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-xs text-muted">in code</span>
        ) : w === "auto" ? (
          <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-xs text-muted">automatic</span>
        ) : (
          <PathLink where={w} />
        )}
        {row.tab && <span className="rounded bg-mint-soft px-1.5 py-0.5 text-xs font-medium text-mint-ink">{row.tab} tab</span>}
      </div>
      {row.note && <p className="mt-0.5 text-xs text-muted">{row.note}</p>}
    </div>
  );
}

const textOf = (r: GuideRow) => [r.part, typeof r.where === "string" ? r.where : r.where.path.join(" "), r.tab ?? "", r.note ?? ""].join(" ").toLowerCase();

/** Searchable list: every website page, each part of it, and where it's edited (paths link to the screen). */
export function GuideView({ groups }: { groups: GuideGroup[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          pages: g.pages
            .map((p) => {
              const pageHit = !term || `${p.name} ${p.url}`.toLowerCase().includes(term);
              return { ...p, rows: pageHit ? p.rows : p.rows.filter((r) => textOf(r).includes(term)) };
            })
            .filter((p) => p.rows.length > 0),
        }))
        .filter((g) => g.pages.length > 0),
    [groups, term],
  );
  const total = groups.reduce((n, g) => n + g.pages.length, 0);
  const shown = filtered.reduce((n, g) => n + g.pages.length, 0);

  return (
    <div className="space-y-6">
      <div className="sticky top-16 z-10 -mx-1 space-y-3 bg-bg/90 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="guide-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a page or part, e.g. footer, pricing, FAQ, banner…"
              aria-label="Search the editing guide"
              className="h-10 w-full rounded-control border border-line bg-surface pl-9 pr-9 text-sm text-ink placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-ink/5 hover:text-ink">
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          <span className="text-sm tabular-nums text-muted">{term ? `${shown} of ${total} pages match` : `${total} website pages`}</span>
        </div>
        {!term && (
          <nav aria-label="Jump to" className="flex flex-wrap gap-1.5">
            {groups.map((g) => (
              <a key={g.id} href={`#${g.id}`} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-ink hover:border-mint hover:text-mint-ink">{g.title}</a>
            ))}
          </nav>
        )}
      </div>

      {filtered.length === 0 && <p className="py-12 text-center text-sm text-muted">Nothing matches “{q.trim()}”. Try a shorter word, such as “logo” or “price”.</p>}

      {filtered.map((g) => (
        <section key={g.id} className="space-y-3">
          <div id={g.id} className="scroll-mt-40">
            <h2 className="text-lg font-semibold text-ink">{g.title}</h2>
            <p className="text-sm text-muted">{g.intro}</p>
          </div>
          {g.pages.map((p) => (
            <Panel key={p.name}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-5 py-3.5">
                <h3 className="font-semibold text-ink">{p.name}</h3>
                <code className="break-all rounded bg-ink/5 px-1.5 py-0.5 text-xs text-muted">{p.url}</code>
                <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted">
                  Start at <PathLink where={p.start} />
                </span>
              </div>
              <table className="w-full text-sm">
                <thead className="hidden sm:table-header-group">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
                    <th className="w-[38%] px-5 pb-1.5 pt-3">On the website</th>
                    <th className="px-5 pb-1.5 pt-3">Edit it in the admin</th>
                  </tr>
                </thead>
                <tbody>
                  {p.rows.map((r) => (
                    <tr key={r.part} className="block border-t border-line first:border-t-0 sm:table-row sm:first:border-t">
                      <td className="block px-5 pb-0.5 pt-2.5 font-medium text-ink sm:table-cell sm:py-2.5 sm:align-top">{r.part}</td>
                      <td className="block px-5 pb-2.5 pt-0.5 sm:table-cell sm:py-2.5 sm:align-top"><Where row={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          ))}
        </section>
      ))}

      <p className="flex items-start gap-2 text-xs text-muted">
        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Click any path to open that screen. “in code” parts can't be changed from the admin yet; ask your developer to make them editable.
      </p>
    </div>
  );
}
