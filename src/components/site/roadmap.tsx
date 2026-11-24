"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "How it works" roadmap (design concept 13 "Roadmap scrub") for List your software and Become a reseller.
 * Scrolling the page fills the track and moves through the steps; the matching step card fades in above it,
 * and the counter says "Step 2 of 3". Clicking a step jumps to it. All steps stay in the page for screen readers.
 */
export function Roadmap({ eyebrow, title, counter, steps }: { eyebrow?: string; title: string; counter: string; steps: { label: string; text: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const last = Math.max(steps.length - 1, 1);

  useEffect(() => {
    let raf = 0;
    const read = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      let v = Math.min(1, Math.max(0, (vh * 0.8 - top) / (vh * 0.55)));
      // A short page may never scroll far enough: at the bottom, show the last step.
      if (window.scrollY + vh >= document.documentElement.scrollHeight - 2 && top < vh) v = 1;
      setP(v);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  if (!steps.length) return null;
  const pos = p * last; // 0 … last
  const active = Math.round(pos);
  return (
    <div ref={ref} className="cg-road mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
          <h2 className="mt-1 font-display text-[1.4rem] font-extrabold text-ink sm:text-[1.6rem]">{title}</h2>
        </div>
        <span className="rounded-full bg-primary-soft px-3.5 py-1.5 text-[13px] font-extrabold text-primary" aria-live="polite">
          {counter.replace("{n}", String(active + 1)).replace("{total}", String(steps.length))}
        </span>
      </div>

      <ol data-no-motion className="mt-5 grid [grid-template-areas:'s']">
        {steps.map((s, i) => (
          <li
            key={i}
            className={`cg-road-card flex items-center gap-5 rounded-[22px] border border-line bg-surface px-6 py-5 shadow-[0_30px_60px_-44px_rgb(var(--color-primary)/0.8)] [grid-area:s] ${i === active ? "is-on" : ""}`}
          >
            <span className={`font-display text-[2.4rem] font-extrabold leading-none ${i === steps.length - 1 ? "text-accent" : "text-primary"}`}>{String(i + 1).padStart(2, "0")}</span>
            <span className="min-w-0">
              <span className="block font-display text-[1.15rem] font-extrabold text-ink">{s.label}</span>
              <span className="mt-1 block text-[14.5px] leading-relaxed text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>

      <div data-no-motion className="relative mx-5 mt-7 h-[70px]" aria-hidden>
        <span className="absolute inset-x-0 top-[20px] h-1.5 -translate-y-1/2 rounded-full bg-line">
          <span className="cg-road-fill absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,rgb(var(--color-primary)),rgb(var(--color-primary)/0.7))]" style={{ width: `${p * 100}%` }} />
        </span>
        {steps.map((s, i) => {
          const on = pos >= i - 0.3;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onClick={() => {
                const el = ref.current;
                if (!el) return;
                // Scroll so the scrub lands on this step.
                const vh = window.innerHeight;
                const want = i / last;
                const top = el.getBoundingClientRect().top + window.scrollY - (vh * 0.8 - want * vh * 0.55);
                window.scrollTo({ top, behavior: "smooth" });
              }}
              className="absolute top-0 -translate-x-1/2"
              style={{ left: `${(i / last) * 100}%` }}
            >
              <span className={`cg-road-node grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-extrabold ${on ? "is-on border-primary bg-primary text-primary-fg" : "border-line bg-surface text-muted"}`}>{i + 1}</span>
              <span className={`absolute top-12 whitespace-nowrap text-[12.5px] font-bold ${i === 0 ? "left-0" : i === steps.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2"} ${i === active ? "text-ink" : "text-muted"}`}>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
