"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Ban, Info, RotateCcw, Trash2, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBinDays, useDeleteNotAllowed, useIsSuperAdmin } from "./delete-rights";
import { NO_DELETE_MESSAGE, RECYCLE_BIN_CONFIRM } from "@/lib/delete-permission";

/** Accessible modal built on the native <dialog> element (focus trap, Esc, backdrop). */
export function Dialog({ open, onClose, title, description, children, size = "md", className }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; size?: "sm" | "confirm" | "md" | "lg" | "xl"; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const width = { sm: "max-w-sm", confirm: "max-w-[28rem]", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <dialog
      ref={ref}
      // React passes a nested dialog's "close" event up to its parent dialogs (the media library
      // opened from a form dialog, for example), so only react when THIS dialog closed.
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) e.stopPropagation();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      // Reset text styles a dialog would otherwise inherit from where it is rendered (e.g. a nowrap table cell).
      className={cn("w-[calc(100%-2rem)] whitespace-normal break-words rounded-panel border border-line bg-surface p-0 text-left align-baseline text-base font-normal normal-case tracking-normal text-ink shadow-xl backdrop:bg-black/50", width, className)}
      aria-labelledby="dialog-title"
    >
      {open && (
        <div className="max-h-[85vh] overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
            <div>
              <h2 id="dialog-title" className="font-sans text-lg font-semibold">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-control p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Super Admin's delete confirmation: their deletions go to the recycle bin too (src/server/system/trash.ts). */
export const recycleBinNote = (days: number) => `This item will be moved to the Recycle Bin. You can restore it from System › Recycle bin within ${days} days.`;

/**
 * Confirmation dialog for destructive or important actions: an icon, the question, what will happen,
 * and — for deletes that go to the recycle bin (`recycleBin`) — a note that it can be restored.
 */
export function ConfirmDialog({ open, onClose, onConfirm, title, children, confirmLabel, tone = "danger", busy, recycleBin, deletePermission }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; children?: ReactNode; confirmLabel: string; tone?: "danger" | "primary"; busy?: boolean; recycleBin?: boolean; /** Delete permission this needs, when it isn't the one of the page it's on. */ deletePermission?: string }) {
  // A role without Delete here can't delete: say so and offer no Delete button (the server refuses it too).
  const notAllowed = useDeleteNotAllowed(deletePermission) && Boolean(recycleBin);
  const superAdmin = useIsSuperAdmin();
  const binDays = useBinDays();
  const Icon = notAllowed ? Ban : tone === "danger" ? (recycleBin ? Trash2 : TriangleAlert) : Info;
  return (
    <Dialog open={open} onClose={onClose} title={title} size="confirm">
      <div className="flex gap-3.5">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", tone === "danger" ? "bg-danger/10 text-danger" : "bg-mint-soft text-mint-ink")} aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1 space-y-3 pt-0.5 text-sm leading-relaxed text-muted">
          {children && <div>{children}</div>}
          {notAllowed ? (
            <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-[13px] font-medium text-ink">
              <Ban className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              <span>{NO_DELETE_MESSAGE}</span>
            </p>
          ) : recycleBin && (
            <p className="flex items-start gap-2 rounded-xl border border-mint/60 bg-mint-soft px-3 py-2.5 text-[13px] text-ink">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-mint-ink" aria-hidden />
              <span>{superAdmin ? recycleBinNote(binDays) : RECYCLE_BIN_CONFIRM}</span>
            </p>
          )}
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={onClose} disabled={busy} className="h-8 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-bg disabled:opacity-50">
          {notAllowed ? "Close" : "Cancel"}
        </button>
        {!notAllowed && <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn("h-8 rounded-control px-3 text-sm font-semibold text-white disabled:opacity-50", tone === "danger" ? "bg-danger hover:bg-danger/90" : "bg-primary hover:bg-primary/90")}
        >
          {busy ? "Working…" : confirmLabel}
        </button>}
      </div>
    </Dialog>
  );
}

type ConfirmOptions = { title: string; message?: ReactNode; confirmLabel?: string; tone?: "danger" | "primary"; recycleBin?: boolean; deletePermission?: string };

/**
 * Promise-based confirm, in place of window.confirm: `const [confirm, confirmDialog] = useConfirm();`
 * render `{confirmDialog}`, then `if (await confirm({ title: "Delete this?", recycleBin: true })) …`.
 */
export function useConfirm(): [(o: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [state, setState] = useState<{ o: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);
  const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ o, resolve })), []);
  const done = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const el = (
    <ConfirmDialog open={state !== null} onClose={() => done(false)} onConfirm={() => done(true)} title={state?.o.title ?? ""} confirmLabel={state?.o.confirmLabel ?? "Delete"} tone={state?.o.tone ?? "danger"} recycleBin={state?.o.recycleBin} deletePermission={state?.o.deletePermission}>
      {state?.o.message}
    </ConfirmDialog>
  );
  return [ask, el];
}

