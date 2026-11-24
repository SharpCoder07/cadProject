"use client";

import { Controller, useWatch, type Control, type FieldValues, type Path, type UseFormRegister } from "react-hook-form";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { MediaField } from "./media-picker";

/** Live character count, amber when over the recommended length. */
function Count({ value, max }: { value: unknown; max: number }) {
  const n = String(value ?? "").length;
  return <span className={cn("tabular-nums", n > max ? "font-semibold text-warning" : "text-muted")}>{n}/{max}</span>;
}

/** How the page could look in Google results, from the SEO title and description being typed. */
export function SeoPreview({ title, description, path, fallbackTitle, fallbackDescription, noIndex }: { title?: string | null; description?: string | null; path?: string; fallbackTitle?: string; fallbackDescription?: string; noIndex?: boolean }) {
  const host = typeof window === "undefined" ? "" : window.location.host;
  const t = title?.trim() || fallbackTitle || "Automatic title (from the name)";
  const d = description?.trim() || fallbackDescription || "Automatic description (from the content). Write one here to control the snippet shown in Google.";
  return (
    <div className="rounded-panel border border-line bg-bg/50 p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Google preview{noIndex && <span className="ml-2 rounded-full bg-warning/10 px-2 py-0.5 normal-case tracking-normal text-warning">Hidden from search engines</span>}</p>
      <p className="truncate text-xs text-[#4d5156]">{host}{path ?? ""}</p>
      <p className={cn("mt-0.5 truncate text-lg leading-snug text-[#1a0dab]", !title?.trim() && "italic opacity-70")}>{t.length > 65 ? `${t.slice(0, 62)}…` : t}</p>
      <p className={cn("mt-1 line-clamp-2 text-sm text-[#4d5156]", !description?.trim() && "italic opacity-70")}>{d.length > 160 ? `${d.slice(0, 157)}…` : d}</p>
    </div>
  );
}

/** SEO override fields for any RHF form whose values contain `seo`. */
export function SeoFields<T extends FieldValues>({ register, control, ogPreview, path }: { register: UseFormRegister<T>; control: Control<T>; ogPreview?: string | null; path?: string }) {
  const p = (k: string) => `seo.${k}` as Path<T>;
  const [title, description, noIndex] = useWatch({ control, name: [p("title"), p("description"), p("noIndex")] }) as [string | null, string | null, boolean];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="lg:col-span-2"><SeoPreview title={title} description={description} path={path} noIndex={noIndex} /></div>
      <Field label="SEO title" htmlFor="seo-title" hint={<>Leave empty to use the default. Aim for 50–60 characters. <Count value={title} max={70} /></>}><Input id="seo-title" maxLength={70} {...register(p("title"))} /></Field>
      <Field label="Canonical URL" htmlFor="seo-canonical" hint="Only if this content duplicates another URL."><Input id="seo-canonical" placeholder="https://…" {...register(p("canonicalUrl"))} /></Field>
      <Field label="Meta description" htmlFor="seo-desc" hint={<>Aim for 140–160 characters. <Count value={description} max={170} /></>} className="lg:col-span-2"><Textarea id="seo-desc" rows={2} maxLength={170} {...register(p("description"))} /></Field>
      <Field label="Keywords" htmlFor="seo-kw" hint="Optional, comma separated. Google ignores this, other engines may use it."><Input id="seo-kw" {...register(p("keywords"))} /></Field>
      <Field label="Social sharing image" hint="1200 × 630 px. Leave empty for the automatic branded card.">
        <Controller control={control} name={p("ogImageId")} render={({ field }) => <MediaField value={field.value as string | null} preview={ogPreview} onChange={(id) => field.onChange(id)} />} />
      </Field>
      <Switch label="Hide from search engines" hint="Adds noindex and removes the page from the sitemap." {...register(p("noIndex"))} />
    </div>
  );
}
