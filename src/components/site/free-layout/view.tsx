import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { embedUrl } from "@/lib/video";
import { EnquireButton } from "@/components/site/lead-dialog";
import type { LayoutColumn, LayoutRow, Widget, WidgetProps } from "@/lib/blocks/free-layout";
import { layoutCss } from "@/lib/blocks/free-layout-style";

/** How a free layout looks (shared by the website and the edit-mode editor). */

const SPAN = ["", "md:col-span-1", "md:col-span-2", "md:col-span-3", "md:col-span-4", "md:col-span-5", "md:col-span-6", "md:col-span-7", "md:col-span-8", "md:col-span-9", "md:col-span-10", "md:col-span-11", "md:col-span-12"];
const GAP = { none: "gap-0", sm: "gap-3", md: "gap-6", lg: "gap-10" } as const;
const PAD = { none: "py-0", sm: "py-4", md: "py-8", lg: "py-14" } as const;
const VALIGN = { top: "items-start", center: "items-center", bottom: "items-end" } as const;
const TEXT_ALIGN = { left: "text-left", center: "text-center", right: "text-right" } as const;
const JUSTIFY = { left: "justify-start", center: "justify-center", right: "justify-end" } as const;

export const rowClass = (r: LayoutRow) => cn("grid grid-cols-1 md:grid-cols-12", GAP[r.gap], VALIGN[r.valign]);
export const rowOuterClass = (r: LayoutRow) => cn(PAD[r.paddingY]);
export const columnClass = (c: LayoutColumn) => cn("min-w-0 space-y-4", SPAN[c.width]);

/** Pasted sections, rendered on the server (they load live data), by widget id. */
export type Slots = Record<string, React.ReactNode>;

