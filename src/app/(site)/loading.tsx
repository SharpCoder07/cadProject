import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="container py-8" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-4 h-4 w-96 max-w-full" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <Skeleton className="hidden h-96 lg:block" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    </div>
  );
}
