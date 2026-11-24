"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useFieldArray, useForm, type Control, type UseFormRegister } from "react-hook-form";
import { formResolver } from "@/lib/form-resolver";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { softwareInput, DEPLOYMENTS, PRICING_MODELS, BILLING_PERIODS, type SoftwareFormValues, type SoftwareInput } from "@/lib/validation/software";
import { DEPLOYMENT_LABEL, PRICING_MODEL_LABEL, formatDateTime } from "@/lib/format";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Alert, Panel, PanelHeader } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { ICON_NAMES } from "@/components/ui/icon";
import { RelationPicker } from "./relation-picker";
import { TermsField, type EditorTerm } from "./terms-field";
import { MediaField, MediaLibraryDialog } from "./media-picker";
import { RichTextEditor } from "./rich-text";
import { SortableList, moveItem } from "./sortable";
import { useServerAction } from "./use-action";
import { SeoPreview } from "./seo-fields";
import { createAndPublishSoftwareAction, createSoftwareAction, restoreRevisionAction, saveAndPublishSoftwareAction, setStatusAction, updateSoftwareAction } from "@/app/admin/software/actions";
import { cancelRequestAction, requestProductAction } from "@/app/vendor/actions";
import { useConfirm, usePrompt } from "@/components/ui/dialog";

export interface EditorAttribute {
  id: string;
  label: string;
  group: string;
  type: "BOOLEAN" | "SELECT" | "MULTISELECT" | "NUMBER" | "TEXT";
  unit: string | null;
  options: { id: string; label: string }[];
}

export interface EditorProps {
  mode: "staff" | "vendor";
  softwareId?: string;
  status?: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  scheduledAt?: string | null;
  publishedAt?: string | null;
  defaults: SoftwareFormValues;
  previews: { logo?: string | null; media: Record<string, { url: string; filename: string; mimeType: string }> };
  vendors: { id: string; name: string }[];
  brands: { id: string; name: string; vendorId: string | null }[];
  categories: { id: string; name: string; depth: number }[];
  industries: { id: string; name: string }[];
  terms: EditorTerm[];
  attributes: EditorAttribute[];
  revisions: { id: string; version: number; message: string | null; createdAt: string; author: string | null }[];
  can: { publish: boolean; delete: boolean; submit?: boolean; requestRemoval?: boolean };
  vendorCanPublish?: boolean;
  /** Vendor mode: the open (or last rejected) approval request for this product. */
  approval?: { id: string; action: "CREATE" | "UPDATE" | "DELETE" | "PUBLISH" | "UNPUBLISH" | "PASSWORD"; status: "PENDING" | "REJECTED" | "APPROVED" | "CANCELLED"; decisionNote: string | null; updatedAt: string } | null;
  backHref: string;
}

const errorOf = (errors: Record<string, unknown>, path: string): string | undefined => {
  const node = path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), errors);
  return node && typeof node === "object" && "message" in node ? String((node as { message: unknown }).message) : undefined;
};

