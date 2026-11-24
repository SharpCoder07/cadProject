"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Circle, ListChecks, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASSWORD_MIN, PASSWORD_RULES, checkPassword, passwordStrength, type PasswordContext } from "@/lib/password-rules";

const LABEL = ["", "Too weak", "Almost there", "Strong", "Very strong"] as const;

/**
 * Live password rule checklist with a strength bar (the server checks the same rule).
 * `compact` (sign-up page): one short line until a password is being typed that doesn't meet every rule yet;
 * then the full list opens, and it closes again once all rules are met.
 */
export function PasswordChecklist({ password, email, name, className, compact }: PasswordContext & { password: string; className?: string; compact?: boolean }) {
  const ok = checkPassword(password, { email, name });
  const strength = passwordStrength(password, { email, name });
  const allMet = Boolean(password) && Object.values(ok).every(Boolean);
  if (compact && (!password || allMet)) {
    return (
      <div className={cn("relative flex items-center gap-2 rounded-control border border-line bg-bg/50 px-3 py-2 text-xs", className)} aria-live="polite">
        <span className="flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1.5 w-5 rounded-full", i <= strength ? "bg-success" : "bg-line")} />
          ))}
        </span>
        {allMet ? (
          <span className="flex items-center gap-1 font-medium text-success"><Check className="h-3.5 w-3.5" aria-hidden />{LABEL[strength]}: all rules met</span>
        ) : (
          <span className="text-muted">{PASSWORD_MIN}+ characters with upper and lower case, a number and a symbol</span>
        )}
        <RulesPopup password={password} ok={ok} />
      </div>
    );
  }
  return (
    <div className={cn("rounded-control border border-line bg-bg/50 px-3 py-2.5 text-xs", className)} aria-live="polite">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex gap-1" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <span key={i} className={cn("h-1.5 w-7 rounded-full", i <= strength ? (strength <= 1 ? "bg-danger" : strength === 2 ? "bg-warning" : "bg-success") : "bg-line")} />
          ))}
        </span>
        <span className={cn("font-medium", strength <= 1 ? "text-danger" : strength === 2 ? "text-warning" : "text-success")}>{password ? LABEL[strength] : "Your password must have:"}</span>
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {PASSWORD_RULES.map((r) => {
          const met = Boolean(password) && ok[r.id];
          return (
            <li key={r.id} className={cn("flex items-start gap-1.5", met ? "text-success" : "text-muted")}>
              {met ? <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> : <Circle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
              <span>{r.label}<span className="sr-only">{met ? " (done)" : " (not yet)"}</span></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "All rules" badge on the compact line: opens a small popup with every rule and its live state (Esc or a click outside closes it). */
function RulesPopup({ password, ok }: { password: string; ok: Record<string, boolean> }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={box} className="ml-auto shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary hover:text-primary-fg"
      >
        <ListChecks className="h-3.5 w-3.5" aria-hidden /> All rules
      </button>
      {open && (
        <div role="dialog" aria-label="Password rules" className="absolute bottom-full right-0 z-30 mb-2 w-[min(22rem,90vw)] rounded-panel border border-line bg-surface p-4 text-left shadow-[0_24px_60px_-24px_rgb(var(--color-ink)/0.45)]">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-sm font-bold text-ink">Your password must have</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 text-muted hover:bg-bg hover:text-ink"><X className="h-4 w-4" /></button>
          </div>
          <ul className="space-y-1.5 text-xs">
            {PASSWORD_RULES.map((r) => {
              const met = Boolean(password) && ok[r.id];
              return (
                <li key={r.id} className={cn("flex items-start gap-2", met ? "text-success" : "text-muted")}>
                  {met ? <Check className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden /> : <Circle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />}
                  <span>{r.label}<span className="sr-only">{met ? " (done)" : " (not yet)"}</span></span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** All rules met? (for enabling the save button) */
export const passwordOk = (password: string, ctx: PasswordContext = {}) => Object.values(checkPassword(password, ctx)).every(Boolean);
