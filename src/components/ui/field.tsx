import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const controlClass =
  "block w-full rounded-control border border-line bg-surface px-3.5 py-2 text-sm text-ink shadow-[0_1px_2px_rgb(16_24_40/0.04)] placeholder:text-muted/70 focus:border-mint focus:outline-none focus:ring-4 focus:ring-mint-soft disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlClass, "h-10", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={cn(controlClass, "min-h-[5rem]", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(controlClass, "h-10 pr-8", className)} {...props}>
      {children}
    </select>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label?: ReactNode; hint?: ReactNode }>(
  function Checkbox({ label, hint, className, id, ...props }, ref) {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <div className={cn("flex items-start gap-2.5", className)}>
        <input ref={ref} id={inputId} type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-line text-primary focus:ring-mint-soft" {...props} />
        {label && (
          <label htmlFor={inputId} className="text-sm leading-5 text-ink">
            {label}
            {hint && <span className="block text-xs text-muted">{hint}</span>}
          </label>
        )}
      </div>
    );
  },
);

export const Switch = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: ReactNode; hint?: ReactNode }>(function Switch(
  { label, hint, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer items-start justify-between gap-4", className)}>
      <span className="text-sm text-ink">
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input ref={ref} id={inputId} type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span className="h-5 w-9 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40" />
        <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
});

/** Label + control + hint + error, wired with aria attributes. */
export function Field({ label, htmlFor, hint, error, required, children, className }: { label: ReactNode; htmlFor?: string; hint?: ReactNode; error?: string | string[]; required?: boolean; children: ReactNode; className?: string }) {
  const message = Array.isArray(error) ? error[0] : error;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {message ? (
        <p className="text-xs text-danger" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>
          {message}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
