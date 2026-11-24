"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { RelationPicker } from "../relation-picker";
import { importFromUrl, looksLikeUrl, MediaLibraryDialog, uploadFiles } from "../media-picker";
import { useToast } from "@/components/ui/toast";
import { RichTextEditor } from "../rich-text";
import { MediaField } from "../media-picker";
import { ComparisonSectionsEditor } from "../comparison-sections-editor";
import type { ComparisonSection } from "@/lib/comparison-sections";
import { createContext, useContext } from "react";
import type { BlockField } from "./block-fields";
import { PhoneInput } from "@/components/ui/phone-input";

type Data = Record<string, unknown>;

/**
 * Image picked by URL: paste a link, upload a file, or choose from the library. A pasted link to
 * another website is downloaded into the media library and replaced with our own copy, so the
 * image keeps working (and loads fast) even if the other site changes or blocks hotlinking.
 */
function ImageUrlField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"upload" | "import" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();
  // Known after mount only, so server and browser render the same markup.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const external = (v: string) => origin !== null && looksLikeUrl(v) && !v.startsWith(origin);
  const importLink = async (url: string) => {
    setBusy("import");
    const r = await importFromUrl(url);
    setBusy(null);
    if (r.error || !r.assets?.[0]) return notify("error", `${r.error ?? "That link couldn't be imported."} The link was kept as typed.`);
    onChange(r.assets[0].url);
    notify("success", "Image copied into the media library");
  };
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("upload");
    const r = await uploadFiles(files);
    setBusy(null);
    if (r.error || !r.assets?.[0]) return notify("error", r.error ?? "Upload failed.");
    onChange(r.assets[0].url);
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").trim();
            if (external(text)) {
              e.preventDefault();
              onChange(text);
              void importLink(text);
            }
          }}
          placeholder="Paste an image link, or upload"
          disabled={busy === "import"}
        />
        <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
        <Button size="sm" variant="secondary" className="h-10" loading={busy === "upload"} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden /> Upload
        </Button>
        <Button size="sm" variant="secondary" className="h-10" onClick={() => setOpen(true)}>Library</Button>
      </div>
      {busy === "import" ? (
        <p className="mt-1 text-xs text-muted">Copying the image into the media library…</p>
      ) : (
        value && external(value) && (
          <button type="button" onClick={() => void importLink(value)} className="mt-1 text-xs font-medium text-primary hover:underline">
            This image is on another website — save a copy to the media library
          </button>
        )
      )}
      <MediaLibraryDialog open={open} onClose={() => setOpen(false)} onSelect={(items) => items[0] && onChange(items[0].url)} />
    </div>
  );
}

/** Renders a form from a block field config. Values are kept as plain JSON matching the block's Zod schema. */
/** Narrow places (the website's edit panel): one field per row, nested lists and groups too. */
export const SingleColumn = createContext(false);

