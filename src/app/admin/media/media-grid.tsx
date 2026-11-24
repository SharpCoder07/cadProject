"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Copy, FileText, Upload } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, useConfirm } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { importFromUrl, PasteUrlInput, uploadFiles } from "@/components/admin/media-picker";
import { useServerAction } from "@/components/admin/use-action";
import { AllCheckbox, RowCheckbox, SelectionProvider } from "@/components/admin/bulk-table";
import { BulkActionBar } from "@/components/admin/bulk-actions";
import { deleteMediaAction, mediaUsageAction, updateMediaAction } from "./actions";

interface Asset { id: string; url: string; filename: string; mimeType: string; alt: string | null; caption: string | null; sizeBytes: number; width: number | null; height: number | null; createdAt: string; uploadedBy?: string | null }

const kb = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

export function MediaGrid({ assets, maxMb, canUpload = true, emptyText, uploadNote }: { assets: Asset[]; maxMb: number; canUpload?: boolean; emptyText?: string; uploadNote?: string }) {
  const router = useRouter();
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [edit, setEdit] = useState<Asset | null>(null);
  const [usage, setUsage] = useState<{ count: number; usedIn: string[] } | null>(null);
  const update = useServerAction(updateMediaAction, { onSuccess: () => setEdit(null) });
  const del = useServerAction(deleteMediaAction, { onSuccess: () => setEdit(null) });
  const [ask, confirmDialog] = useConfirm();
  const checkUsage = useServerAction(mediaUsageAction, { refresh: false, onSuccess: (u) => setUsage(u) });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const r = await uploadFiles(files);
    setUploading(false);
    if (r.error) notify("error", r.error);
    else { notify("success", `Uploaded ${r.assets?.length} file(s)`); router.refresh(); }
  };

  return (
    <SelectionProvider>
    <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (canUpload) void upload(e.dataTransfer.files); }}>
      {canUpload && <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-start gap-3">
          <input ref={fileRef} type="file" multiple hidden accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf" onChange={(e) => void upload(e.target.files)} />
          <Button size="sm" onClick={() => fileRef.current?.click()} loading={uploading}><Upload className="h-4 w-4" aria-hidden /> Upload files</Button>
          <span className="pt-2 text-xs text-muted">or</span>
          <PasteUrlInput
            className="w-full max-w-xl flex-1"
            placeholder="Paste a link to an image or PDF (https://…)"
            onSubmit={async (url) => {
              const r = await importFromUrl(url);
              if (r.error) return r.error;
              notify("success", "File added from link");
              router.refresh();
            }}
          />
        </div>
        <p className="text-xs text-muted">JPG, PNG, WebP, GIF, AVIF or PDF, up to {maxMb} MB. Drop files on this page or paste a link and we’ll download a copy. Images are optimised and stripped of location data.{uploadNote ? ` ${uploadNote}` : ""}</p>
      </div>}
      {assets.length === 0 ? <div className="rounded-panel border border-dashed border-line"><EmptyState title="No files here">{emptyText ?? "Upload logos, screenshots and brochures to use across the site."}</EmptyState></div> : (
        <>
        <BulkActionBar
          noun="file"
          items={[{ label: "Delete", action: deleteMediaAction, extra: { force: false }, done: "Deleted", danger: true, confirm: "Files that are still used on the website are skipped — open them one by one to see where they’re used." }]}
        />
        <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted"><AllCheckbox ids={assets.map((a) => a.id)} /> Select all</div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {assets.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute left-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-md bg-surface/90 shadow-sm ring-1 ring-line"><RowCheckbox id={a.id} label={a.filename} /></span>
              <button type="button" onClick={() => { setEdit(a); setUsage(null); void checkUsage.run({ id: a.id }); }} className="block w-full overflow-hidden admin-card text-left hover:border-mint">
                <span className="relative flex aspect-square items-center justify-center bg-bg">
                  {a.mimeType.startsWith("image/") ? <Image src={a.url} alt={a.alt ?? ""} fill className="object-contain p-2" sizes="180px" /> : <FileText className="h-10 w-10 text-muted" aria-hidden />}
                </span>
                <span className="block truncate px-2 pt-1.5 text-xs font-medium">{a.filename}</span>
                <span className={`block truncate px-2 pb-1.5 text-xs ${a.alt ? "text-muted" : "text-warning"}`}>{a.alt ? a.alt : a.mimeType.startsWith("image/") ? "No alt text" : kb(a.sizeBytes)}</span>
              </button>
            </li>
          ))}
        </ul>
        </>
      )}
      <Dialog open={edit !== null} onClose={() => setEdit(null)} title="File details" size="lg">
        {edit && (
          <form className="grid gap-5 md:grid-cols-[14rem_1fr]" onSubmit={(e) => { e.preventDefault(); void update.run({ id: edit.id, alt: edit.alt, caption: edit.caption, filename: edit.filename }); }}>
            <div>
              <div className="relative flex aspect-square items-center justify-center rounded-panel border border-line bg-bg">
                {edit.mimeType.startsWith("image/") ? <Image src={edit.url} alt="" fill className="object-contain p-2" sizes="224px" /> : <FileText className="h-12 w-12 text-muted" aria-hidden />}
              </div>
              <dl className="mt-3 space-y-1 text-xs text-muted">
                <div>{edit.mimeType} · {kb(edit.sizeBytes)}{edit.width && ` · ${edit.width}×${edit.height}`}</div>
                <div>Uploaded {formatDate(edit.createdAt)}</div>
                {edit.uploadedBy && <div>By {edit.uploadedBy}</div>}
                <div>{usage === null ? "Checking where it’s used…" : usage.count === 0 ? <span className="font-semibold text-warning">Not used anywhere</span> : `Used in: ${usage.usedIn.join(", ") || `${usage.count} place(s)`}`}</div>
              </dl>
              <button type="button" className="mt-2 inline-flex items-center gap-1 text-xs text-primary" onClick={() => { void navigator.clipboard.writeText(new URL(edit.url, window.location.origin).toString()); notify("success", "URL copied"); }}>
                <Copy className="h-3 w-3" aria-hidden /> Copy URL
              </button>
            </div>
            <div className="space-y-4">
              <Field label="File name" htmlFor="m-name"><Input id="m-name" value={edit.filename} onChange={(e) => setEdit({ ...edit, filename: e.target.value })} /></Field>
              <Field label="Alt text" htmlFor="m-alt" hint="Describe the image for screen readers and search engines."><Input id="m-alt" value={edit.alt ?? ""} onChange={(e) => setEdit({ ...edit, alt: e.target.value || null })} /></Field>
              <Field label="Caption" htmlFor="m-cap"><Textarea id="m-cap" rows={2} value={edit.caption ?? ""} onChange={(e) => setEdit({ ...edit, caption: e.target.value || null })} /></Field>
              <div className="flex justify-between gap-2 border-t border-line pt-4">
                <Button size="sm" variant="ghost" className="text-danger" loading={del.pending} onClick={() => void ask({ title: usage?.count ? "Delete a file that is in use?" : "Delete this file?", message: usage?.count ? `It is used in ${usage.usedIn.join(", ") || `${usage.count} place(s)`}. Those places will lose the image.` : undefined, confirmLabel: usage?.count ? "Delete anyway" : "Delete", recycleBin: true }).then((yes) => yes && void del.run({ id: edit.id, force: Boolean(usage?.count) }))}>Delete</Button>
                {confirmDialog}
                <Button size="sm" type="submit" loading={update.pending}>Save</Button>
              </div>
            </div>
          </form>
        )}
      </Dialog>
    </div>
    </SelectionProvider>
  );
}
