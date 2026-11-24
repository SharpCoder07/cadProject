import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "./json-ld";
import { breadcrumbLd } from "@/server/seo/jsonld";

export function Breadcrumbs({ items, light }: { items: { name: string; path: string }[]; /** White text with "/" separators, for dark heroes. */ light?: boolean }) {
  const all = [{ name: "Home", path: "/" }, ...items];
  return (
    <>
      <JsonLd data={breadcrumbLd(all)} />
      <nav aria-label="Breadcrumb" className={light ? "text-[13px] font-medium text-white/80" : "text-sm text-muted"}>
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((it, i) => (
            <li key={it.path} className="flex items-center gap-1">
              {i > 0 && (light ? <span aria-hidden className="px-1 text-white/60">/</span> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />)}
              {i === all.length - 1 ? (
                <span aria-current="page" className={light ? "text-white" : "text-ink"}>{it.name}</span>
              ) : (
                <Link href={it.path} className={light ? "hover:text-white" : "hover:text-primary"}>{it.name}</Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
