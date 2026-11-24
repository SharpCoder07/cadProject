"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertCircle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  message: string;
  leaving?: boolean;
}

const DEFAULT_TITLE: Record<Tone, string> = { success: "Done", error: "Couldn't complete that", info: "Heads up" };
const DURATION: Record<Tone, number> = { success: 4000, error: 8000, info: 6000 };

const STYLE: Record<Tone, { badge: string; bar: string; Icon: typeof Check }> = {
  success: { badge: "bg-mint-soft text-mint-ink ring-mint/60", bar: "bg-mint", Icon: Check },
  error: { badge: "bg-danger/10 text-danger ring-danger/25", bar: "bg-danger/70", Icon: AlertCircle },
  info: { badge: "bg-ink/5 text-ink ring-line", bar: "bg-ink/30", Icon: Info },
};

const ToastContext = createContext<{ notify: (tone: Tone, message: string, title?: string) => void } | null>(null);

/**
 * Toasts: a white card at the top right with an icon badge, a title and the message, and a thin bar
 * that counts down until it closes. Hovering pauses the countdown (the bar's animation is the timer).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const dismiss = useCallback(
    (id: number) => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
      setTimeout(() => remove(id), 180);
    },
    [remove],
  );
  const notify = useCallback((tone: Tone, message: string, title?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.filter((x) => !(x.message === message && x.tone === tone)).slice(-3), { id, tone, message, title: title ?? DEFAULT_TITLE[tone] }]);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <style>{`
        @keyframes cg-toast-in { from { opacity: 0; transform: translateX(24px) scale(.98) } to { opacity: 1; transform: none } }
        @keyframes cg-toast-out { to { opacity: 0; transform: translateX(24px) scale(.98) } }
        @keyframes cg-toast-bar { from { transform: scaleX(1) } to { transform: scaleX(0) } }
        .cg-toast:hover .cg-toast-bar { animation-play-state: paused }
        @media (prefers-reduced-motion: reduce) { .cg-toast { animation: none !important } }
      `}</style>
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-[min(24rem,calc(100%-2rem))] flex-col gap-2.5" aria-live="polite">
        {toasts.map((t) => {
          const s = STYLE[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="cg-toast pointer-events-auto relative overflow-hidden rounded-panel bg-surface shadow-[0_12px_32px_-8px_rgba(15,23,42,0.22),0_2px_6px_rgba(15,23,42,0.06)] ring-1 ring-line"
              style={{ animation: t.leaving ? "cg-toast-out 180ms ease-in forwards" : "cg-toast-in 260ms cubic-bezier(.2,.9,.3,1.2)" }}
            >
              <div className="flex items-start gap-3 py-3.5 pl-3.5 pr-3">
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1", s.badge)}>
                  <s.Icon className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-semibold leading-5 text-ink">{t.title}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-muted">{t.message}</p>
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-ink/5 hover:text-ink">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div
                className={cn("cg-toast-bar absolute inset-x-0 bottom-0 h-[3px] origin-left", s.bar)}
                style={{ animation: `cg-toast-bar ${DURATION[t.tone]}ms linear forwards` }}
                onAnimationEnd={() => dismiss(t.id)}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
