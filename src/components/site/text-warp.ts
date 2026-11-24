/**
 * "Text warp" hover effect for big headings (inspired by certinal.com's hero): around the pointer the heading's
 * letters dissolve into small particles in the theme's colours that swirl away from the cursor and flow back
 * into place when it moves on. Used on elements with data-textwarp (the homepage hero heading).
 *
 * How: the heading's words are drawn once onto an off-screen canvas with the same font, sampled into particles
 * (their "home" positions), and drawn on a canvas laid over the heading. A CSS mask cuts a soft hole in the real
 * text under the pointer, so the particles take its place there and the rest of the heading stays real text
 * (selectable, readable by screen readers). Only for mouse/trackpad users who haven't asked for reduced motion.
 */

const R = 120; // hole radius around the pointer (px)
const REACH = 2.2; // particles move within R × REACH
const STEP = 3; // sampling grid (px): smaller = more particles
const MAX = 3600;

interface P { hx: number; hy: number; x: number; y: number; c: number }

const rgb = (v: string, fallback: [number, number, number]): [number, number, number] => {
  const parts = v.trim().split(/[\s,]+/).map(Number);
  return parts.length >= 3 && parts.every((n) => Number.isFinite(n)) ? [parts[0]!, parts[1]!, parts[2]!] : fallback;
};

export function attachTextWarp(host: HTMLElement): () => void {
  if (host.dataset.twReady) return () => undefined;
  host.dataset.twReady = "1";
  const stage = host.offsetParent as HTMLElement | null;
  if (!stage) return () => undefined;

  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "absolute", pointerEvents: "none", zIndex: "1", opacity: "0", transition: "opacity .35s ease" });
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  let particles: P[] = [];
  let built = false;
  let pad = 0;
  let origin = { x: 0, y: 0 }; // canvas top-left, in page coordinates
  let mouse = { x: -9999, y: -9999 };
  let hole = 0; // current hole radius (eases in and out)
  let active = false;
  let raf = 0;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const BUCKETS = 10;
  let palette: string[] = [];

  /** Rasterises the heading's words and samples them into particles. */
  const build = () => {
    const hr = host.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    pad = Math.round(R * 0.8);
    const w = Math.ceil(hr.width + pad * 2);
    const h = Math.ceil(hr.height + pad * 2);
    origin = { x: hr.left - pad + window.scrollX, y: hr.top - pad + window.scrollY };
    Object.assign(canvas.style, { left: `${hr.left - sr.left - pad}px`, top: `${hr.top - sr.top - pad}px`, width: `${w}px`, height: `${h}px` });
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const o = off.getContext("2d", { willReadFrequently: true })!;
    const cs = getComputedStyle(host);
    o.fillStyle = "#000";
    o.textBaseline = "middle";
    const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? "";
      const ps = getComputedStyle(node.parentElement ?? host);
      o.font = `${ps.fontStyle} ${ps.fontWeight} ${ps.fontSize} ${ps.fontFamily}`;
      (o as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = ps.letterSpacing === "normal" ? "0px" : ps.letterSpacing;
      for (const m of text.matchAll(/\S+/g)) {
        range.setStart(node, m.index!);
        range.setEnd(node, m.index! + m[0].length);
        const r = range.getClientRects()[0];
        if (!r) continue;
        o.fillText(m[0], r.left - hr.left + pad, r.top - hr.top + pad + r.height / 2);
      }
    }
    void cs;
    const data = o.getImageData(0, 0, w, h).data;
    const all: P[] = [];
    for (let y = 0; y < h; y += STEP) {
      for (let x = 0; x < w; x += STEP) {
        if (data[(y * w + x) * 4 + 3]! > 120) all.push({ hx: x, hy: y, x, y, c: Math.min(BUCKETS - 1, Math.floor((x / w) * BUCKETS)) });
      }
    }
    // Thin out evenly if there are too many.
    particles = all.length > MAX ? all.filter((_, i) => i % Math.ceil(all.length / MAX) === 0) : all;

    // Colours: primary → accent across the heading.
    const root = getComputedStyle(document.documentElement);
    const a = rgb(root.getPropertyValue("--color-primary"), [15, 118, 110]);
    const b = rgb(root.getPropertyValue("--color-accent"), [245, 158, 11]);
    palette = Array.from({ length: BUCKETS }, (_, i) => {
      const t = i / (BUCKETS - 1);
      return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
    });
    built = true;
  };

  const setMask = () => {
    if (hole < 1) {
      host.style.removeProperty("mask-image");
      host.style.removeProperty("-webkit-mask-image");
      return;
    }
    const hr = host.getBoundingClientRect();
    const mx = mouse.x - (hr.left + window.scrollX);
    const my = mouse.y - (hr.top + window.scrollY);
    const m = `radial-gradient(circle ${hole * 1.35}px at ${mx}px ${my}px, transparent 55%, #000 100%)`;
    host.style.setProperty("mask-image", m);
    host.style.setProperty("-webkit-mask-image", m);
  };

  const frame = () => {
    raf = 0;
    hole += ((active ? R : 0) - hole) * (active ? 0.18 : 0.1);
    const mx = mouse.x - origin.x;
    const my = mouse.y - origin.y;
    const reach = R * REACH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const buckets: number[][] = palette.map(() => []);
    let moving = false;
    for (const p of particles) {
      const dx = p.hx - mx;
      const dy = p.hy - my;
      const d = Math.hypot(dx, dy) || 1;
      let tx = p.hx;
      let ty = p.hy;
      if (active && d < reach) {
        const s = (1 - d / reach) ** 2;
        // Pushed away from the pointer and swirled around it.
        tx += (dx / d) * s * 46 + (-dy / d) * s * 38;
        ty += (dy / d) * s * 46 + (dx / d) * s * 38;
      }
      p.x += (tx - p.x) * 0.16;
      p.y += (ty - p.y) * 0.16;
      if (Math.abs(tx - p.x) > 0.3 || Math.abs(ty - p.y) > 0.3) moving = true;
      // Only drawn where the real text is masked away (the hole and its soft edge).
      const hd = Math.hypot(p.hx - mx, p.hy - my);
      if (hd < hole * 1.35) buckets[p.c]!.push(p.x, p.y);
    }
    for (let i = 0; i < buckets.length; i++) {
      const list = buckets[i]!;
      if (!list.length) continue;
      ctx.fillStyle = palette[i]!;
      ctx.beginPath();
      for (let j = 0; j < list.length; j += 2) ctx.rect(list[j]!, list[j + 1]!, 1.9, 1.9);
      ctx.fill();
    }
    setMask();
    if (active || hole > 0.5 || moving) raf = requestAnimationFrame(frame);
    else {
      hole = 0;
      setMask();
      canvas.style.opacity = "0";
    }
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  const onEnter = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (!built) build();
    active = true;
    canvas.style.opacity = "1";
    mouse = { x: e.pageX, y: e.pageY };
    kick();
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    mouse = { x: e.pageX, y: e.pageY };
    if (active) kick();
  };
  const onLeave = () => { active = false; kick(); };
  const onResize = () => { built = false; };

  host.addEventListener("pointerenter", onEnter);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);
  window.addEventListener("resize", onResize);
  document.fonts?.ready.then(() => { built = false; }).catch(() => undefined);

  return () => {
    cancelAnimationFrame(raf);
    host.removeEventListener("pointerenter", onEnter);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerleave", onLeave);
    window.removeEventListener("resize", onResize);
    host.style.removeProperty("mask-image");
    host.style.removeProperty("-webkit-mask-image");
    canvas.remove();
    delete host.dataset.twReady;
  };
}
