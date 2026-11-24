"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { formResolver } from "@/lib/form-resolver";
import type { z } from "zod";
import { postInput, type PostInput } from "@/lib/validation/cms";
import { formatDateTime } from "@/lib/format";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/dialog";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { MediaField } from "@/components/admin/media-picker";
import { RelationPicker } from "@/components/admin/relation-picker";
import { RichTextEditor } from "@/components/admin/rich-text";
import { SeoFields } from "@/components/admin/seo-fields";
import { useServerAction } from "@/components/admin/use-action";
import { deletePostAction, restorePostAction, savePostAction, setPostStatusAction } from "./actions";

type Values = z.input<typeof postInput>;

export function PostEditor({ id, defaults, coverPreview, authors, categories, status, scheduledAt, canPublish, revisions }: {
  id: string | null; defaults: Values; coverPreview?: string | null; authors: { id: string; name: string }[]; categories: { id: string; name: string }[];
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED" | "IN_REVIEW"; previewKey?: string; scheduledAt?: string | null; canPublish: boolean;
  revisions: { id: string; version: number; message: string | null; createdAt: string; author: string | null }[];
}) {
  const router = useRouter();
  const { register, control, handleSubmit, watch, setValue, formState } = useForm<Values, unknown, PostInput>({ resolver: formResolver(postInput), defaultValues: defaults });
  const save = useServerAction(savePostAction, { onSuccess: (d) => !id && router.push(`/admin/blog/${d.id}`) });
  const setStatus = useServerAction(setPostStatusAction);
  const del = useServerAction(deletePostAction, { onSuccess: () => router.push("/admin/blog") });
  const [ask, confirmDialog] = useConfirm();
  const restore = useServerAction(restorePostAction, { onSuccess: () => router.refresh() });
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [when, setWhen] = useState("");
  const e = formState.errors;
  const slug = watch("slug");

  return (
    <form onSubmit={handleSubmit((data) => void save.run({ id, data }))} noValidate className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <Panel className="min-w-0 self-start">
        <div className="p-5">
        <Tabs tabs={[
          { id: "content", label: "Content", content: (
            <div className="space-y-5">
              <Field label="Title" htmlFor="p-title" error={e.title?.message} required><Input id="p-title" className="h-12 text-lg" {...register("title", { onChange: (ev) => !slugTouched && setValue("slug", slugify(ev.target.value)) })} /></Field>
              <Field label="Summary" htmlFor="p-excerpt" hint="Shown on cards and as the default meta description. Leave empty to use the opening text."><Textarea id="p-excerpt" rows={2} {...register("excerpt")} /></Field>
              <Controller control={control} name="content" render={({ field }) => <RichTextEditor value={field.value ?? ""} onChange={field.onChange} minHeight="28rem" />} />
            </div>
          ) },
          { id: "details", label: "Details", content: (
            <div className="grid gap-5 lg:grid-cols-2">
              <Field label="URL slug" htmlFor="p-slug" error={e.slug?.message} hint={`/blog/${slug || "…"}`} required><Input id="p-slug" {...register("slug", { onChange: () => setSlugTouched(true) })} /></Field>
              <Field label="Type" htmlFor="p-type"><Select id="p-type" {...register("type")}><option value="ARTICLE">Article</option><option value="GUIDE">Buying guide</option><option value="NEWS">News</option><option value="RESOURCE">Resource</option></Select></Field>
              <Field label="Author" htmlFor="p-author"><Select id="p-author" {...register("authorId", { setValueAs: (v) => v || null })}><option value="">None</option>{authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
              <Field label="Category" htmlFor="p-cat"><Select id="p-cat" {...register("categoryId", { setValueAs: (v) => v || null })}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
              <Field label="Tags" htmlFor="p-tags" hint="Comma separated">
                <Controller control={control} name="tags" render={({ field }) => <Input id="p-tags" defaultValue={(field.value ?? []).join(", ")} onBlur={(ev) => field.onChange(ev.target.value.split(",").map((t) => t.trim()).filter(Boolean))} />} />
              </Field>
              <Field label="Cover image"><Controller control={control} name="coverId" render={({ field }) => <MediaField value={field.value} preview={coverPreview} onChange={field.onChange} />} /></Field>
              <Field label="Software mentioned" hint="Shown at the end of the post and links this post from those product pages." className="lg:col-span-2">
                <Controller control={control} name="softwareIds" render={({ field }) => <RelationPicker type="software" multiple value={field.value ?? []} onChange={field.onChange} />} />
              </Field>
              <Switch label="Featured post" {...register("isFeatured")} />
            </div>
          ) },
          { id: "seo", label: "SEO", content: <SeoFields register={register} control={control} /> },
          ...(id ? [{ id: "history", label: "History", content: (
            <ul className="divide-y divide-line rounded-panel border border-line">
              {revisions.map((r, i) => (
                <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>Version {r.version}<span className="block text-xs text-muted">{formatDateTime(r.createdAt)} · {r.author ?? "System"}{r.message && ` · ${r.message}`}</span></span>
                  {i > 0 && <Button size="sm" variant="secondary" onClick={async () => { if (await ask({ title: `Restore version ${r.version}?`, message: "The current post is kept as a version too.", confirmLabel: "Restore", tone: "primary" })) void restore.run({ revisionId: r.id, postId: id }); }}>Restore</Button>}
                </li>
              ))}
            </ul>
          ) }] : []),
        ]} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4">
          {id ? <><Button variant="danger" size="sm" onClick={() => void ask({ title: "Delete this post?", message: "It disappears from the blog straight away.", recycleBin: true }).then((yes) => yes && void del.run({ id }))}>Delete</Button>{confirmDialog}</> : <span />}
          <div className="flex flex-wrap items-center gap-2">
            {id && canPublish && status === "PUBLISHED" && <Button size="sm" variant="secondary" onClick={() => void setStatus.run({ id, status: "DRAFT" })}>Unpublish</Button>}
            {id && canPublish && status !== "PUBLISHED" && (
              <>
                <Button size="sm" variant="secondary" disabled={!when || formState.isDirty} onClick={() => void setStatus.run({ id, status: "PUBLISHED", scheduledAt: new Date(when) })}>Schedule</Button>
                <Button size="sm" variant="accent" disabled={formState.isDirty} loading={setStatus.pending} onClick={() => void setStatus.run({ id, status: "PUBLISHED" })}>Publish now</Button>
              </>
            )}
            <Button size="sm" type="submit" loading={save.pending}>{id ? "Save" : "Create draft"}</Button>
          </div>
        </div>
      </Panel>
      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Panel>
          <PanelHeader title="Publishing" />
          <div className="space-y-3 p-4 text-sm">
            <p>Status: <span className="font-medium">{!status ? "New draft" : status === "PUBLISHED" ? "Published" : status === "ARCHIVED" ? "Archived" : "Draft"}</span></p>
            {scheduledAt && status !== "PUBLISHED" && <p className="text-primary">Scheduled for {formatDateTime(scheduledAt)}</p>}
            {id ? (
              <Field label="Change note" htmlFor="p-msg"><Input id="p-msg" {...register("revisionMessage")} /></Field>
            ) : (
              <p className="text-muted">New posts are saved as a draft. You can preview, publish or schedule it after saving.</p>
            )}
            {id && canPublish && status !== "PUBLISHED" && (
              <Field label="Publish at (for Schedule)" htmlFor="p-when"><Input id="p-when" type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} className="text-xs" /></Field>
            )}
            {id && formState.isDirty && canPublish && status !== "PUBLISHED" && <p className="text-xs text-muted">Save your changes before publishing.</p>}
          </div>
        </Panel>
      </aside>
    </form>
  );
}
