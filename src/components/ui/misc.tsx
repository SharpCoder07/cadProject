import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Star, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const badgeTones = {
  neutral: "bg-ink/[0.06] text-ink/80",
  primary: "bg-mint-soft text-mint-ink",
  accent: "bg-accent/15 text-[#B45309] dark:text-amber-300",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
} as const;
export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5", badgeTones[tone], className)}>{children}</span>;
}

export function Panel({ children, className, as: As = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" | "aside" }) {
  return <As className={cn("rounded-[20px] border border-line/80 bg-surface shadow-[0_1px_2px_rgb(var(--color-ink)/0.04),0_12px_32px_-24px_rgb(var(--color-ink)/0.25)]", className)}>{children}</As>;
}

export function PanelHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
      <div>
        <h2 className="font-sans text-[15px] font-bold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

const alertTones = {
  info: { cls: "border-mint/60 bg-mint-soft text-ink", Icon: Info },
  success: { cls: "border-success/30 bg-success/10 text-ink", Icon: CheckCircle2 },
  warning: { cls: "border-warning/30 bg-warning/10 text-ink", Icon: TriangleAlert },
  danger: { cls: "border-danger/30 bg-danger/10 text-ink", Icon: AlertCircle },
} as const;

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof alertTones; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, Icon } = alertTones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-panel border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5 text-muted")}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stars({ value, size = "sm", className }: { value: number; size?: "sm" | "md"; className?: string }) {
  const px = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <span className={cn("inline-flex items-center", className)} role="img" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - (i - 1)));
        return (
          <span key={i} className={cn("relative", px)}>
            <Star className={cn("absolute inset-0 text-line", px)} fill="currentColor" strokeWidth={0} aria-hidden />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn("text-accent", px)} fill="currentColor" strokeWidth={0} aria-hidden />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} role="status" aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-control bg-ink/5", className)} aria-hidden />;
}
