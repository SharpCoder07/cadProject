import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { embedUrl } from "@/lib/video";
import { cn } from "@/lib/utils";
import { imageMaxWidth, sideImageWidth, type ComparisonSection } from "@/lib/comparison-sections";
import { faqLd } from "@/server/seo/jsonld";
import { JsonLd } from "./json-ld";

/** Content sections of one comparison, below its table (set up in Admin › Comparisons). */
export function ComparisonSections({ sections }: { sections: ComparisonSection[] }) {
  const visible = sections.filter((s) => !s.hidden);
  if (!visible.length) return null;
  const faqs = visible.flatMap((s) => (s.type === "FAQ" ? s.items.map((i) => ({ question: i.q, answer: i.a })) : []));
  return (
    <div className="space-y-8 rounded-[1.75rem] border border-line bg-surface p-6 sm:p-10">
      {visible.map((s) => <Section key={s.id} s={s} />)}
      {faqs.length > 0 && <JsonLd data={faqLd(faqs)} />}
    </div>
  );
}

function Heading({ text, level = "h2" }: { text: string; level?: "h2" | "h3" }) {
  if (!text) return null;
  const Tag = level;
  return (
    <div className="mb-4">
      <Tag className={level === "h2" ? "text-[1.5rem] font-bold leading-tight text-ink sm:text-[1.75rem]" : "text-xl font-bold text-ink"}>{text}</Tag>
      {level === "h2" && <span aria-hidden className="mt-2.5 block h-1 w-12 rounded-full bg-accent" />}
    </div>
  );
}

function Picture({ url, alt, caption, maxWidth, align = "center" }: { url: string; alt: string; caption?: string; maxWidth?: string | null; align?: "left" | "center" | "right" }) {
  return (
    <figure className={cn("w-full", align === "center" && "mx-auto", align === "right" && "ml-auto")} style={maxWidth ? { maxWidth } : undefined}>
      <Image src={url} alt={alt} width={1600} height={900} sizes={maxWidth?.endsWith("px") ? `(min-width: ${parseInt(maxWidth) + 64}px) ${maxWidth}, 100vw` : "(min-width: 1024px) 1100px, 100vw"} className="h-auto w-full rounded-2xl border border-line bg-bg object-contain" />
      {caption && <figcaption className="mt-2 text-center text-sm text-muted">{caption}</figcaption>}
    </figure>
  );
}


function Section({ s }: { s: ComparisonSection }) {
  switch (s.type) {
    case "HEADING":
      return (
        <section>
          <Heading text={s.heading} level={s.level} />
          {s.subtext && <p className="-mt-1 max-w-3xl text-muted">{s.subtext}</p>}
        </section>
      );
    case "TEXT":
      return (
        <section>
          <Heading text={s.heading} />
          <div className="prose-content" dangerouslySetInnerHTML={{ __html: s.html }} />
        </section>
      );
    case "IMAGE":
      return s.imageUrl ? (
        <section>
          <Heading text={s.heading} />
          <Picture url={s.imageUrl} alt={s.alt} caption={s.caption} maxWidth={imageMaxWidth(s)} align={s.align} />
        </section>
      ) : null;
    case "VIDEO": {
      const src = embedUrl(s.url);
      if (!src) return null;
      return (
        <section>
          <Heading text={s.heading} />
          <figure>
            <div className="aspect-video overflow-hidden rounded-2xl border border-line bg-ink/5">
              <iframe src={src} title={s.heading || s.caption || "Video"} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="h-full w-full" />
            </div>
            {s.caption && <figcaption className="mt-2 text-center text-sm text-muted">{s.caption}</figcaption>}
          </figure>
        </section>
      );
    }
    case "IMAGE_TEXT":
      return (
        <section>
          <Heading text={s.heading} />
          {s.imageUrl ? (
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
              <div className={cn("w-full md:w-[var(--img-w)] md:max-w-[80%] md:shrink-0", s.imageSide === "right" && "md:order-2")} style={{ ["--img-w" as string]: sideImageWidth(s) }}>
                <Picture url={s.imageUrl} alt={s.alt} />
              </div>
              <div className="prose-content min-w-0 max-w-none flex-1" dangerouslySetInnerHTML={{ __html: s.html }} />
            </div>
          ) : (
            <div className="prose-content" dangerouslySetInnerHTML={{ __html: s.html }} />
          )}
        </section>
      );
    case "FAQ":
      if (!s.items.length) return null;
      return (
        <section>
          <Heading text={s.heading || "Frequently asked questions"} />
          <div className="grid items-start gap-3 lg:grid-cols-2">
            {s.items.map((f) => (
              <details key={f.q} className="group rounded-panel border border-line bg-bg/40 px-5 py-4 open:border-primary/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-lg text-primary transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    case "CTA":
      return (
        <section className="flex flex-col items-start gap-4 rounded-2xl bg-band px-6 py-7 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            {s.heading && <h2 className="text-xl font-bold text-white">{s.heading}</h2>}
            {s.text && <p className="mt-1 max-w-2xl text-white/80">{s.text}</p>}
          </div>
          {s.buttonLabel && s.buttonUrl && (
            <Link href={s.buttonUrl} className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-accent-fg transition hover:brightness-95">
              {s.buttonLabel} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </section>
      );
  }
}