type PromptOptions = {
  title: string;
  message?: ReactNode;
  /** Label above the box. */
  label?: string;
  initial?: string;
  placeholder?: string;
  /** Small help under the box. */
  hint?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  multiline?: boolean;
  /** Return an error message to keep the popup open, or null when the value is fine. */
  validate?: (value: string) => string | null;
  /** Quick choices shown as chips; clicking one fills the box. */
  suggestions?: string[];
};

/**
 * Promise-based text popup, in place of window.prompt: `const [ask, promptDialog] = usePrompt();`
 * render `{promptDialog}`, then `const v = await ask({ title: "Link", validate })` (null = cancelled).
 * Not a <form>, so it is safe inside other forms.
 */
export function usePrompt(): [(o: PromptOptions) => Promise<string | null>, ReactNode] {
  const [state, setState] = useState<{ o: PromptOptions; resolve: (v: string | null) => void } | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ask = useCallback(
    (o: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        setValue(o.initial ?? "");
        setError(null);
        setState({ o, resolve });
      }),
    [],
  );
  const finish = (v: string | null) => {
    state?.resolve(v);
    setState(null);
  };
  const submit = () => {
    const err = state?.o.validate?.(value) ?? null;
    if (err) return setError(err);
    finish(value);
  };
  const o = state?.o;
  const field = "w-full rounded-control border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint-soft";
  const el = (
    <Dialog open={state !== null} onClose={() => finish(null)} title={o?.title ?? ""} size="confirm">
      <div className="space-y-3 text-sm">
        {o?.message && <div className="leading-relaxed text-muted">{o.message}</div>}
        <label className="block space-y-1.5">
          {o?.label && <span className="block font-medium text-ink">{o.label}</span>}
          {o?.multiline ? (
            <textarea
              autoFocus
              rows={3}
              value={value}
              placeholder={o?.placeholder}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
              aria-invalid={Boolean(error)}
              className={cn(field, "py-2")}
            />
          ) : (
            <input
              autoFocus
              value={value}
              placeholder={o?.placeholder}
              onChange={(e) => { setValue(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              aria-invalid={Boolean(error)}
              className={cn(field, "h-9")}
            />
          )}
        </label>
        {o?.suggestions && o.suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {o.suggestions.map((sug) => (
              <button key={sug} type="button" onClick={() => { setValue(sug); setError(null); }} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", value === sug ? "border-primary bg-primary/10 text-primary" : "border-line text-muted hover:border-ink/30 hover:text-ink")}>
                {sug}
              </button>
            ))}
          </div>
        )}
        {error ? <p className="text-xs font-medium text-danger" role="alert">{error}</p> : o?.hint ? <p className="text-xs text-muted">{o.hint}</p> : null}
      </div>
      <div className="mt-5 flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={() => finish(null)} className="h-8 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-bg">Cancel</button>
        <button type="button" onClick={submit} className={cn("h-8 rounded-control px-3 text-sm font-semibold text-white", o?.tone === "danger" ? "bg-danger hover:bg-danger/90" : "bg-primary hover:bg-primary/90")}>
          {o?.confirmLabel ?? "OK"}
        </button>
      </div>
    </Dialog>
  );
  return [ask, el];
}
