"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { attachTextWarp } from "./text-warp";

/**
 * Website motion runtime (styles in app/motion.css). Needs no markup changes in most places:
 * - Tags what's inside <main> to reveal on scroll: each section's heading block and the items of its grids and
 *   lists, with a stagger. Anything already on screen when the page opens is left as it is (no flash).
 * - Counts numbers up when they come into view: elements with data-countup ("1.2K+", "98%", "7 days"…).
 * - Fills progress rails (data-progress, CSS variable --p from 0 to 1) and marks steps reached (data-steps).
 * - Starts logo marquees (.cg-marquee) once the row is wider than the screen, doubling the list to loop.
 * - Every other page (whatever its markup): headings, cards, grid items, tables, articles and panels in <main>
 *   reveal on scroll too, and the footer's columns. Page titles lift in on load with CSS alone (motion.css).
 * - Header: a soft shadow once the page scrolls (html.cg-scrolled). Blog posts: a reading-progress bar.
 * - Blocks marked data-play get .is-play once a quarter of them is in view, to start their own animation
 *   (product page: rating ring, score bars, the popular plan's beam, ticks — design concept 04).
 * Runs again after each page change. Nothing happens for "off" or for people who prefer reduced motion.
 */
type Level = "full" | "subtle" | "off";

const ITEM_SELECTORS = [
  ":scope > ul > li", ":scope > ol > li", ":scope > dl > div",
  ":scope .grid > li", ":scope .grid > article", ":scope .grid > div", ":scope .grid > a",
];

/** Blocks revealed on any page (after the section pass), outermost first. */
const GENERIC_SELECTORS = "h2, .grid > *, article, table, details, figure, blockquote, .rounded-panel, .prose > *, [class*='rounded-2xl'][class*='border'], [class*='rounded-xl'][class*='border']";
/** Never hidden: page chrome, things that stick or float, live widgets and anything already animated. */
const SKIP = "header, nav, dialog, [role='dialog'], [data-no-motion], .sticky, .fixed, .cg-marquee, [data-cg-clone], .cg-hero-in, [data-textwarp], .cg-flow svg";
const MAX_TAGS = 400;

function tagReveals(root: HTMLElement, observer: IntersectionObserver) {
  const vh = window.innerHeight;
  // Inside the screen right now (a page opened with Back may be scrolled down: what's above is off screen too).
  const onScreen = (el: Element) => { const r = el.getBoundingClientRect(); return r.top < vh * 0.92 && r.bottom > 0; };
  const tag = (el: HTMLElement, i: number, kind?: string) => {
    if (el.hasAttribute("data-rv") || el.closest("[data-no-motion]")) return;
    // One animation per block: not inside, nor around, something already revealing.
    if (el.parentElement?.closest("[data-rv]") || el.querySelector("[data-rv]")) return;
    if (onScreen(el)) return; // visible at load: leave it alone
    el.setAttribute("data-rv", kind ?? "");
    el.style.setProperty("--rv-i", String(i));
    observer.observe(el);
  };
  for (const section of root.querySelectorAll<HTMLElement>("section")) {
    if (section.closest("[data-no-motion]") || section.querySelector(":scope .cg-hero-in")) continue;
    // Heading block: first heading's wrapper.
    const h = section.querySelector<HTMLElement>("h2, h3");
    if (h) tag(h.parentElement && h.parentElement !== section ? h.parentElement : h, 0, section.classList.contains("cg-fold") ? "fold" : undefined);
    const items = new Set<HTMLElement>();
    for (const sel of ITEM_SELECTORS) section.querySelectorAll<HTMLElement>(sel).forEach((el) => items.add(el));
    let i = 1;
    let lastTop = -1;
    for (const el of items) {
      if (el.closest("[data-rv]")) continue;
      // Restart the stagger on each new row.
      const top = Math.round(el.getBoundingClientRect().top);
      if (top !== lastTop) { if (lastTop !== -1 && top > lastTop) i = Math.max(1, i - 2); lastTop = top; }
      tag(el, i++);
    }
    if (!items.size && !h) tag(section, 0);
  }

  // Any page: generic blocks, outermost first (a block that is partly on screen at load is left as it is,
  // and its own blocks further down reveal one by one).
  let n = root.querySelectorAll("[data-rv]").length;
  for (const el of root.querySelectorAll<HTMLElement>(GENERIC_SELECTORS)) {
    if (n >= MAX_TAGS) break;
    if (el.closest(SKIP) || el.offsetHeight === 0) continue;
    // Stagger items of the same grid row; everything else starts at once.
    const parent = el.parentElement;
    const i = parent?.classList.contains("grid") ? Math.min(6, [...parent.children].indexOf(el) % 4) : 0;
    const before = el.hasAttribute("data-rv");
    tag(el, i);
    if (!before && el.hasAttribute("data-rv")) n++;
  }
}

