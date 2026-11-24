import { Skeleton } from "@/components/ui/misc";

/** Shown inside the admin / vendor / account shell the moment a sidebar link is clicked, while the page loads. */
export function PanelLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <Skeleton className="mt-6 h-14" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
