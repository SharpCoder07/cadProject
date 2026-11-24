import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export interface ComparisonCardData {
  slug: string;
  title: string;
  items: { software: { name: string; logo: { url: string } | null } }[];
}

/** Card for a published comparison ("Popular comparisons" on /compare and the homepage block). */
export function ComparisonCard({ c, cta = "Compare" }: { c: ComparisonCardData; cta?: string }) {
  const shown = c.items.slice(0, 3);
  return (
    <Link href={`/compare/${c.slug}`} className="card-lift group flex h-full items-center gap-4 rounded-panel border border-line bg-surface p-4">
      <span className="flex shrink-0 -space-x-3" aria-hidden>
        {shown.map((it, i) =>
          it.software.logo ? (
            <Image key={i} src={it.software.logo.url} alt="" width={44} height={44} className="relative h-11 w-11 rounded-full bg-surface object-contain shadow-sm ring-2 ring-surface" style={{ zIndex: shown.length - i }} />
          ) : (
            <span key={i} className="relative grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary ring-2 ring-surface" style={{ zIndex: shown.length - i }}>
              {it.software.name.slice(0, 1)}
            </span>
          ),
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{c.title}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary">
          {cta} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
        </span>
      </span>
    </Link>
  );
}