/** Footer columns rise in when the footer comes into view. */
function tagFooter(observer: IntersectionObserver) {
  const vh = window.innerHeight;
  document.querySelectorAll<HTMLElement>("footer .grid > *").forEach((el, i) => {
    const r = el.getBoundingClientRect();
    if (el.hasAttribute("data-rv") || (r.top < vh * 0.92 && r.bottom > 0)) return;
    el.setAttribute("data-rv", "");
    el.style.setProperty("--rv-i", String(i % 6));
    observer.observe(el);
  });
}

function parseCount(text: string) {
  const m = text.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
  if (!m) return null;
  const value = Number(m[2]!.replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  return { prefix: m[1]!, value, decimals: (m[2]!.split(".")[1] ?? "").length, grouped: m[2]!.includes(","), suffix: m[3]! };
}

function countUp(el: HTMLElement) {
  const final = el.dataset.countupFinal ?? el.textContent ?? "";
  el.dataset.countupFinal = final;
  const p = parseCount(final.trim());
  if (!p || p.value === 0) return;
  const fmt = (n: number) => {
    const s = n.toFixed(p.decimals);
    return p.grouped ? Number(s).toLocaleString("en-IN", { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals }) : s;
  };
  const start = performance.now();
  const dur = Math.min(2000, 900 + p.value * 2);
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = `${p.prefix}${fmt(p.value * eased)}${p.suffix}`;
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = final;
  };
  requestAnimationFrame(step);
}

/**
 * Logo marquees (.cg-marquee wrapping a <ul>), like certinal.com's client logos: the row scrolls endlessly at an
 * even speed, fades at both edges and pauses on hover. With data-rows="2" and 8+ logos, a second row (starting
 * halfway through the list) moves the other way. Copies made for the loop are hidden from screen readers and keyboard.
 */
const MARQUEE_SPEED = 40; // px per second

function cloneItem(li: Element) {
  const copy = li.cloneNode(true) as HTMLElement;
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("data-cg-clone", "");
  copy.removeAttribute("data-rv");
  copy.classList.add("rv-in");
  copy.querySelectorAll("a, button").forEach((a) => a.setAttribute("tabindex", "-1"));
  return copy;
}

function runMarquee(box: HTMLElement, list: HTMLElement, reverse: boolean, only?: Element[]) {
  // `only`: the items this row loops (the rest of the list is hidden in this row).
  const originals = only ?? [...list.children];
  if (!originals.length) return;
  // Running first: copies (and a copied row) only take up space, and so can be measured, once it runs.
  if (reverse) box.classList.add("is-reverse");
  box.classList.add("is-running");
  // One "set" must be at least as wide as the box, so the loop never shows a gap.
  const gap = parseFloat(getComputedStyle(list).columnGap) || 16;
  const setWidth = () => originals.reduce((n, li) => n + (li as HTMLElement).offsetWidth + gap, 0);
  const one = setWidth();
  if (one < 40) return;
  const repeats = Math.min(8, Math.max(1, Math.ceil((box.clientWidth + 1) / one)));
  for (let r = 1; r < repeats; r++) originals.forEach((li) => list.appendChild(cloneItem(li)));
  // …then the whole set twice, and the track moves by exactly half its width.
  [...list.children].filter((li) => !li.hasAttribute("data-cg-row-hide")).forEach((li) => list.appendChild(cloneItem(li)));
  box.style.setProperty("--marquee-s", `${Math.max(12, (one * repeats) / MARQUEE_SPEED).toFixed(1)}s`);
}