export function BlockForm({ fields, value, onChange, idPrefix }: { fields: BlockField[]; value: Data; onChange: (v: Data) => void; idPrefix: string }) {
  const set = (name: string, v: unknown) => onChange({ ...value, [name]: v });
  const single = useContext(SingleColumn);
  return (
    <div className={single ? "grid gap-4" : "grid gap-4 md:grid-cols-2"}>
      {fields.map((f) => {
        const id = `${idPrefix}-${f.name}`;
        const v = value[f.name];
        const wide = f.type === "comparisonSections" || f.type === "rich" || f.type === "list" || f.type === "textarea" || f.type === "pickers" || f.type === "group" || f.type === "stringList";
        let control: React.ReactNode;
        switch (f.type) {
          case "text":
          case "url":
            control = <Input id={id} value={(v as string) ?? ""} placeholder={f.placeholder} onChange={(e) => set(f.name, e.target.value)} />;
            break;
          case "phone":
            control = <PhoneInput id={id} value={(v as string) ?? ""} onChange={(val) => set(f.name, val)} />;
            break;
          case "textarea":
            control = <Textarea id={id} rows={3} value={(v as string) ?? ""} onChange={(e) => set(f.name, e.target.value)} />;
            break;
          case "number":
            control = <Input id={id} type="number" min={f.min} max={f.max} value={(v as number) ?? ""} onChange={(e) => set(f.name, e.target.value === "" ? undefined : Number(e.target.value))} />;
            break;
          case "switch":
            return <div key={f.name} className="pt-6"><Switch label={f.label} hint={f.hint} checked={Boolean(v)} onChange={(e) => set(f.name, e.target.checked)} /></div>;
          case "select":
            control = <Select id={id} value={(v as string) ?? f.options[0]?.value} onChange={(e) => set(f.name, e.target.value)}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
            break;
          case "rich":
            control = <RichTextEditor value={(v as string) ?? ""} onChange={(html) => set(f.name, html)} />;
            break;
          case "picker":
            control = <RelationPicker id={id} type={f.picker} value={v ? [v as string] : []} onChange={(ids) => set(f.name, ids[0] ?? null)} />;
            break;
          case "pickers":
            control = <RelationPicker id={id} type={f.picker} multiple value={(v as string[]) ?? []} onChange={(ids) => set(f.name, ids)} />;
            break;
          case "image":
            control = <ImageUrlField value={(v as string) ?? ""} onChange={(url) => set(f.name, url)} />;
            break;
          case "group":
            return (
              <fieldset key={f.name} className={cn("min-w-0 rounded-panel border border-line p-4", !single && "md:col-span-2")}>
                <legend className="px-1 text-sm font-semibold">{f.label}</legend>
                {f.hint && <p className="mb-3 text-xs text-muted">{f.hint}</p>}
                <BlockForm fields={f.fields} value={(v as Data) ?? {}} idPrefix={id} onChange={(next) => set(f.name, next)} />
              </fieldset>
            );
          case "color":
            control = (
              <div className="flex items-center gap-2">
                <input type="color" value={(v as string) ?? "#000000"} onChange={(e) => set(f.name, e.target.value.toUpperCase())} className="h-10 w-12 cursor-pointer rounded-control border border-line bg-surface p-1" aria-label={`${f.label} picker`} />
                <Input id={id} value={(v as string) ?? ""} onChange={(e) => set(f.name, e.target.value)} className="w-32 font-mono" />
              </div>
            );
            break;
          case "stringList":
            control = <Textarea id={id} rows={3} placeholder={f.placeholder} defaultValue={((v as string[]) ?? []).join("\n")} onBlur={(e) => set(f.name, e.target.value.split(/[\n,]/).map((x) => x.trim()).filter(Boolean))} />;
            break;
          case "media":
            control = <MediaFieldWithPreview value={(v as string | null) ?? null} onChange={(mid) => set(f.name, mid)} />;
            break;
          case "comparisonSections":
            control = <ComparisonSectionsEditor value={(v as ComparisonSection[]) ?? []} onChange={(next) => set(f.name, next)} />;
            break;
          case "list": {
            const items = (Array.isArray(v) ? v : []) as Data[];
            control = (
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2 rounded-panel border border-line bg-bg p-3">
                    <div className="flex-1">
                      <BlockForm fields={f.fields} value={item} idPrefix={`${id}-${i}`} onChange={(next) => set(f.name, items.map((x, j) => (j === i ? next : x)))} />
                    </div>
                    <button type="button" onClick={() => set(f.name, items.filter((_, j) => j !== i))} className="self-start rounded p-1 text-muted hover:text-danger" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <Button size="sm" variant="secondary" onClick={() => set(f.name, [...items, {}])}><Plus className="h-4 w-4" aria-hidden /> {f.addLabel}</Button>
              </div>
            );
            break;
          }
        }
        return (
          <Field key={f.name} label={f.label} htmlFor={id} hint={f.hint} className={cn("min-w-0", wide && !single && "md:col-span-2")}>
            {control}
          </Field>
        );
      })}
    </div>
  );
}

/** Image previews (media id → url) for "media" fields; the website's edit panel provides them. */
export const MediaPreviews = createContext<Record<string, string>>({});

function MediaFieldWithPreview({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const known = useContext(MediaPreviews);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const preview = value ? picked[value] ?? known[value] ?? null : null;
  return (
    <MediaField
      value={value}
      preview={preview}
      onChange={(id, item) => {
        if (id && item?.url) setPicked((p) => ({ ...p, [id]: item.url }));
        onChange(id);
      }}
    />
  );
}
