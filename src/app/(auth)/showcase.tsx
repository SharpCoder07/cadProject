"use client";

import { useEffect, useState } from "react";
import { Calculator, ChartPie, Cloud, CreditCard, Database, FileText, Laptop, Lock, MessageCircle, Receipt, ShoppingCart, Store, Users } from "lucide-react";

/** Sign-in pages, left panel background: a faint pattern of software icons that drifts slowly (still for reduced motion). */
const DOODLES = [Laptop, Cloud, Receipt, Calculator, ChartPie, Database, ShoppingCart, Users, Lock, CreditCard, Store, FileText, MessageCircle];

export function AuthDoodles() {
  return (
    <div aria-hidden className="cg-auth-doodles pointer-events-none absolute -inset-16 grid grid-cols-9 content-start gap-x-10 gap-y-9 p-6 text-white/[0.07]">
      {Array.from({ length: 108 }, (_, i) => {
        const I = DOODLES[(i * 7 + (i >> 3)) % DOODLES.length]!;
        return <I key={i} className="h-6 w-6 justify-self-center" style={{ rotate: `${((i * 13) % 5 - 2) * 9}deg` }} />;
      })}
    </div>
  );
}

/** Figures that count up once on load ("30+", "1.2k+"…); still for reduced motion. */
export function CountUp({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const m = value.match(/^([\d.]+)(.*)$/);
    if (!m || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = parseFloat(m[1]!);
    const dec = (m[1]!.split(".")[1] ?? "").length;
    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      start ||= now;
      const k = Math.min(1, (now - start) / 1400);
      setShown(`${(target * (1 - Math.pow(1 - k, 3))).toFixed(dec)}${m[2]}`);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    const t = setTimeout(() => (raf = requestAnimationFrame(step)), 700);
    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return <>{shown}</>;
}
