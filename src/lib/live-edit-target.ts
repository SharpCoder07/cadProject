/**
 * Small, dependency-free part of website edit mode (loaded for every visitor with the site layout):
 * the kinds of content that can be edited in place, and which admin links map to them.
 * Field definitions live in lib/live-edit.ts (loaded only in the editor panel).
 */
export const LIVE_KINDS = ["software", "category", "post", "comparison", "vendor", "site", "labels", "theme", "texts", "brands", "industries", "vendors", "block", "style"] as const;
export type LiveKind = (typeof LIVE_KINDS)[number];
export interface LiveTarget {
  kind: LiveKind;
  /** For "block": the page section's id. */
  id: string;
  /** For "block": the block type (HERO…). */
  section: string;
  title?: string;
  /** Only these fields / website texts (a trailing * matches a prefix): just what this part of the page shows. */
  only?: string[];
  /**
   * Browser only: the texts, labels and links shown in the part of the page being edited. Every
   * field whose value is one of them is added to the panel (so nothing shown there is missed).
   */
  discover?: string[];
}

export const matchesOnly = (name: string, only?: string[]) => !only || only.some((o) => (o.endsWith("*") ? name.startsWith(o.slice(0, -1)) : name === o));

/** Admin links that can be edited in place instead: website texts, settings tabs. */
export function liveFromHref(href: string): LiveTarget | null {
  const u = new URL(href, "http://x");
  if (u.pathname === "/admin/cms/texts" && u.searchParams.get("group")) return { kind: "texts", id: u.searchParams.get("group")!, section: "texts" };
  if (u.pathname === "/admin/settings") {
    const tab = u.searchParams.get("tab");
    if (tab === "site" || tab === "labels" || tab === "theme") return { kind: tab, id: tab, section: "all" };
  }
  return null;
}

/**
 * The permission each kind needs (the same checks the server makes when loading and saving it).
 * Edit mode uses this to show only the parts someone's role can change; the server still checks.
 */
export const LIVE_KIND_PERMISSION: Record<LiveKind, string> = {
  software: "software.edit",
  category: "categories.manage",
  post: "blog.manage",
  comparison: "comparisons.manage",
  vendor: "vendors.manage",
  brands: "vendors.manage",
  vendors: "vendors.manage",
  industries: "taxonomy.manage",
  site: "settings.manage",
  labels: "settings.manage",
  theme: "settings.manage",
  texts: "settings.manage",
  block: "cms.pages",
  style: "settings.manage",
};

/** What one edit-mode draft change replaced (for Undo / Redo): the draft before and after it. */
export interface UndoEntry { key: string; before: unknown; after: unknown }
