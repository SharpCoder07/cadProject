"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { formResolver } from "@/lib/form-resolver";
import type { z } from "zod";
import { categoryInput, type CategoryInput } from "@/lib/validation/taxonomy";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { ICON_NAMES } from "@/components/ui/icon";
import { MediaField } from "@/components/admin/media-picker";
import { RelationPicker } from "@/components/admin/relation-picker";
import { RichTextEditor } from "@/components/admin/rich-text";
import { SeoFields } from "@/components/admin/seo-fields";
import { useServerAction } from "@/components/admin/use-action";
import { deleteCategoryAction, saveCategoryAction } from "./actions";

type Values = z.input<typeof categoryInput>;

export function CategoryForm({ id, defaults, parents, attributes, previews }: { id: string | null; defaults: Values; parents: { id: string; name: string; depth: number }[]; attributes: { id: string; label: string; type: string; isFilterable: boolean }[]; previews: { image?: string | null; banner?: string | null } }) {
  const router = useRouter();
  const { register, control, handleSubmit, watch, setValue, formState } = useForm<Values, unknown, CategoryInput>({ resolver: formResolver(categoryInput), defaultValues: defaults });
  const save = useServerAction(saveCategoryAction, { onSuccess: (d) => !id && router.push(`/admin/categories/${d.id}`) });
  const del = useServerAction(deleteCategoryAction, { onSuccess: () => router.push("/admin/categories") });
  const [confirm, setConfirm] = useState(false);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const e = formState.errors;

  const general = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Field label="Name" htmlFor="name" error={e.name?.message} required><Input id="name" {...register("name", { onChange: (ev) => !slugTouched && setValue("slug", slugify(ev.target.value)) })} /></Field>
      <Field label="URL slug" htmlFor="slug" error={e.slug?.message} hint={`/categories/${watch("slug") || "…"}`} required><Input id="slug" {...register("slug", { onChange: () => setSlugTouched(true) })} /></Field>
      <Field label="Parent category" htmlFor="parentId" error={e.parentId?.message}>
        <Select id="parentId" {...register("parentId", { setValueAs: (v) => v || null })}>
          <option value="">None (top level)</option>
          {parents.filter((p) => p.id !== id).map((p) => <option key={p.id} value={p.id}>{"— ".repeat(p.depth)}{p.name}</option>)}
        </Select>
      </Field>
      <Field label="Short name" htmlFor="shortName" hint="Used in tight spaces such as menus."><Input id="shortName" {...register("shortName")} /></Field>
      <Field label="Icon" htmlFor="icon">
        <Select id="icon" {...register("icon")}><option value="">Default</option>{ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}</Select>
      </Field>
      <div className="space-y-3 pt-6">
        <Switch label="Visible on the website" {...register("isActive")} />
        <Switch label="Show in the header categories menu" {...register("showInNav")} />
      </div>
      <Field label="Description" htmlFor="description" hint="Shown under the category heading and used as the meta description." className="lg:col-span-2"><Textarea id="description" rows={3} {...register("description")} /></Field>
      <Field label="Image" hint="Used on category grids."><Controller control={control} name="imageId" render={({ field }) => <MediaField value={field.value} preview={previews.image} onChange={field.onChange} />} /></Field>
      <Field label="Banner" hint="Wide image (5:1) at the top of the category page."><Controller control={control} name="bannerId" render={({ field }) => <MediaField value={field.value} preview={previews.banner} onChange={field.onChange} />} /></Field>
    </div>
  );

  const layout = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Field label="Product layout" htmlFor="layout.view"><Select id="layout.view" {...register("layout.view")}><option value="rows">Comparable rows</option><option value="grid">Grid of cards</option></Select></Field>
      <Field label="Default sort" htmlFor="layout.defaultSort">
        <Select id="layout.defaultSort" {...register("layout.defaultSort")}>
          <option value="popular">Most popular</option><option value="rating">Highest rated</option><option value="price_asc">Price: low to high</option><option value="name">Name</option><option value="newest">Newest</option>
        </Select>
      </Field>
      <div className="space-y-3">
        <Switch label="Show subcategory links" {...register("layout.showSubcategories")} />
        <Switch label="Show editor’s picks" hint="The featured products below, above the listing." {...register("layout.showFeatured")} />
        <Switch label="Show buying guides" hint="Blog posts linked to products in this category." {...register("layout.showBuyingGuide")} />
      </div>
      <Field label="Banner placement" htmlFor="layout.bannerPlacement" hint="Show the first active banner from this placement, e.g. category.accounting."><Input id="layout.bannerPlacement" {...register("layout.bannerPlacement")} /></Field>
      <Field label="Editor’s picks" hint="Hand-picked products, in order." className="lg:col-span-2">
        <Controller control={control} name="featuredSoftwareIds" render={({ field }) => <RelationPicker type="software" multiple value={field.value ?? []} onChange={field.onChange} max={24} placeholder="Add a product" />} />
      </Field>
      <Field label="Long-form content" hint="Buyer’s guide text shown below the listing. Good for SEO." className="lg:col-span-2">
        <Controller control={control} name="content" render={({ field }) => <RichTextEditor value={field.value ?? ""} onChange={field.onChange} />} />
      </Field>
    </div>
  );

  const filters = (
    <Controller
      control={control}
      name="attributes"
      render={({ field }) => {
        const val = field.value ?? [];
        const filterable = attributes.filter((a) => a.isFilterable && a.type !== "TEXT");
        if (!filterable.length) return <p className="text-sm text-muted">No filterable attributes yet. Mark an attribute as “Use as filter” on the Attributes page.</p>;
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted">Choose which attribute filters appear on this category page, in addition to pricing, deployment and rating.</p>
            {filterable.map((a) => (
              <Checkbox key={a.id} label={a.label} checked={val.some((v) => v.attributeId === a.id)} onChange={(ev) => field.onChange(ev.target.checked ? [...val, { attributeId: a.id, isFilter: true }] : val.filter((v) => v.attributeId !== a.id))} />
            ))}
          </div>
        );
      }}
    />
  );

  return (
    <form onSubmit={handleSubmit((data) => void save.run({ id, data }))} noValidate className="grid gap-6 xl:grid-cols-[1fr_16rem]">
      <Panel className="min-w-0 self-start">
        <div className="p-5">
          <Tabs tabs={[
            { id: "general", label: "General", content: general },
            { id: "layout", label: "Page layout", content: layout },
            { id: "filters", label: "Filters", content: filters },
            { id: "seo", label: "SEO", content: <SeoFields register={register} control={control} /> },
          ]} urlParam="tab" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-4">
          {id ? <Button variant="danger" size="sm" onClick={() => setConfirm(true)}>Delete</Button> : <span />}
          <Button size="sm" type="submit" loading={save.pending}>{id ? "Save changes" : "Create category"}</Button>
        </div>
      </Panel>
      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <Panel>
          <PanelHeader title="Tips" />
          <ul className="space-y-3 p-4 text-sm text-muted">
            <li><span className="block font-medium text-ink">Parent category</span>Leave empty for a top-level category, or choose one to make this a subcategory.</li>
            <li><span className="block font-medium text-ink">Page layout &amp; filters</span>Set the hero, featured products and the filters buyers see on the category page.</li>
            <li><span className="block font-medium text-ink">Show in navigation</span>Turn on to list it in the Categories menu on the website.</li>
          </ul>
        </Panel>
      </aside>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Delete this category?" confirmLabel="Delete" recycleBin busy={del.pending} onConfirm={() => id && void del.run({ id })}>
        Products stay on the site but are no longer listed in this category. Subcategories must be moved first.
      </ConfirmDialog>
    </form>
  );
}
