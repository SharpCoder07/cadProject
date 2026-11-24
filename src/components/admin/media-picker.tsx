"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, ImagePlus, Link2, Upload, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Spinner } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  alt: string | null;
  width?: number | null;
  height?: number | null;
}

export async function uploadFiles(files: FileList | File[], alt?: string): Promise<{ assets?: MediaItem[]; error?: string }> {
  const form = new FormData();
  for (const f of Array.from(files)) form.append("file", f);
  if (alt) form.append("alt", alt);
  const res = await fetch("/api/uploads", { method: "POST", body: form }).catch(() => null);
  if (!res) return { error: "Upload failed. Check your connection." };
  const body = (await res.json().catch(() => ({}))) as { assets?: MediaItem[]; error?: string };
  return res.ok ? { assets: body.assets } : { error: body.error ?? "Upload failed." };
}

/** "Paste URL": the server downloads the link and adds it to the media library like an upload. */
export async function importFromUrl(url: string, alt?: string): Promise<{ assets?: MediaItem[]; error?: string }> {
  const res = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, alt }) }).catch(() => null);
  if (!res) return { error: "Import failed. Check your connection." };
  const body = (await res.json().catch(() => ({}))) as { assets?: MediaItem[]; error?: string };
  return res.ok ? { assets: body.assets } : { error: body.error ?? "That link couldn't be imported." };
}

export const looksLikeUrl = (v: string) => /^https?:\/\/\S+\.\S+/i.test(v.trim());

/**
 * Text box + button for pasting a file link, shown next to every upload button. Not a <form>, so it
 * can sit inside other forms; Enter submits. `onSubmit` returns an error message to show, or nothing.
 */
export function PasteUrlInput({
  onSubmit,
  placeholder = "Paste an image link (https://…)",
  buttonLabel = "Add from URL",
  className,
}: {
  onSubmit: (url: string) => Promise<string | null | void>;
  placeholder?: string;
  buttonLabel?: string;
  className?: string;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    const v = url.trim();
    if (!v) return setError("Paste a link first.");
    if (!looksLikeUrl(v)) return setError("Paste a full link starting with https://");
    setBusy(true);
    setError(null);
    const err = await onSubmit(v).catch(() => "That link couldn't be imported.");
    setBusy(false);
    if (err) setError(err);
    else setUrl("");
  };
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }}
            placeholder={placeholder}
            aria-label={placeholder}
            aria-invalid={error ? true : undefined}
            className="h-9 pl-8"
          />
        </div>
        <Button size="sm" variant="secondary" className="h-9 shrink-0" loading={busy} onClick={() => void submit()}>
          {buttonLabel}
        </Button>
      </div>
      {error && <p className="mt-1 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Library browser + uploader in a dialog. */
export function MediaLibraryDialog({ open, onClose, onSelect, kind = "image", multiple = false }: { open: boolean; onClose: () => void; onSelect: (items: MediaItem[]) => void; kind?: "image" | "document" | "any"; multiple?: boolean }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MediaItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams({ q, ...(kind !== "any" ? { kind } : {}) });
    const res = await fetch(`/api/media?${sp.toString()}`).catch(() => null);
    if (res?.ok) setItems(((await res.json()) as { items: MediaItem[] }).items);
    setLoading(false);
  }, [q, kind]);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [open, load]);

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const r = await uploadFiles(files);
    setUploading(false);
    if (r.error) return notify("error", r.error);
    notify("success", `Uploaded ${r.assets?.length ?? 0} file(s)`);
    setItems((cur) => [...(r.assets ?? []), ...cur]);
    if (r.assets) setSelected(multiple ? (s) => [...s, ...r.assets!] : r.assets.slice(0, 1));
  };

  const onImport = async (url: string) => {
    const r = await importFromUrl(url);
    if (r.error) return r.error;
    notify("success", "File added from link");
    setItems((cur) => [...(r.assets ?? []), ...cur.filter((x) => !r.assets?.some((a) => a.id === x.id))]);
    if (r.assets) setSelected(multiple ? (s) => [...s, ...r.assets!] : r.assets.slice(0, 1));
  };

  const toggle = (m: MediaItem) => setSelected((s) => (s.some((x) => x.id === m.id) ? s.filter((x) => x.id !== m.id) : multiple ? [...s, m] : [m]));

  return (
    <Dialog open={open} onClose={onClose} title="Media library" size="xl">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by file name or alt text" className="h-9 max-w-xs" />
        <input ref={fileRef} type="file" multiple={multiple} hidden accept={kind === "document" ? "application/pdf" : kind === "image" ? "image/*" : "image/*,application/pdf"} onChange={(e) => void onUpload(e.target.files)} />
        <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} loading={uploading}>
          <Upload className="h-4 w-4" aria-hidden /> Upload
        </Button>
        <span className="text-xs text-muted">or</span>
        <PasteUrlInput onSubmit={onImport} placeholder={kind === "document" ? "Paste a PDF link (https://…)" : "Paste an image link (https://…)"} className="w-full sm:w-auto sm:min-w-[22rem] sm:flex-1" />
      </div>
      <div
        className="mt-4 min-h-[16rem]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onUpload(e.dataTransfer.files);
        }}
      >
        {loading ? (
          <div className="flex h-64 items-center justify-center"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="flex h-64 items-center justify-center rounded-panel border border-dashed border-line text-sm text-muted">No files yet. Upload, drop files here or paste a link.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {items.map((m) => {
              const isSel = selected.some((s) => s.id === m.id);
              return (
                <li key={m.id}>
                  <button type="button" onClick={() => toggle(m)} className={cn("block w-full overflow-hidden rounded-control border-2 text-left", isSel ? "border-primary" : "border-transparent hover:border-line")} aria-pressed={isSel}>
                    <span className="relative flex aspect-square items-center justify-center bg-bg">
                      {m.mimeType.startsWith("image/") ? <Image src={m.url} alt={m.alt ?? ""} fill className="object-contain p-1" sizes="160px" /> : <FileText className="h-8 w-8 text-muted" aria-hidden />}
                    </span>
                    <span className="block truncate px-1 py-1 text-xs text-muted">{m.filename}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2 border-t border-line pt-4">
        <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button size="sm" disabled={!selected.length} onClick={() => { onSelect(selected); onClose(); }}>
          {multiple ? `Use ${selected.length || ""} selected` : "Use this file"}
        </Button>
      </div>
    </Dialog>
  );
}

/** Single media field: preview + choose/remove. Value is the media id; `preview` carries the URL for display. */
export function MediaField({ value, preview, onChange, kind = "image", label = "Choose image" }: { value: string | null | undefined; preview?: string | null; onChange: (id: string | null, item?: MediaItem) => void; kind?: "image" | "document"; label?: string }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(preview);
  useEffect(() => setUrl(preview), [preview]);
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-bg">
        {value && url && kind === "image" ? <Image src={url} alt="" fill className="object-contain p-1" sizes="64px" /> : value ? <FileText className="h-6 w-6 text-muted" aria-hidden /> : <ImagePlus className="h-6 w-6 text-muted" aria-hidden />}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{value ? "Replace" : label}</Button>
        {value && (
          <Button variant="secondary" size="sm" className="w-8 px-0 text-muted hover:border-danger/40 hover:text-danger" onClick={() => { onChange(null); setUrl(null); }} aria-label="Remove" title="Remove">
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
      <MediaLibraryDialog open={open} onClose={() => setOpen(false)} kind={kind} onSelect={(items) => { const m = items[0]; if (m) { onChange(m.id, m); setUrl(m.url); } }} />
    </div>
  );
}
