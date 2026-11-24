import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { PublishStatus } from "@prisma/client";
import { Badge, type BadgeTone } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";
import { PANEL } from "./list-panel";

export function PageHeader({ title, description, actions, back, size = "sm" }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; /** Size of the back button. */ size?: "sm" | "md" }) {
  return (
    <div className="mb-5">
      {/* Buttons stay on the heading's row (right-hand end) on wider screens, however long the description. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[1.375rem] font-bold leading-tight tracking-[-0.015em] sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p>}
        </div>
        {(back || actions) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {/* The way back sits with the page's buttons, first in the row. */}
            {back && (
              <Link href={back.href} className={buttonClass("secondary", size)}>
                <ChevronLeft className="h-4 w-4" aria-hidden /> {back.label}
              </Link>
            )}
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS: Record<PublishStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  IN_REVIEW: { label: "In review", tone: "warning" },
  PUBLISHED: { label: "Published", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "danger" },
};

export function StatusBadge({ status, scheduledAt }: { status: PublishStatus; scheduledAt?: Date | null }) {
  if (scheduledAt && status !== "PUBLISHED") return <Badge tone="primary">Scheduled</Badge>;
  const s = STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

/**
 * Table that scrolls sideways when the screen is narrower than `minWidth` (in rem), so columns never
 * get squeezed. `bare` drops the card so it can sit inside a ListPanel.
 */
export function AdminTable({ children, minWidth = 48, bare }: { children: ReactNode; minWidth?: number; bare?: boolean }) {
  return (
    <div className={cn("overflow-x-auto overscroll-x-contain [scrollbar-width:thin]", !bare && PANEL)}>
      <table
        style={{ minWidth: `${minWidth}rem` }}
        className="w-full text-left text-sm [&_thead_tr]:border-b [&_thead_tr]:border-line [&_thead_tr]:bg-bg/60 [&_th]:whitespace-nowrap [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.05em] [&_th]:text-muted sm:[&_th]:px-5 [&_td]:px-4 [&_td]:py-3 sm:[&_td]:px-5 [&_tbody]:divide-y [&_tbody]:divide-line [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-bg/60"
      >
        {children}
      </table>
    </div>
  );
}

/** GET filter bar. Inputs are plain form controls so filters live in the URL. */
export { FilterBar } from "./filter-bar";