export function WidgetView({ w, slots }: { w: Widget; slots?: Slots }) {
  switch (w.type) {
    case "section": {
      const slot = slots?.[w.id];
      const label = String(w.props.label || "section");
      return (
        // A full-width section inside a column: its inner page-width box fills the column instead.
        <div data-fl-section="" className="[&_.container]:max-w-none [&_.container]:px-0">
          {slot ?? (
            <div className="flex h-28 items-center justify-center gap-2 rounded-panel border border-dashed border-line bg-bg text-sm text-muted">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted border-t-transparent" aria-hidden /> Loading “{label}”…
            </div>
          )}
        </div>
      );
    }
    case "heading": {
      const p = w.props as WidgetProps<"heading">;
      const Tag = p.level;
      const size = p.level === "h2" ? "text-2xl sm:text-3xl" : p.level === "h3" ? "text-xl sm:text-2xl" : "text-lg";
      const text = p.link ? <Link href={p.link} className="hover:text-primary">{p.text}</Link> : p.text;
      return <Tag className={cn("font-display font-extrabold leading-tight tracking-tight text-ink", size, TEXT_ALIGN[p.align])}>{text}</Tag>;
    }
    case "text": {
      const p = w.props as WidgetProps<"text">;
      // Formatted text is cleaned on save (server/sanitize).
      return <div className={cn("prose-content max-w-none text-[15px] leading-relaxed text-ink", TEXT_ALIGN[p.align])} dangerouslySetInnerHTML={{ __html: p.html }} />;
    }
    case "image": {
      const p = w.props as WidgetProps<"image">;
      if (!p.src) return <div className="grid h-40 place-items-center rounded-panel border border-dashed border-line bg-bg text-sm text-muted">Image — pick one in its settings</div>;
      // eslint-disable-next-line @next/next/no-img-element -- any uploaded or linked image
      const img = <img src={p.src} alt={p.alt} loading="lazy" className={cn("h-auto max-w-full", p.rounded && "rounded-panel")} style={{ width: `${p.width}%` }} />;
      return <div className={cn("flex", JUSTIFY[p.align])}>{p.link ? <Link href={p.link}>{img}</Link> : img}</div>;
    }
    case "button": {
      const p = w.props as WidgetProps<"button">;
      const cls = cn(
        "inline-flex h-11 items-center justify-center gap-1.5 rounded-control px-5 text-sm font-bold transition",
        p.style === "accent" ? "bg-accent text-accent-fg hover:brightness-95" : p.style === "primary" ? "bg-primary text-primary-fg hover:bg-primary/90" : "border border-primary text-primary hover:bg-primary-soft",
        p.fullWidth && "w-full",
      );
      const btn = p.action === "enquire"
        ? <EnquireButton type="QUOTE" source="GET_ADVICE" className={cls}>{p.label}</EnquireButton>
        : <Link href={p.href || "#"} target={p.newTab ? "_blank" : undefined} rel={p.newTab ? "noopener" : undefined} className={cls}>{p.label}</Link>;
      return <div className={cn("flex", JUSTIFY[p.align])}>{btn}</div>;
    }
    case "list": {
      const p = w.props as WidgetProps<"list">;
      const Ord = p.icon === "number" ? "ol" : "ul";
      return (
        <Ord className="space-y-2 text-[15px] text-ink">
          {p.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary-soft text-[11px] font-bold text-primary" aria-hidden>
                {p.icon === "check" ? <Check className="h-3.5 w-3.5" /> : p.icon === "arrow" ? <ArrowRight className="h-3.5 w-3.5" /> : p.icon === "number" ? i + 1 : <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </span>
              <span>{it.text}</span>
            </li>
          ))}
        </Ord>
      );
    }
    case "iconBox": {
      const p = w.props as WidgetProps<"iconBox">;
      return (
        <div className={cn("flex flex-col gap-2 rounded-panel border border-line bg-surface p-5", p.align === "center" ? "items-center text-center" : p.align === "right" ? "items-end text-right" : "items-start")}>
          <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary"><Icon name={p.icon} className="h-5 w-5" /></span>
          <p className="font-display text-base font-bold text-ink">{p.title}</p>
          {p.text && <p className="text-sm leading-relaxed text-muted">{p.text}</p>}
        </div>
      );
    }
    case "spacer":
      return <div aria-hidden style={{ height: (w.props as WidgetProps<"spacer">).size }} />;
    case "divider": {
      const p = w.props as WidgetProps<"divider">;
      return <hr className="mx-auto border-0 bg-line" style={{ width: `${p.width}%`, height: p.thickness }} />;
    }
    case "video": {
      const p = w.props as WidgetProps<"video">;
      const src = p.url ? embedUrl(p.url) : null;
      if (!src) return <div className="grid aspect-video place-items-center rounded-panel border border-dashed border-line bg-bg text-sm text-muted">Video — paste a YouTube or Vimeo link in its settings</div>;
      return <iframe src={src} title={p.title} className="aspect-video w-full rounded-panel border-0" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen />;
    }
    default:
      return null;
  }
}

/** A widget with its own Style / Advanced settings (CSS from layoutCss, by data-fw). */
export function WidgetBox({ w, slots }: { w: Widget; slots?: Slots }) {
  return (
    <div data-fw={w.id} id={w.adv?.anchor || undefined} className={w.adv?.cssClass || undefined}>
      <WidgetView w={w} slots={slots} />
    </div>
  );
}

/** The CSS of a layout's styled widgets and rows (empty when nothing is styled). */
export function LayoutStyle({ rows, editing }: { rows: LayoutRow[]; editing?: boolean }) {
  const css = layoutCss(rows, { editing });
  // Built only from checked values (numbers, colours, font names, image paths) and escaped.
  return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
}

export function RowShell({ r, children }: { r: LayoutRow; children: React.ReactNode }) {
  return (
    <div data-fr={r.id} id={r.adv?.anchor || undefined} className={cn(rowOuterClass(r), r.adv?.cssClass)} style={r.background ? { backgroundColor: r.background } : undefined}>
      <div className={cn(r.contained && "container")}>{children}</div>
    </div>
  );
}

/** The website view. */
export function FreeLayoutView({ rows, slots }: { rows: LayoutRow[]; slots?: Slots }) {
  return (
    <section>
      <LayoutStyle rows={rows} />
      {rows.map((r) => (
        <RowShell key={r.id} r={r}>
          <div className={rowClass(r)}>
            {r.columns.map((c) => (
              <div key={c.id} className={columnClass(c)}>
                {c.widgets.map((w) => <WidgetBox key={w.id} w={w} slots={slots} />)}
              </div>
            ))}
          </div>
        </RowShell>
      ))}
    </section>
  );
}