export function SoftwareEditor(props: EditorProps) {
  const { mode, softwareId } = props;
  const router = useRouter();
  const form = useForm<SoftwareFormValues, unknown, SoftwareInput>({ resolver: formResolver(softwareInput), defaultValues: props.defaults, mode: "onBlur" });
  const { register, control, handleSubmit, watch, setValue, formState } = form;
  const errors = formState.errors as Record<string, unknown>;
  const err = (p: string) => errorOf(errors, p);
  const [slugTouched, setSlugTouched] = useState(Boolean(softwareId));

  const create = useServerAction(createSoftwareAction, { onSuccess: (d) => router.push(`${props.backHref}/${d.id}`) });
  const createLive = useServerAction(createAndPublishSoftwareAction, { onSuccess: (d) => router.push(`${props.backHref}/${d.id}`) });
  const update = useServerAction(updateSoftwareAction, { onSuccess: () => form.reset(form.getValues()) });
  const saveLive = useServerAction(saveAndPublishSoftwareAction, { onSuccess: () => { form.reset(form.getValues()); router.refresh(); } });
  const status = useServerAction(setStatusAction);
  const restore = useServerAction(restoreRevisionAction, { onSuccess: () => router.refresh() });
  const [confirm, confirmDialog] = useConfirm();
  const [scheduleAt, setScheduleAt] = useState(props.scheduledAt?.slice(0, 16) ?? "");

  const onInvalid = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const onSubmit = handleSubmit((values) => void (softwareId ? update.run({ id: softwareId, data: values }) : create.run(values)), onInvalid);
  /** Create (new listing) or save unsaved edits, then publish — for staff who can publish. */
  const onPublish = handleSubmit((values) => void (softwareId ? saveLive.run({ id: softwareId, data: values }) : createLive.run(values)), onInvalid);

  const pricingModel = watch("pricingModel");
  const busy = create.pending || update.pending || createLive.pending || saveLive.pending;
  const hasErrors = Object.keys(formState.errors).length > 0;

  // ─── Tabs ─────────────────────────────────────────────────────────────────
  const basics = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Field label="Product name" htmlFor="name" error={err("name")} required>
        <Input id="name" {...register("name", { onChange: (e) => !slugTouched && setValue("slug", slugify(e.target.value)) })} />
      </Field>
      <Field label="URL slug" htmlFor="slug" error={err("slug")} hint={`/software/${watch("slug") || "…"}`} required>
        <Input id="slug" {...register("slug", { onChange: () => setSlugTouched(true) })} />
      </Field>
      <Field label="Tagline" htmlFor="tagline" error={err("tagline")} hint="One line shown under the name. Up to 160 characters." className="lg:col-span-2">
        <Input id="tagline" {...register("tagline")} />
      </Field>
      <Field label="Short description" htmlFor="shortDescription" error={err("shortDescription")} hint="Shown in listings and search results." className="lg:col-span-2">
        <Textarea id="shortDescription" rows={3} {...register("shortDescription")} />
      </Field>
      {mode === "staff" && (
        <Field label="Vendor" htmlFor="vendorId" error={err("vendorId")}>
          <Select id="vendorId" {...register("vendorId", { setValueAs: (v) => v || null })}>
            <option value="">No vendor</option>
            {props.vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Brand" htmlFor="brandId" hint="The software brand buyers know (e.g. Autodesk). Add brands under Products → Brands.">
        <Select id="brandId" {...register("brandId", { setValueAs: (v) => v || null })}>
          <option value="">None</option>
          {props.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>
      <Field label="Website" htmlFor="websiteUrl" error={err("websiteUrl")}>
        <Input id="websiteUrl" type="url" placeholder="https://" {...register("websiteUrl")} />
      </Field>
      <Field label="Demo video URL" htmlFor="demoVideoUrl" error={err("demoVideoUrl")} hint="YouTube or Vimeo">
        <Input id="demoVideoUrl" type="url" placeholder="https://www.youtube.com/watch?v=…" {...register("demoVideoUrl")} />
      </Field>
      <Field label="Logo" hint="Square PNG, SVG-free. At least 200 × 200 px.">
        <Controller control={control} name="logoId" render={({ field }) => <MediaField value={field.value} preview={props.previews.logo} onChange={(id) => field.onChange(id)} label="Choose logo" />} />
      </Field>
    </div>
  );

  const description = (
    <Field label="Full description" hint="Headings, lists and links are supported. This is the main ‘About’ section of the product page.">
      <Controller control={control} name="description" render={({ field }) => <RichTextEditor value={field.value ?? ""} onChange={field.onChange} minHeight="20rem" />} />
    </Field>
  );

  const pricing = (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <Field label="Pricing model" htmlFor="pricingModel" required>
          <Select id="pricingModel" {...register("pricingModel")}>
            {PRICING_MODELS.map((m) => <option key={m} value={m}>{PRICING_MODEL_LABEL[m]}</option>)}
          </Select>
        </Field>
        <Field label="Starting price (₹)" htmlFor="startingPrice" error={err("startingPrice")} hint="Leave empty for “price on request”.">
          <Input id="startingPrice" type="number" step="0.01" min={0} disabled={pricingModel === "FREE"} {...register("startingPrice", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })} />
        </Field>
        <Field label="Price unit" htmlFor="priceUnit" hint="E.g. per user / month">
          <Input id="priceUnit" {...register("priceUnit")} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6">
        <Checkbox label="Price includes GST" {...register("priceIncludesGst")} />
        <Checkbox label="Free trial available" {...register("hasFreeTrial")} />
        <Checkbox label="Free version available" {...register("hasFreeVersion")} />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Deployment</legend>
        <div className="flex flex-wrap gap-4">
          {DEPLOYMENTS.map((d) => <Checkbox key={d} label={DEPLOYMENT_LABEL[d]} value={d} {...register("deployment")} />)}
        </div>
      </fieldset>
      <PlansEditor control={control} register={register} errors={errors} />
    </div>
  );

  const features = <FeaturesEditor control={control} register={register} errors={errors} />;
  const faqs = <FaqsEditor control={control} register={register} errors={errors} />;
  const media = <MediaEditor control={control} register={register} previews={props.previews.media} />;

  const specs = (
    <Controller
      control={control}
      name="attributes"
      render={({ field }) => {
        const values = (field.value ?? []) as NonNullable<SoftwareFormValues["attributes"]>;
        const get = (id: string) => values.find((v) => v.attributeId === id) ?? { attributeId: id, optionIds: [], valueText: null, valueNumber: null, valueBool: null };
        const set = (id: string, patch: Partial<(typeof values)[number]>) => field.onChange([...values.filter((v) => v.attributeId !== id), { ...get(id), ...patch }]);
        const groups = [...new Set(props.attributes.map((a) => a.group))];
        if (!props.attributes.length) return <Alert>No attributes defined yet. {mode === "staff" && <Link href="/admin/attributes" className="underline">Create attributes</Link>} to add specifications and filters.</Alert>;
        return (
          <div className="space-y-6">
            {groups.map((g) => (
              <fieldset key={g} className="rounded-panel border border-line p-4">
                <legend className="px-1 text-sm font-semibold">{g}</legend>
                <div className="grid gap-4 lg:grid-cols-2">
                  {props.attributes.filter((a) => a.group === g).map((a) => {
                    const v = get(a.id);
                    return (
                      <div key={a.id}>
                        <p className="mb-1.5 text-sm font-medium">{a.label}{a.unit && <span className="font-normal text-muted"> ({a.unit})</span>}</p>
                        {a.type === "BOOLEAN" && (
                          <Select value={v.valueBool === null || v.valueBool === undefined ? "" : v.valueBool ? "yes" : "no"} onChange={(e) => set(a.id, { valueBool: e.target.value === "" ? null : e.target.value === "yes" })} aria-label={a.label}>
                            <option value="">Not specified</option><option value="yes">Yes</option><option value="no">No</option>
                          </Select>
                        )}
                        {a.type === "NUMBER" && <Input type="number" value={v.valueNumber ?? ""} onChange={(e) => set(a.id, { valueNumber: e.target.value === "" ? null : Number(e.target.value) })} aria-label={a.label} />}
                        {a.type === "TEXT" && <Input value={v.valueText ?? ""} onChange={(e) => set(a.id, { valueText: e.target.value || null })} aria-label={a.label} />}
                        {a.type === "SELECT" && (
                          <Select value={v.optionIds?.[0] ?? ""} onChange={(e) => set(a.id, { optionIds: e.target.value ? [e.target.value] : [] })} aria-label={a.label}>
                            <option value="">Not specified</option>
                            {a.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                          </Select>
                        )}
                        {a.type === "MULTISELECT" && (
                          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                            {a.options.map((o) => (
                              <Checkbox key={o.id} label={o.label} checked={(v.optionIds ?? []).includes(o.id)} onChange={(e) => set(a.id, { optionIds: e.target.checked ? [...(v.optionIds ?? []), o.id] : (v.optionIds ?? []).filter((x) => x !== o.id) })} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        );
      }}
    />
  );

  const taxonomy = (
    <div className="grid gap-5 lg:grid-cols-2">
      <Field label="Primary category" htmlFor="primaryCategoryId" hint="Decides breadcrumbs and the default ‘alternatives’." error={err("primaryCategoryId")}>
        <Select id="primaryCategoryId" {...register("primaryCategoryId", { setValueAs: (v) => v || null })}>
          <option value="">Choose…</option>
          {props.categories.map((c) => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}</option>)}
        </Select>
      </Field>
      <Field label="Also list in categories">
        <Controller control={control} name="categoryIds" render={({ field }) => <RelationPicker type="category" multiple value={field.value ?? []} onChange={field.onChange} placeholder="Add a category" />} />
      </Field>
      <Field label="Industries">
        <Controller control={control} name="industryIds" render={({ field }) => <RelationPicker type="industry" multiple value={field.value ?? []} onChange={field.onChange} placeholder="Add an industry" />} />
      </Field>
      <Field label="Tags" htmlFor="tags" hint="Comma separated. Used by search.">
        <Controller control={control} name="tags" render={({ field }) => (
          <Input id="tags" defaultValue={(field.value ?? []).join(", ")} onBlur={(e) => field.onChange(e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} />
        )} />
      </Field>
    </div>
  );

  const classifications = (
    <Controller
      control={control}
      name="termIds"
      render={({ field }) => (
        <TermsField terms={props.terms} value={field.value ?? []} onChange={field.onChange} manageHref={mode === "staff" ? (key) => `/admin/taxonomies/${key}` : undefined} />
      )}
    />
  );

  const lines = (v: string[] | undefined) => (v ?? []).join("\n");
  const toLines = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 10);
  const promotion = (
    <div className="space-y-6">
      {mode === "staff" && (
        <Panel className="p-4">
          <p className="text-sm font-semibold">Editorial review</p>
          <p className="mb-3 text-xs text-muted">Shown on the product page under “Review” and “Who should choose this product?”. Leave empty to hide.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pros" hint="One per line (up to 10).">
              <Controller control={control} name="pros" render={({ field }) => <Textarea rows={4} defaultValue={lines(field.value)} onBlur={(e) => field.onChange(toLines(e.target.value))} placeholder={"Fast GST filing\nEasy for accountants"} />} />
            </Field>
            <Field label="Cons" hint="One per line (up to 10).">
              <Controller control={control} name="cons" render={({ field }) => <Textarea rows={4} defaultValue={lines(field.value)} onBlur={(e) => field.onChange(toLines(e.target.value))} placeholder={"No offline mode\nReports cost extra"} />} />
            </Field>
            <Field label="Best for" htmlFor="bestFor" hint="Who it suits, e.g. “Small retail and service businesses with 1–3 GSTINs”.">
              <Textarea id="bestFor" rows={2} {...register("bestFor", { setValueAs: (v) => (v === "" ? null : v) })} />
            </Field>
            <Field label="Not ideal for" htmlFor="notIdealFor" hint="Who should look elsewhere.">
              <Textarea id="notIdealFor" rows={2} {...register("notIdealFor", { setValueAs: (v) => (v === "" ? null : v) })} />
            </Field>
          </div>
        </Panel>
      )}
      {mode === "staff" && (
        <Panel className="p-4">
          <p className="mb-3 text-sm font-semibold">Placement flags</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Switch label="Featured" hint="Eligible for ‘featured’ homepage and category sections." {...register("isFeatured")} />
            <Switch label="Popular" hint="Shown in ‘popular software’ lists." {...register("isPopular")} />
            <Switch label="Trending" hint="Shows a trending badge." {...register("isTrending")} />
            <Switch label="Recommended" hint="Shown in ‘recommended’ lists." {...register("isRecommended")} />
            <Switch label="Sponsored" hint="Pinned at the top of listings and labelled ‘Sponsored’." {...register("isSponsored")} />
            {watch("isSponsored") && (
              <Field label="Sponsored rank" htmlFor="sponsoredRank" hint="1 shows first.">
                <Input id="sponsoredRank" type="number" min={1} {...register("sponsoredRank", { setValueAs: (v) => (v === "" ? null : Number(v)) })} />
              </Field>
            )}
          </div>
        </Panel>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Field label="Alternatives" hint="Shown in the ‘alternatives’ section, in this order. Empty = same-category suggestions.">
          <Controller control={control} name="alternativeIds" render={({ field }) => <RelationPicker type="software" multiple value={field.value ?? []} onChange={field.onChange} placeholder="Add a product" max={20} />} />
        </Field>
        <Field label="Related products" hint="Complementary tools (e.g. payroll for an HR suite).">
          <Controller control={control} name="relatedIds" render={({ field }) => <RelationPicker type="software" multiple value={field.value ?? []} onChange={field.onChange} placeholder="Add a product" max={20} />} />
        </Field>
      </div>
    </div>
  );

  const seo = (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="lg:col-span-2">
        <SeoPreview
          title={watch("seo.title")}
          description={watch("seo.description")}
          path={`/software/${watch("slug") || "…"}`}
          fallbackTitle={`${watch("name") || "Product"} Pricing, Features & Reviews (${new Date().getFullYear()})`}
          fallbackDescription={watch("shortDescription") || undefined}
          noIndex={watch("seo.noIndex")}
        />
      </div>
      <Field label="SEO title" htmlFor="seo.title" error={err("seo.title")} hint={`Leave empty to use “Name Pricing, Features & Reviews (year)”. ${String(watch("seo.title") ?? "").length}/70 characters.`}>
        <Input id="seo.title" {...register("seo.title")} />
      </Field>
      <Field label="Canonical URL" htmlFor="seo.canonicalUrl" error={err("seo.canonicalUrl")} hint="Only if this page duplicates another URL.">
        <Input id="seo.canonicalUrl" {...register("seo.canonicalUrl")} />
      </Field>
      <Field label="Old website ID" htmlFor="legacyId" error={err("legacyId")} hint="The product's number on the previous website, so old comparison links (…/compare/?products[]=97061) redirect here. Leave empty if none.">
        <Input id="legacyId" inputMode="numeric" placeholder="e.g. 97061" {...register("legacyId")} />
      </Field>
      <Field label="Meta description" htmlFor="seo.description" error={err("seo.description")} hint={`Defaults to the short description. ${String(watch("seo.description") ?? "").length}/170 characters.`} className="lg:col-span-2">
        <Textarea id="seo.description" rows={2} {...register("seo.description")} />
      </Field>
      <Field label="Keywords" htmlFor="seo.keywords"><Input id="seo.keywords" {...register("seo.keywords")} /></Field>
      <Field label="Social sharing image" hint="1200 × 630 px. Leave empty for the automatic branded card.">
        <Controller control={control} name="seo.ogImageId" render={({ field }) => <MediaField value={field.value} onChange={(id) => field.onChange(id)} />} />
      </Field>
      <Switch label="Hide from search engines" hint="Adds noindex and removes the page from the sitemap." {...register("seo.noIndex")} />
    </div>
  );

  const history = (
    <div>
      {confirmDialog}
      {props.revisions.length === 0 ? (
        <p className="text-sm text-muted">No saved versions yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-panel border border-line">
          {props.revisions.map((r, i) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">Version {r.version}</span>
                {i === 0 && <span className="ml-2 text-xs text-success">current</span>}
                <span className="block text-xs text-muted">{formatDateTime(r.createdAt)} · {r.author ?? "System"}{r.message && ` · ${r.message}`}</span>
              </span>
              {i > 0 && softwareId && mode === "staff" && (
                <Button size="sm" variant="secondary" loading={restore.pending} onClick={async () => { if (await confirm({ title: `Restore version ${r.version}?`, message: "Your current content is kept as a version too.", confirmLabel: "Restore", tone: "primary" })) void restore.run({ revisionId: r.id, softwareId }); }}>
                  Restore
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const tabs = [
    { id: "basics", label: "Basics", content: basics, badge: err("name") || err("slug") ? <Dot /> : null },
    { id: "description", label: "Description", content: description },
    { id: "pricing", label: "Pricing", content: pricing, badge: err("startingPrice") || errors.plans ? <Dot /> : null },
    { id: "features", label: "Features", content: features },
    { id: "media", label: "Screenshots & media", content: media, badge: errors.media ? <Dot /> : null },
    { id: "specs", label: "Specifications", content: specs },
    { id: "faqs", label: "FAQs", content: faqs },
    { id: "taxonomy", label: "Categories", content: taxonomy },
    { id: "classifications", label: "Classifications", content: classifications },
    { id: "promotion", label: mode === "staff" ? "Promotion & related" : "Alternatives", content: promotion },
    ...(mode === "staff" ? [{ id: "seo", label: "SEO", content: seo, badge: errors.seo ? <Dot /> : null }] : []),
    ...(softwareId ? [{ id: "history", label: "History", content: history }] : []),
  ];

  const isLive = props.status === "PUBLISHED";
  const canPublishHere = mode === "staff" && props.can.publish;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-6 xl:grid-cols-[1fr_18rem]">
      <div className="min-w-0">
        {hasErrors && <Alert tone="danger" className="mb-4" title="Some fields need attention">Tabs with problems are marked with a dot.</Alert>}
        <Panel className="p-5"><Tabs tabs={tabs} urlParam="tab" /></Panel>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        {mode === "vendor" ? (
          <VendorPublishing
            softwareId={softwareId}
            status={props.status}
            publishedAt={props.publishedAt ?? null}
            approval={props.approval ?? null}
            canSubmit={Boolean(props.can.submit)}
            canRequestRemoval={Boolean(props.can.requestRemoval)}
            dirty={formState.isDirty}
            busy={busy}
            slug={watch("slug")}
            noteField={<Field label="Note for the reviewer (optional)" htmlFor="revisionMessage"><Input id="revisionMessage" {...register("revisionMessage")} placeholder="What changed and why?" /></Field>}
          />
        ) : (
          <Panel>
          <PanelHeader title="Publishing" />
          <div className="space-y-3 p-4 text-sm">
            <p>Status: <span className="font-medium">{props.status ? { DRAFT: "Draft", IN_REVIEW: "In review", PUBLISHED: "Published", ARCHIVED: "Archived" }[props.status] : "New"}</span></p>
            {props.scheduledAt && props.status !== "PUBLISHED" && <p className="text-primary">Scheduled for {formatDateTime(props.scheduledAt)}</p>}
            {props.publishedAt && <p className="text-muted">First published {formatDateTime(props.publishedAt)}</p>}
            <Field label="Change note (optional)" htmlFor="revisionMessage"><Input id="revisionMessage" {...register("revisionMessage")} placeholder="What changed?" /></Field>
            {!softwareId && canPublishHere ? (
              <>
                <Button size="sm" variant="accent" className="w-full" loading={createLive.pending} disabled={busy} onClick={() => void onPublish()}>Create &amp; publish</Button>
                <Button size="sm" type="submit" variant="secondary" className="w-full" loading={create.pending} disabled={busy}>Save as draft</Button>
              </>
            ) : (
              <Button size="sm" type="submit" className="w-full" loading={create.pending || update.pending} disabled={busy || (!formState.isDirty && Boolean(softwareId))}>
                {softwareId ? "Save changes" : "Create draft"}
              </Button>
            )}
            {softwareId && (
              <div className="space-y-2 border-t border-line pt-3">
                {canPublishHere && !isLive && (
                  <>
                    <Button size="sm"
                      variant="accent"
                      className="w-full"
                      loading={status.pending || saveLive.pending}
                      disabled={busy}
                      onClick={() => void (formState.isDirty ? onPublish() : status.run({ ids: [softwareId], status: "PUBLISHED" }))}
                    >
                      {formState.isDirty ? "Save & publish" : "Publish now"}
                    </Button>
                    {mode === "staff" && (
                      <div className="flex gap-2">
                        <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} aria-label="Publish at" className="h-9 text-xs" />
                        <Button size="sm" variant="secondary" disabled={!scheduleAt || formState.isDirty} onClick={() => void status.run({ ids: [softwareId], status: "PUBLISHED", scheduledAt: new Date(scheduleAt) })}>Schedule</Button>
                      </div>
                    )}
                  </>
                )}
                {!canPublishHere && props.status === "DRAFT" && (
                  <Button size="sm" variant="accent" className="w-full" loading={status.pending} disabled={formState.isDirty} onClick={() => void status.run({ ids: [softwareId], status: "IN_REVIEW" })}>Submit for review</Button>
                )}
                {mode === "staff" && props.can.publish && isLive && <Button size="sm" variant="secondary" className="w-full" onClick={() => void status.run({ ids: [softwareId], status: "DRAFT" })}>Unpublish</Button>}
                {mode === "staff" && props.can.publish && props.status !== "ARCHIVED" && <Button size="sm" variant="ghost" className="w-full" onClick={() => void status.run({ ids: [softwareId], status: "ARCHIVED" })}>Archive</Button>}
                {formState.isDirty && !(canPublishHere && !isLive) && <p className="text-xs text-muted">Save your changes before publishing.</p>}
                <Link href={`/software/${watch("slug")}${isLive ? "" : "?preview=1"}`} target="_blank" className="flex items-center justify-center gap-1 pt-1 text-sm text-primary hover:underline">
                  {isLive ? "View live page" : "Preview"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        </Panel>
        )}
      </aside>
    </form>
  );
}

const ACTION_TEXT = { CREATE: "publish this product", UPDATE: "apply your changes", DELETE: "delete this product", PUBLISH: "re-publish this product", UNPUBLISH: "unpublish this product", PASSWORD: "change a password" } as const;

/** Vendor sidebar: everything is a request to the Super Admin; nothing publishes directly. */
function VendorPublishing({ softwareId, status, publishedAt, approval, canSubmit, canRequestRemoval, dirty, busy, slug, noteField }: {
  softwareId?: string;
  status?: EditorProps["status"];
  publishedAt: string | null;
  approval: EditorProps["approval"] | null;
  canSubmit: boolean;
  canRequestRemoval: boolean;
  dirty: boolean;
  busy: boolean;
  slug: string;
  noteField: React.ReactNode;
}) {
  const router = useRouter();
  const request = useServerAction(requestProductAction, { onSuccess: () => router.refresh() });
  const cancel = useServerAction(cancelRequestAction, { onSuccess: () => router.refresh() });
  const isLive = status === "PUBLISHED";
  const pending = approval?.status === "PENDING" ? approval : null;
  const rejected = approval?.status === "REJECTED" ? approval : null;
  const [prompt, promptDialog] = usePrompt();
  const ask = async (action: "DELETE" | "UNPUBLISH" | "PUBLISH", confirmText?: string) => {
    if (!softwareId) return;
    const note = confirmText
      ? await prompt({
          title: action === "DELETE" ? "Request deletion of this product?" : "Request to take this product offline?",
          message: action === "DELETE" ? "It's deleted once the Super Admin approves." : "It stays live until the Super Admin approves.",
          label: "Reason (optional)",
          placeholder: action === "DELETE" ? "e.g. Product discontinued" : "e.g. Updating pricing",
          multiline: true,
          confirmLabel: action === "DELETE" ? "Request deletion" : "Request unpublish",
          tone: action === "DELETE" ? "danger" : "primary",
        })
      : "";
    if (note === null) return;
    void request.run({ id: softwareId, action, note: note.trim() || null });
  };
  return (
    <Panel>
      {promptDialog}
      <PanelHeader title="Approval" />
      <div className="space-y-3 p-4 text-sm">
        <p>Status: <span className="font-medium">{status ? { DRAFT: publishedAt ? "Unpublished" : "Draft", IN_REVIEW: "Draft", PUBLISHED: "Live", ARCHIVED: "Archived" }[status] : "New"}</span></p>
        {pending && (
          <Alert tone="warning" title="Waiting for Super Admin approval">
            You asked to {ACTION_TEXT[pending.action]}. {pending.action === "UPDATE" ? "The live page keeps its current content until then. You're seeing your proposed version." : "Nothing changes on the website until it's approved."}
            <button type="button" onClick={() => void cancel.run({ id: pending.id })} disabled={cancel.pending} className="mt-1 block text-xs font-semibold underline underline-offset-2">Withdraw request</button>
          </Alert>
        )}
        {rejected && !pending && (
          <Alert tone="danger" title="Your last request was rejected">
            {rejected.decisionNote ?? "No reason given."} Update the product and submit again.
          </Alert>
        )}
        {!canSubmit ? (
          <p className="text-muted">Your role can view products but not propose changes.</p>
        ) : (
          <>
            {noteField}
            <Button size="sm" type="submit" className="w-full" loading={busy} disabled={!dirty && Boolean(softwareId)}>
              {!softwareId ? "Save and send for approval" : isLive ? (pending?.action === "UPDATE" ? "Update my pending changes" : "Submit changes for approval") : "Save and send for approval"}
            </Button>
            <p className="text-xs text-muted">The Super Admin reviews every change before it appears on the website.</p>
          </>
        )}
        {softwareId && (
          <div className="space-y-2 border-t border-line pt-3">
            {canSubmit && !isLive && !pending && !dirty && (
              <Button size="sm" variant="secondary" className="w-full" loading={request.pending} onClick={() => ask("PUBLISH")}>Send for approval again</Button>
            )}
            {canRequestRemoval && isLive && pending?.action !== "UNPUBLISH" && (
              <Button size="sm" variant="secondary" className="w-full" loading={request.pending} onClick={() => ask("UNPUBLISH", "Why should this product be taken offline? (optional)")}>Request unpublish</Button>
            )}
            {canRequestRemoval && pending?.action !== "DELETE" && (
              <Button size="sm" variant="ghost" className="w-full text-danger hover:bg-danger/10" loading={request.pending} onClick={() => ask("DELETE", "Request permanent deletion of this product. Reason (optional):")}>Request deletion</Button>
            )}
            <Link href={`/software/${slug}${isLive ? "" : "?preview=1"}`} target="_blank" className="flex items-center justify-center gap-1 pt-1 text-sm text-primary hover:underline">
              {isLive ? "View live page" : "Preview draft"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        )}
      </div>
    </Panel>
  );
}

const Dot = () => <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="has errors" />;

type SubProps = { control: Control<SoftwareFormValues>; register: UseFormRegister<SoftwareFormValues>; errors?: Record<string, unknown> };

function RowShell({ index, count, onMove, onRemove, handle, children }: { index: number; count: number; onMove: (d: number) => void; onRemove: () => void; handle: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 admin-card p-3">
      <div className="flex flex-col items-center gap-1 pt-1">
        {handle}
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
      <button type="button" onClick={onRemove} className="self-start rounded p-1 text-muted hover:bg-danger/10 hover:text-danger" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function FeaturesEditor({ control, register, errors = {} }: SubProps) {
  const { fields, append, remove, move, replace } = useFieldArray({ control, name: "features" });
  return (
    <div>
      <SortableList
        items={fields}
        getId={(f) => f.id}
        onReorder={(next) => replace(next.map(({ id: _id, ...rest }) => rest))}
        renderItem={(f, i, handle) => (
          <RowShell index={i} count={fields.length} handle={handle} onMove={(d) => { const t = i + d; if (t >= 0 && t < fields.length) move(i, t); }} onRemove={() => remove(i)}>
            <div className="grid gap-3 md:grid-cols-[1fr_10rem]">
              <Input placeholder="Feature name, e.g. GST e-invoicing" aria-label="Feature name" {...register(`features.${i}.title` as const)} aria-invalid={Boolean(errorOf(errors, `features.${i}.title`))} />
              <Select aria-label="Icon" {...register(`features.${i}.icon` as const)}>
                <option value="">No icon</option>
                {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </Select>
              <Textarea rows={2} placeholder="One or two sentences (optional)" aria-label="Feature description" className="md:col-span-2" {...register(`features.${i}.description` as const)} />
            </div>
          </RowShell>
        )}
      />
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => append({ title: "", description: null, icon: null })}><Plus className="h-4 w-4" aria-hidden /> Add feature</Button>
    </div>
  );
}

function PlansEditor({ control, register, errors = {} }: SubProps) {
  const { fields, append, remove, move } = useFieldArray({ control, name: "plans" });
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Plans</p>
      {errorOf(errors, "plans") && <p className="mb-2 text-xs text-danger">{errorOf(errors, "plans")}</p>}
      <div className="space-y-3">
        {fields.map((f, i) => (
          <RowShell key={f.id} index={i} count={fields.length} handle={null} onMove={(d) => { const t = i + d; if (t >= 0 && t < fields.length) move(i, t); }} onRemove={() => remove(i)}>
            <div className="grid gap-3 md:grid-cols-4">
              <Input placeholder="Plan name" aria-label="Plan name" {...register(`plans.${i}.name` as const)} />
              <Input type="number" step="0.01" min={0} placeholder="Price (empty = custom)" aria-label="Plan price" {...register(`plans.${i}.price` as const, { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })} />
              <Select aria-label="Billing period" {...register(`plans.${i}.billingPeriod` as const)}>
                {BILLING_PERIODS.map((b) => <option key={b} value={b}>{b.replace("_", " ").toLowerCase()}</option>)}
              </Select>
              <Input placeholder="Unit, e.g. per user / month" aria-label="Price unit" {...register(`plans.${i}.priceUnit` as const)} />
              <Controller
                control={control}
                name={`plans.${i}.features` as const}
                render={({ field }) => (
                  <Textarea
                    rows={3}
                    className="md:col-span-2"
                    placeholder="Included features, one per line"
                    aria-label="Plan features"
                    defaultValue={(field.value ?? []).join("\n")}
                    onBlur={(e) => field.onChange(e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))}
                  />
                )}
              />
              <div className="space-y-2 md:col-span-2">
                <Input placeholder="Short description" aria-label="Plan description" {...register(`plans.${i}.description` as const)} />
                <Input placeholder="Button label (default: Get this plan)" aria-label="Button label" {...register(`plans.${i}.ctaLabel` as const)} />
                <Checkbox label="Most popular" {...register(`plans.${i}.isPopular` as const)} />
              </div>
            </div>
          </RowShell>
        ))}
      </div>
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => append({ name: "", price: null, currency: "INR", billingPeriod: "MONTHLY", priceUnit: null, description: null, features: [], isPopular: false, ctaLabel: null })}>
        <Plus className="h-4 w-4" aria-hidden /> Add plan
      </Button>
    </div>
  );
}

function FaqsEditor({ control, register }: SubProps) {
  const { fields, append, remove, move } = useFieldArray({ control, name: "faqs" });
  return (
    <div>
      <div className="space-y-3">
        {fields.map((f, i) => (
          <RowShell key={f.id} index={i} count={fields.length} handle={null} onMove={(d) => { const t = i + d; if (t >= 0 && t < fields.length) move(i, t); }} onRemove={() => remove(i)}>
            <Input placeholder="Question" aria-label="Question" {...register(`faqs.${i}.question` as const)} />
            <Textarea rows={3} className="mt-2" placeholder="Answer" aria-label="Answer" {...register(`faqs.${i}.answer` as const)} />
          </RowShell>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">FAQs also appear in Google results as rich snippets.</p>
      <Button size="sm" variant="secondary" className="mt-3" onClick={() => append({ question: "", answer: "" })}><Plus className="h-4 w-4" aria-hidden /> Add question</Button>
    </div>
  );
}

function MediaEditor({ control, register, previews }: SubProps & { previews: EditorProps["previews"]["media"] }) {
  const { fields, append, remove, replace } = useFieldArray({ control, name: "media" });
  const [open, setOpen] = useState<"image" | "document" | null>(null);
  const [known, setKnown] = useState(previews);
  return (
    <div>
      <SortableList
        items={fields}
        getId={(f) => f.id}
        onReorder={(next) => replace(next.map(({ id: _id, ...rest }) => rest))}
        renderItem={(f, i, handle) => {
          const m = f as unknown as { kind: string; mediaId?: string | null; videoUrl?: string | null };
          const p = m.mediaId ? known[m.mediaId] : undefined;
          return (
            <RowShell index={i} count={fields.length} handle={handle} onMove={(d) => { const next = moveItem(fields, i, d); replace(next.map(({ id: _id, ...rest }) => rest)); }} onRemove={() => remove(i)}>
              <div className="flex gap-3">
                {m.kind === "VIDEO" ? (
                  <Input placeholder="https://www.youtube.com/watch?v=…" aria-label="Video URL" {...register(`media.${i}.videoUrl` as const)} className="flex-1" />
                ) : (
                  <span className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-bg text-xs text-muted">
                    {p?.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                    ) : (p?.filename ?? "File")}
                  </span>
                )}
                <Input placeholder="Caption (optional)" aria-label="Caption" {...register(`media.${i}.caption` as const)} className="flex-1" />
              </div>
            </RowShell>
          );
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen("image")}><Plus className="h-4 w-4" aria-hidden /> Add screenshots</Button>
        <Button size="sm" variant="secondary" onClick={() => append({ kind: "VIDEO", mediaId: null, videoUrl: "", caption: null })}><Plus className="h-4 w-4" aria-hidden /> Add video</Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen("document")}><Plus className="h-4 w-4" aria-hidden /> Add brochure (PDF)</Button>
      </div>
      <MediaLibraryDialog
        open={open !== null}
        onClose={() => setOpen(null)}
        kind={open ?? "image"}
        multiple
        onSelect={(items) => {
          setKnown((k) => ({ ...k, ...Object.fromEntries(items.map((it) => [it.id, it])) }));
          for (const it of items) append({ kind: open === "document" ? "DOCUMENT" : "SCREENSHOT", mediaId: it.id, videoUrl: null, caption: it.alt ?? null });
        }}
      />
    </div>
  );
}
