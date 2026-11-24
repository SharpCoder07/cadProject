"use client";

import { useEffect } from "react";

/**
 * Search results page (design concept 11 "Live results feed"): marks the searched words in each result's
 * name and description, then a highlighter sweeps over them (motion.css .cg-hl). The results wrapper is keyed
 * by the full query, so a new search remounts it and the marks are rebuilt from fresh nodes.
 */
export function SearchHighlight({ q }: { q: string }) {
  useEffect(() => {
    const words = [...new Set(q.toLowerCase().split(/\s+/).filter((w) => w.length >= 2))].map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const feed = document.querySelector<HTMLElement>(".cg-sfeed");
    if (!words.length || !feed) return;
    const re = new RegExp(`(${words.join("|")})`, "gi");
    feed.querySelectorAll<HTMLElement>("article").forEach((row, ri) => {
      // Name (link text) and the short description's own text, not its "Read more" link.
      const nodes: Text[] = [];
      row.querySelectorAll("h3 a").forEach((a) => a.childNodes.forEach((n) => n.nodeType === 3 && nodes.push(n as Text)));
      row.querySelectorAll("p.line-clamp-2").forEach((p) => p.childNodes.forEach((n) => n.nodeType === 3 && nodes.push(n as Text)));
      for (const node of nodes) {
        const text = node.nodeValue ?? "";
        if (!re.test(text)) continue;
        re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0;
        for (const m of text.matchAll(re)) {
          const i = m.index ?? 0;
          if (i > last) frag.append(text.slice(last, i));
          const mark = document.createElement("mark");
          mark.className = "cg-hl";
          mark.style.setProperty("--d", `${Math.min(ri, 9) * 0.07}s`);
          mark.textContent = m[0];
          frag.append(mark);
          last = i + m[0].length;
        }
        if (last < text.length) frag.append(text.slice(last));
        node.replaceWith(frag);
      }
    });
  }, [q]);
  return null;
}