function startMarquees() {
  document.querySelectorAll<HTMLElement>(".cg-marquee:not(.is-running)").forEach((box) => {
    const list = box.querySelector<HTMLElement>(":scope > ul");
    if (!list) return;
    const items = [...list.children];
    if (box.dataset.rows === "2" && items.length >= 8 && !box.dataset.split) {
      // Second row with the second half of the logos, moving the other way.
      box.dataset.split = "1";
      const second = box.cloneNode(false) as HTMLElement;
      second.setAttribute("data-cg-clone", "");
      second.removeAttribute("data-rows");
      // Each row gets its own half of the logos, so the two rows never show the same brands. The page's own
      // logos stay where React put them: the second half is only hidden in the top row and copied into the bottom one.
      const list2 = list.cloneNode(false) as HTMLElement;
      const half = Math.ceil(items.length / 2);
      items.slice(half).forEach((li) => {
        list2.appendChild(cloneItem(li));
        li.setAttribute("data-cg-row-hide", "");
      });
      second.appendChild(list2);
      box.after(second);
      runMarquee(box, list, false, items.slice(0, half));
      runMarquee(second, list2, true);
      return;
    }
    runMarquee(box, list, box.dataset.reverse === "1");
  });
}

export function SiteMotion({ level }: { level: Level }) {
  const pathname = usePathname();
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (level === "off" || reduced) return;
    const html = document.documentElement;
    const main = document.getElementById("main");
    if (!main) return;

    // Reveals play every time a block scrolls into view: once it has gone back below the screen (the visitor
    // scrolled up past it), it is hidden again, off screen, ready to play on the way down.
    const revealer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) e.target.classList.add("rv-in");
        else if (e.rootBounds && e.boundingClientRect.top > e.rootBounds.bottom) e.target.classList.remove("rv-in");
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    const counter = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        countUp(e.target as HTMLElement);
        (e.target as HTMLElement).setAttribute("data-cu-done", "");
        counter.unobserve(e.target);
      }),
      { threshold: 0.6 },
    );

    const player = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-play");
        player.unobserve(e.target);
      }),
      { threshold: 0.25 },
    );

    // Tag what's on the page now, and again whenever React replaces part of it (hydration, refreshes,
    // client-side loading); tagging is idempotent.
    const scan = () => {
      html.classList.add("rv-ready");
      tagReveals(main, revealer);
      tagFooter(revealer);
      // (Re)watch everything tagged, also blocks tagged just before a page change by the previous page's watcher,
      // which no longer exists; watching twice is harmless.
      document.querySelectorAll<HTMLElement>("[data-rv]").forEach((el) => revealer.observe(el));
      document.querySelectorAll<HTMLElement>("[data-countup]:not([data-cu-done])").forEach((el) => counter.observe(el));
      document.querySelectorAll<HTMLElement>("[data-play]:not(.is-play)").forEach((el) => player.observe(el));
      if (level === "full") {
        startMarquees();
        // Hover effect on big headings (data-textwarp): mouse and trackpad only.
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
          document.querySelectorAll<HTMLElement>("[data-textwarp]:not([data-tw-ready])").forEach((el) => warps.push(attachTextWarp(el)));
        }
      }
    };
    const warps: (() => void)[] = [];
    let timer = 0;
    const later = () => { window.clearTimeout(timer); timer = window.setTimeout(scan, 120); };
    const raf = requestAnimationFrame(scan);
    // Also by timer: animation frames don't run while the tab is in the background (scanning twice is harmless).
    const first = window.setTimeout(scan, 60);
    const mo = new MutationObserver((list) => { if (list.some((m) => m.addedNodes.length)) later(); });
    mo.observe(main, { childList: true, subtree: true });

    // Reading progress on blog posts (an <article> with the page title in it).
    const article = level === "full" ? main.querySelector<HTMLElement>("article:has(h1)") : null;
    let bar: HTMLDivElement | null = null;
    if (article && article.offsetHeight > window.innerHeight * 1.5) {
      bar = document.createElement("div");
      bar.className = "cg-read-progress";
      bar.setAttribute("aria-hidden", "true");
      document.body.appendChild(bar);
    }

    // Scroll-driven rails and steps.
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      html.classList.toggle("cg-scrolled", window.scrollY > 8);
      if (bar && article) {
        const r = article.getBoundingClientRect();
        bar.style.setProperty("--p", Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - vh))).toFixed(3));
      }
      // Looked up each time: React may have replaced the elements since the page opened.
      for (const el of document.querySelectorAll<HTMLElement>("[data-progress]")) {
        const r = el.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
        el.style.setProperty("--p", p.toFixed(3));
        el.querySelectorAll<HTMLElement>("[data-steps] > li").forEach((li, i, all) => li.classList.toggle("is-reached", p >= (i + 0.5) / all.length));
      }
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(first);
      window.clearTimeout(timer);
      mo.disconnect();
      warps.forEach((off) => off());
      revealer.disconnect();
      counter.disconnect();
      player.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      bar?.remove();
      html.classList.remove("cg-scrolled");
    };
  }, [level, pathname]);
  return null;
}
