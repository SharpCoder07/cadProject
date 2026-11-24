"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { formResolver } from "@/lib/form-resolver";
import type { z } from "zod";
import { ExternalLink } from "lucide-react";
import { pageInput, type PageInput } from "@/lib/validation/cms";
import { formatDateTime } from "@/lib/format";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, useConfirm } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { SeoFields } from "@/components/admin/seo-fields";
import { useServerAction } from "@/components/admin/use-action";
import { createPageAction, deletePageAction, restorePageAction, setPageStatusAction, updatePageAction } from "./actions";

type Values = z.input<typeof pageInput>;

export function PageMetaForm({ id, defaults, isSystem = false, onCreated }: { id?: string; defaults: Values; isSystem?: boolean; onCreated?: () => void }) {
  const router = useRouter();
  const { register, control, handleSubmit, setValue, watch, formState } = useForm<Values, unknown, PageInput>({ resolver: formResolver(pageInput), defaultValues: defaults });
  const create = useServerAction(createPageAction, { onSuccess: (d) => { onCreated?.(); router.push(`/admin/cms/pages/${d.id}`); } });
  const update = useServerAction(updatePageAction);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const e = formState.errors;
  return (
    <form onSubmit={handleSubmit((data) => void (id ? update.run({ id, data }) : create.run(data)))} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="pm-title" error={e.title?.message} required>
          <Input id="pm-title" {...register("title", { onChange: (ev) => !slugTouched && !isSystem && setValue("slug", slugify(ev.target.value)) })} />
        </Field>
        <Field label="URL" htmlFor="pm-slug" error={e.slug?.message} hint={isSystem ? "System pages keep their URL." : `/${watch("slug") || "…"}`} required>
          <Input id="pm-slug" disabled={isSystem} {...register("slug", { onChange: () => setSlugTouched(true) })} />
        </Field>
        {!isSystem && (
          <Field label="Template" htmlFor="pm-template" hint="Landing pages have no title header; legal pages show the last-updated date; contact pages include the contact form.">
            <Select id="pm-template" {...register("template")}>
              <option value="DEFAULT">Standard page</option><option value="LANDING">Landing page</option><option value="LEGAL">Legal / policy</option><option value="CONTACT">Contact page</option>
            </Select>
          </Field>
        )}
      </div>
      {id && <SeoFields register={register} control={control} />}
      <Button size="sm" type="submit" loading={create.pending || update.pending}>{id ? "Save page settings" : "Create page"}</Button>
    </form>
  );
}

export function PagePublishPanel({ id, slug, status, isSystem, previewKey, publishedAt, scheduledAt, canPublish, revisions }: { id: string; slug: string; status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED"; isSystem: boolean; previewKey: string; publishedAt: string | null; scheduledAt: string | null; canPublish: boolean; revisions: { id: string; version: number; message: string | null; createdAt: string; author: string | null }[] }) {
  const router = useRouter();
  const setStatus = useServerAction(setPageStatusAction);
  const del = useServerAction(deletePageAction, { onSuccess: () => router.push("/admin/cms/pages") });
  const restore = useServerAction(restorePageAction);
  const [when, setWhen] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [ask, askDialog] = useConfirm();
  const path = slug === "home" ? "/" : `/${slug}`;
  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Publishing" />
        <div className="space-y-3 p-4 text-sm">
          <p>Status: <span className="font-medium">{status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Draft"}</span></p>
          {scheduledAt && status !== "PUBLISHED" && <p className="text-primary">Scheduled for {formatDateTime(scheduledAt)}</p>}
          {publishedAt && <p className="text-muted">First published {formatDateTime(publishedAt)}</p>}
          {canPublish && status !== "PUBLISHED" && (
            <>
              <Button size="sm" variant="accent" className="w-full" loading={setStatus.pending} onClick={() => void setStatus.run({ id, status: "PUBLISHED" })}>Publish now</Button>
              <div className="flex gap-2">
                <Input type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} className="h-9 text-xs" aria-label="Publish at" />
                <Button size="sm" variant="secondary" disabled={!when} onClick={() => void setStatus.run({ id, status: "PUBLISHED", scheduledAt: new Date(when) })}>Schedule</Button>
              </div>
            </>
          )}
          {canPublish && status === "PUBLISHED" && !isSystem && <Button size="sm" variant="secondary" className="w-full" onClick={() => void setStatus.run({ id, status: "DRAFT" })}>Unpublish</Button>}
          <a href={status === "PUBLISHED" ? path : `${path}?preview=${previewKey}`} target="_blank" rel="noopener" className="flex items-center justify-center gap-1 text-primary hover:underline">
            {status === "PUBLISHED" ? "View live page" : "Preview draft"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          {status !== "PUBLISHED" && <p className="text-xs text-muted">The preview link works for anyone who has it, so share it carefully.</p>}
          {!isSystem && <Button size="sm" variant="ghost" className="w-full text-danger" onClick={() => setConfirm(true)}>Delete page</Button>}
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="History" />
        <ul className="max-h-72 divide-y divide-line overflow-y-auto">
          {revisions.map((r, i) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-xs">
              <span><span className="font-medium">v{r.version}</span> · {formatDateTime(r.createdAt)}<span className="block text-muted">{r.author ?? "System"}{r.message && ` · ${r.message}`}</span></span>
              {i > 0 && <button type="button" className="text-primary hover:underline" disabled={restore.pending} onClick={async () => { if (await ask({ title: `Restore sections from version ${r.version}?`, message: "The current sections are kept as a version too.", confirmLabel: "Restore", tone: "primary" })) void restore.run({ revisionId: r.id, pageId: id }); }}>Restore</button>}
            </li>
          ))}
        </ul>
      </Panel>
      {askDialog}
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Delete this page?" confirmLabel="Delete" recycleBin busy={del.pending} onConfirm={() => void del.run({ id })}>Menu links to it will disappear. Consider adding a redirect for its URL.</ConfirmDialog>
    </div>
  );
}
