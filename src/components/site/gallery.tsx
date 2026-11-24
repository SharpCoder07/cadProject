"use client";

import Image from "next/image";
import { useState } from "react";
import { ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { embedUrl } from "@/lib/video";
import { cn } from "@/lib/utils";
import { useT } from "@/components/site/texts";

interface Img {
  url: string;
  alt: string;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
}

export function Gallery({ images, videos, className }: { images: Img[]; videos: { url: string; caption?: string | null }[]; className?: string }) {
  const tx = useT();
  const [index, setIndex] = useState<number | null>(null);
  const current = index !== null ? images[index] : undefined;
  const step = (d: number) => setIndex((i) => (i === null ? i : (i + d + images.length) % images.length));
  return (
    <div className={className}>
      {videos.map((v) => {
        const src = embedUrl(v.url);
        return src ? (
          <figure key={v.url} className="mb-4">
            <div className="aspect-video overflow-hidden rounded-panel border border-line bg-ink/5">
              <iframe src={src} title={v.caption ?? tx("site.productVideo")} className="h-full w-full" loading="lazy" allow="encrypted-media; picture-in-picture" allowFullScreen />
            </div>
            {v.caption && <figcaption className="mt-1.5 text-sm text-muted">{v.caption}</figcaption>}
          </figure>
        ) : (
          <a key={v.url} href={v.url} target="_blank" rel="noopener nofollow" className="mb-4 inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <PlayCircle className="h-4 w-4" aria-hidden /> {v.caption ?? tx("site.watchVideo")}
          </a>
        );
      })}
      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {images.map((img, i) => (
            <li key={img.url}>
              <button type="button" onClick={() => setIndex(i)} className="group block w-full overflow-hidden rounded-panel border border-line bg-surface text-left">
                <span className="relative block aspect-[16/10]">
                  <Image src={img.url} alt={img.alt} fill className="object-cover object-top transition group-hover:scale-[1.02]" sizes="(min-width: 768px) 30vw, 50vw" />
                </span>
                {img.caption && <span className="block truncate px-3 py-2 text-xs text-muted">{img.caption}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={current !== undefined} onClose={() => setIndex(null)} title={current?.caption ?? current?.alt ?? tx("site.screenshot")} size="xl">
        {current && (
          <div className="relative">
            <Image src={current.url} alt={current.alt} width={current.width ?? 1600} height={current.height ?? 1000} className="h-auto w-full rounded-control" sizes="90vw" />
            {images.length > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <button type="button" onClick={() => step(-1)} className={cn("inline-flex items-center gap-1 rounded-control px-3 py-1.5 text-sm hover:bg-ink/5")}>
                  <ChevronLeft className="h-4 w-4" aria-hidden /> {tx("site.previous")}
                </button>
                <span className="text-sm text-muted">
                  {tx("site.ofCount", { n: (index ?? 0) + 1, total: images.length })}
                </span>
                <button type="button" onClick={() => step(1)} className="inline-flex items-center gap-1 rounded-control px-3 py-1.5 text-sm hover:bg-ink/5">
                  {tx("site.next")} <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
