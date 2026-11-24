"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { embedUrl } from "@/lib/video";
import { SECTION_META, SECTION_TYPES, SIZE_UNITS, UNIT_INFO, convertSize, emptySection, type ComparisonSection, type ComparisonSectionType, type SizeUnit } from "@/lib/comparison-sections";
import { MediaField } from "./media-picker";
import { RichTextEditor } from "./rich-text";

type Patch = Partial<ComparisonSection>;

/** Admin › Comparisons: builds the content shown below the comparison table. */
export function ComparisonSectionsEditor({ value, onChange }: { value: ComparisonSection[]; onChange: (next: ComparisonSection[]) => void }) {
  const [adding, setAdding] = useState(false);
  const list = value ?? [];
  const update = (i: number, patch: Patch) => onChange(list.map((s, n) => (n === i ? ({ ...s, ...patch } as ComparisonSection) : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const add = (type: ComparisonSectionType) => {
    onChange([...list, emptySection(type)]);
    setAdding(false);
  };

  return (
    <div className="space-y-3">
      {list.length === 0 && <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No sections yet. Add headings, text, images, videos, FAQs or a call to action — they appear below the comparison table, in this order.</p>}
      {list.map((s, i) => (
        <div key={s.id} className={cn("rounded-xl border border-line bg-surface", s.hidden && "opacity-60")}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <span className="grid h-6 min-w-6 place-items-center rounded-md bg-bg px-1.5 text-xs font-bold text-muted">{i + 1}</span>
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
              {SECTION_META[s.type].label}
              {"heading" in s && s.heading ? <span className="font-normal text-muted"> · {s.heading}</span> : null}
            </p>
            <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></IconBtn>
            <IconBtn label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></IconBtn>
            <IconBtn label={s.hidden ? "Show on the website" : "Hide from the website"} onClick={() => update(i, { hidden: !s.hidden })}>{s.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</IconBtn>
            <IconBtn label="Remove section" danger onClick={() => onChange(list.filter((_, n) => n !== i))}><Trash2 className="h-4 w-4" /></IconBtn>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-2">
            <SectionFields section={s} onPatch={(p) => update(i, p)} />
          </div>
        </div>
      ))}
      {adding ? (
        <div className="rounded-xl border border-line bg-bg p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Add a section</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {SECTION_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => add(t)} className="rounded-lg border border-line bg-surface px-3 py-2 text-left hover:border-primary/40 hover:bg-primary/5">
                <span className="block text-sm font-semibold text-ink">{SECTION_META[t].label}</span>
                <span className="block text-xs text-muted">{SECTION_META[t].description}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex justify-end"><Button size="sm" variant="secondary" onClick={() => setAdding(false)}>Cancel</Button></div>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)} disabled={list.length >= 30}>
          <Plus className="h-4 w-4" aria-hidden /> Add section
        </Button>
      )}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={cn("grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-bg hover:text-ink disabled:opacity-30", danger && "hover:text-danger")}>
      {children}
    </button>
  );
}

function SectionFields({ section: s, onPatch }: { section: ComparisonSection; onPatch: (p: Patch) => void }) {
  const heading = (label = "Heading", hint?: string) => (
    <Field label={label} hint={hint} className="sm:col-span-2">
      <Input value={"heading" in s ? s.heading : ""} onChange={(e) => onPatch({ heading: e.target.value } as Patch)} />
    </Field>
  );
  switch (s.type) {
    case "HEADING":
      return (
        <>
          <Field label="Heading" className="sm:col-span-2"><Input value={s.heading} onChange={(e) => onPatch({ heading: e.target.value } as Patch)} /></Field>
          <Field label="Size">
            <Select value={s.level} onChange={(e) => onPatch({ level: e.target.value as "h2" | "h3" } as Patch)}>
              <option value="h2">Section heading (H2)</option>
              <option value="h3">Sub-heading (H3)</option>
            </Select>
          </Field>
          <Field label="Line of text (optional)"><Input value={s.subtext} onChange={(e) => onPatch({ subtext: e.target.value } as Patch)} /></Field>
        </>
      );
    case "TEXT":
      return (
        <>
          {heading("Heading (optional)")}
          <Field label="Text" className="sm:col-span-2"><RichTextEditor value={s.html} onChange={(html) => onPatch({ html } as Patch)} /></Field>
        </>
      );
    case "IMAGE":
      return (
        <>
          {heading("Heading (optional)")}
          <Field label="Image"><MediaField value={s.imageId} preview={s.imageUrl} onChange={(mid, item) => onPatch({ imageId: mid, imageUrl: item?.url ?? null } as Patch)} /></Field>
          <Field label="Alt text" hint="Describes the picture for screen readers and Google."><Input value={s.alt} onChange={(e) => onPatch({ alt: e.target.value } as Patch)} /></Field>
          <SizeControl size={s.size} unit={s.unit} hint="of the content width" onPatch={onPatch} />
          {!(s.unit === "%" && (s.size ?? 0) >= 100) && (
            <Field label="Position">
              <Select value={s.align} onChange={(e) => onPatch({ align: e.target.value as "left" | "center" | "right" } as Patch)}>
                <option value="left">Left</option>
                <option value="center">Centre</option>
                <option value="right">Right</option>
              </Select>
            </Field>
          )}
          <Field label="Caption (optional)" className="sm:col-span-2"><Input value={s.caption} onChange={(e) => onPatch({ caption: e.target.value } as Patch)} /></Field>
        </>
      );
    case "VIDEO": {
      const ok = !s.url || embedUrl(s.url);
      return (
        <>
          {heading("Heading (optional)")}
          <Field label="YouTube or Vimeo link" error={ok ? undefined : "Use a YouTube or Vimeo link"} className="sm:col-span-2">
            <Input value={s.url} placeholder="https://www.youtube.com/watch?v=…" onChange={(e) => onPatch({ url: e.target.value } as Patch)} />
          </Field>
          <Field label="Caption (optional)" className="sm:col-span-2"><Input value={s.caption} onChange={(e) => onPatch({ caption: e.target.value } as Patch)} /></Field>
        </>
      );
    }
    case "IMAGE_TEXT":
      return (
        <>
          {heading("Heading (optional)")}
          <Field label="Image"><MediaField value={s.imageId} preview={s.imageUrl} onChange={(mid, item) => onPatch({ imageId: mid, imageUrl: item?.url ?? null } as Patch)} /></Field>
          <div className="grid gap-3">
            <Field label="Alt text"><Input value={s.alt} onChange={(e) => onPatch({ alt: e.target.value } as Patch)} /></Field>
            <SizeControl size={s.size} unit={s.unit} hint="of the row (up to 80%)" maxPercent={80} placeholder={s.imageSize === "third" ? 33 : s.imageSize === "twoThirds" ? 67 : 50} onPatch={onPatch} />
            <Field label="Image side">
              <Select value={s.imageSide} onChange={(e) => onPatch({ imageSide: e.target.value as "left" | "right" } as Patch)}>
                <option value="right">Image on the right</option>
                <option value="left">Image on the left</option>
              </Select>
            </Field>
          </div>
          <Field label="Text" className="sm:col-span-2"><RichTextEditor value={s.html} onChange={(html) => onPatch({ html } as Patch)} /></Field>
        </>
      );
    case "FAQ":
      return (
        <>
          {heading("Heading", "e.g. “Frequently asked questions”")}
          <div className="space-y-2 sm:col-span-2">
            {s.items.map((it, n) => (
              <div key={n} className="rounded-lg border border-line p-2.5">
                <div className="flex items-start gap-2">
                  <div className="grid flex-1 gap-2">
                    <Input value={it.q} placeholder="Question" onChange={(e) => onPatch({ items: s.items.map((x, k) => (k === n ? { ...x, q: e.target.value } : x)) } as Patch)} />
                    <Textarea rows={3} value={it.a} placeholder="Answer" onChange={(e) => onPatch({ items: s.items.map((x, k) => (k === n ? { ...x, a: e.target.value } : x)) } as Patch)} />
                  </div>
                  <IconBtn label="Remove question" danger onClick={() => onPatch({ items: s.items.filter((_, k) => k !== n) } as Patch)}><Trash2 className="h-4 w-4" /></IconBtn>
                </div>
              </div>
            ))}
            <Button size="sm" variant="secondary" disabled={s.items.length >= 30} onClick={() => onPatch({ items: [...s.items, { q: "", a: "" }] } as Patch)}>
              <Plus className="h-4 w-4" aria-hidden /> Add question
            </Button>
          </div>
        </>
      );
    case "CTA":
      return (
        <>
          {heading()}
          <Field label="Text" className="sm:col-span-2"><Textarea rows={2} value={s.text} onChange={(e) => onPatch({ text: e.target.value } as Patch)} /></Field>
          <Field label="Button label"><Input value={s.buttonLabel} placeholder="Get free advice" onChange={(e) => onPatch({ buttonLabel: e.target.value } as Patch)} /></Field>
          <Field label="Button link"><Input value={s.buttonUrl} placeholder="/contact or https://…" onChange={(e) => onPatch({ buttonUrl: e.target.value } as Patch)} /></Field>
        </>
      );
  }
}

/** Width as a number plus a unit (px, %, rem, em, vw, ch, pt, cm, mm, in), with a units guide. */
function SizeControl({ size, unit, hint, maxPercent = 100, placeholder, onPatch }: { size: number | null; unit: SizeUnit; hint: string; maxPercent?: number; placeholder?: number; onPatch: (p: Patch) => void }) {
  const [guide, setGuide] = useState(false);
  const info = UNIT_INFO[unit];
  const limits = unit === "%" ? { min: info.min, max: maxPercent } : { min: info.min, max: info.max };
  const px = size && info.px ? Math.round(size * info.px) : null;
  const decimals = info.min < 1 || (info.px ?? 0) >= 10;
  return (
    <div className="space-y-1.5 sm:col-span-2">
      <div className="grid grid-cols-[1fr_9rem] gap-2">
        <Field label="Width" hint={`${limits.min}–${limits.max} ${unit === "%" ? `% ${hint}` : unit}${px ? ` · ≈ ${px}px` : ""}`}>
          <Input type="number" inputMode="decimal" step={decimals ? "0.1" : "1"} min={limits.min} max={limits.max} value={size ?? ""} placeholder={String(placeholder ?? (unit === "%" ? limits.max : unit === "px" ? 800 : ""))} onChange={(e) => onPatch({ size: e.target.value === "" ? null : Number(e.target.value) } as Patch)} />
        </Field>
        <Field label="Unit">
          <Select
            value={unit}
            onChange={(e) => {
              const next = e.target.value as SizeUnit;
              // Keep the same size where it can be converted; otherwise start from a sensible number.
              const converted = size ? convertSize(size, unit, next) : null;
              const fallback = next === "%" ? Math.min(50, maxPercent) : next === "vw" ? 40 : null;
              onPatch({ unit: next, size: converted ?? fallback ?? size } as Patch);
            }}
          >
            {SIZE_UNITS.map((u) => <option key={u} value={u}>{UNIT_INFO[u].label}</option>)}
          </Select>
        </Field>
      </div>
      <button type="button" onClick={() => setGuide((g) => !g)} className="text-xs font-medium text-primary hover:underline" aria-expanded={guide}>
        {guide ? "Hide units guide" : "Units guide — what is rem, em, pt…?"}
      </button>
      {guide && (
        <div className="overflow-hidden rounded-lg border border-line">
          <table className="w-full text-xs">
            <tbody className="divide-y divide-line">
              {SIZE_UNITS.map((u) => (
                <tr key={u} className={u === unit ? "bg-primary/5" : undefined}>
                  <td className="w-14 px-2.5 py-1.5 font-mono font-semibold text-ink">{u}</td>
                  <td className="px-2.5 py-1.5 text-muted">{UNIT_INFO[u].note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line bg-bg px-2.5 py-1.5 text-[11px] text-muted">The image never grows wider than the content area or its own size, and shrinks to fit on phones.</p>
        </div>
      )}
    </div>
  );
}
