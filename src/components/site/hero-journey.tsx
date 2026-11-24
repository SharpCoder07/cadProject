"use client";

import { useEffect, useRef, useState } from "react";
import { GitCompareArrows, ListChecks, Search, ShoppingCart } from "lucide-react";

/**
 * Homepage hero background (design concept E "Journey path"): a rounded orbit around the hero content with the
 * buyer's journey on it, Discover → Compare → Shortlist → Buy. A glowing dot circles it and each stop lights up as
 * the dot passes. The orbit measures the real content (headline, search, stats…) and keeps a gap around it, so it
 * never runs through text or cards whatever their size. Wide screens only (xl+), where the stops fit in the margins.
 */
const GAP_X = 56; // px outside the widest content
const GAP_Y = 40; // px above the first and below the last content block
const SPEED = 190; // px per second: the pointer moves at the same steady pace on every screen size
const ICONS = [Search, GitCompareArrows, ListChecks, ShoppingCart];

type Side = "left" | "right";
type Geo = { w: number; h: number; path: string; lap: number; stops: { x: number; y: number; at: number; side: Side; icon: number }[] };

function measure(box: HTMLElement, self: HTMLElement): Geo | null {
  // Layout boxes (offsetLeft/Top/Width/Height), not on-screen ones: the content slides in when the page loads, and
  // a mid-animation measurement would put the orbit through the cards once they settle.
  const items = [...box.children].filter(
    (c): c is HTMLElement => c instanceof HTMLElement && c !== self && c.tagName !== "CANVAS" && c.getAttribute("aria-hidden") !== "true" && !["absolute", "fixed"].includes(getComputedStyle(c).position) && c.offsetWidth > 0 && c.offsetHeight > 0,
  );
  if (!items.length) return null;
  const rect = (c: HTMLElement) => {
    // Count what is actually visible, not the full box: a full-width line of centred text (the eyebrow) counts by
    // its text width, and a flex/grid row narrower than its box counts by its children.
    let left = c.offsetLeft;
    let right = c.offsetLeft + c.offsetWidth;
    const display = getComputedStyle(c).display;
    const kids = [...c.children].filter((k): k is HTMLElement => k instanceof HTMLElement && k.offsetWidth > 0);
    if (/flex|grid/.test(display) && kids.length && kids.every((k) => k.offsetParent === c.offsetParent)) {
      left = Math.min(...kids.map((k) => k.offsetLeft));
      right = Math.max(...kids.map((k) => k.offsetLeft + k.offsetWidth));
    } else if (!/flex|grid/.test(display) && c.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(c);
      const text = range.getBoundingClientRect().width;
      if (text > 0 && text < c.offsetWidth) {
        left = c.offsetLeft + (c.offsetWidth - text) / 2;
        right = left + text;
      }
    }
    return { left, right, top: c.offsetTop, bottom: c.offsetTop + c.offsetHeight };
  };
  const rs = items.map(rect);
  const L = Math.min(...rs.map((r) => r.left)) - GAP_X;
  const R = Math.max(...rs.map((r) => r.right)) + GAP_X;
  const T = Math.max(8, Math.min(...rs.map((r) => r.top)) - GAP_Y);
  const B = Math.max(...rs.map((r) => r.bottom)) + GAP_Y;
  const b = { width: box.clientWidth, height: box.clientHeight };
  const w = R - L;
  const h = B - T;
  // Corner radius small enough that each rounded corner still clears the content's corner (with 8px to spare).
  let r = Math.min(120, h / 2.5, w / 4);
  while (r > 12 && Math.hypot(r - GAP_X, r - GAP_Y) + 8 > r) r -= 2;
  const s = h - 2 * r; // straight part of each side
  const top = w - 2 * r;
  const P = 2 * s + 2 * top + 2 * Math.PI * r;
  // Clockwise from the lower end of the left side.
  const path = `M${L} ${B - r} V${T + r} A${r} ${r} 0 0 1 ${L + r} ${T} H${R - r} A${r} ${r} 0 0 1 ${R} ${T + r} V${B - r} A${r} ${r} 0 0 1 ${R - r} ${B} H${L + r} A${r} ${r} 0 0 1 ${L} ${B - r} Z`;
  const shortlist = s + Math.PI * r + top;
  return {
    w: b.width,
    h: b.height,
    path,
    lap: P / SPEED,
    stops: [
      { x: L, y: B - r, at: 0, side: "left", icon: 0 },
      { x: L, y: T + r, at: s / P, side: "left", icon: 1 },
      { x: R, y: T + r, at: shortlist / P, side: "right", icon: 2 },
      { x: R, y: B - r, at: (shortlist + s) / P, side: "right", icon: 3 },
    ],
  };
}

export function HeroJourney({ labels }: { labels: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);

  useEffect(() => {
    const self = ref.current;
    const box = self?.parentElement;
    if (!self || !box) return;
    const update = () => {
      if (getComputedStyle(self).display === "none") return setGeo(null);
      setGeo(measure(box, self));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    [...box.children].forEach((c) => c !== self && c.tagName !== "CANVAS" && ro.observe(c));
    // Fonts and the intro animation can change sizes just after load.
    const t = setTimeout(update, 1200);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden data-no-motion className="cg-journey pointer-events-none absolute inset-0" style={geo ? { ["--lap" as string]: `${geo.lap.toFixed(2)}s` } : undefined}>
      {geo && (
        <>
          <svg viewBox={`0 0 ${geo.w} ${geo.h}`} width={geo.w} height={geo.h} className="cg-journey-svg absolute left-0 top-0">
            <path d={geo.path} className="cg-j-track" pathLength={100} />
            <path d={geo.path} className="cg-j-trail" pathLength={100} />
            <path d={geo.path} className="cg-j-dot" pathLength={100} />
          </svg>
          {geo.stops.map(({ x, y, at, side, icon }, i) => {
            const Icon = ICONS[icon]!;
            return (
              <span
                key={i}
                className={`cg-j-stop absolute flex items-center gap-2 ${side === "left" ? "flex-row-reverse" : ""} ${i === geo.stops.length - 1 ? "is-last" : ""}`}
                style={{ ...(side === "left" ? { right: geo.w - x - 24 } : { left: x - 24 }), top: y, ["--d" as string]: `${(at * geo.lap).toFixed(2)}s` }}
              >
                <span className="cg-j-node grid h-12 w-12 place-items-center rounded-full border border-primary/30 bg-surface text-primary shadow-[0_10px_24px_-14px_rgb(var(--color-primary)/0.7)]">
                  <Icon className="h-5 w-5" />
                </span>
                {labels[icon] && <span className="cg-j-label whitespace-nowrap rounded-full bg-surface/90 px-2.5 py-0.5 text-[12px] font-bold text-ink">{labels[icon]}</span>}
              </span>
            );
          })}
        </>
      )}
    </div>
  );
}
