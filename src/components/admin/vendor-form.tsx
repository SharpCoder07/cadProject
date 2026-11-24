"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { formResolver } from "@/lib/form-resolver";
import type { z } from "zod";
import { vendorInput, type VendorInput } from "@/lib/validation/taxonomy";
import { slugify } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { MediaField } from "./media-picker";
import { PhoneInput } from "@/components/ui/phone-input";
import { SeoFields } from "./seo-fields";
import { useServerAction } from "./use-action";
import { saveVendorAction } from "@/app/admin/vendors/actions";

type Values = z.input<typeof vendorInput>;

/** Company profile form, shared by the admin and the vendor portal (portal hides SEO and admin-only switches). */
export function VendorForm({ id, defaults, logoPreview, mode = "staff", readOnly = false, kind = "VENDOR" }: { id: string | null; defaults: Values; logoPreview?: string | null; mode?: "staff" | "vendor"; readOnly?: boolean; kind?: "VENDOR" | "RESELLER" }) {
  const reseller = kind === "RESELLER";
  const router = useRouter();
  const { register, control, handleSubmit, setValue, watch, formState } = useForm<Values, unknown, VendorInput>({ resolver: formResolver(vendorInput), defaultValues: { ...defaults, kind: id ? undefined : kind } });
  const save = useServerAction(saveVendorAction, { onSuccess: (d) => !id && router.push(`/admin/${reseller ? "resellers" : "vendors"}/${d.id}`) });
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const e = formState.errors;
  return (
    <form onSubmit={handleSubmit((data) => void save.run({ id, data }))} className="space-y-6" noValidate>
      <fieldset disabled={readOnly} className="contents">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Company name" htmlFor="v-name" error={e.name?.message} required><Input id="v-name" {...register("name", { onChange: (ev) => !slugTouched && setValue("slug", slugify(ev.target.value)) })} /></Field>
        <Field label="URL slug" htmlFor="v-slug" error={e.slug?.message} hint={`/${reseller ? "resellers" : "vendors"}/${watch("slug") || "…"}`} required><Input id="v-slug" disabled={mode === "vendor"} {...register("slug", { onChange: () => setSlugTouched(true) })} /></Field>
        <Field label="Legal name" htmlFor="v-legal"><Input id="v-legal" {...register("legalName")} /></Field>
        <Field label="Website" htmlFor="v-web" error={e.website?.message}><Input id="v-web" type="url" {...register("website")} /></Field>
        <Field label="Email" htmlFor="v-email" error={e.email?.message} hint="Receives lead notifications when enabled."><Input id="v-email" type="email" {...register("email")} /></Field>
        <Field label="Phone" htmlFor="v-phone" error={e.phone?.message}><Controller control={control} name="phone" render={({ field }) => <PhoneInput id="v-phone" value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} invalid={!!e.phone} />} /></Field>
        <Field label="Address" htmlFor="v-addr"><Input id="v-addr" {...register("addressLine")} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="City" htmlFor="v-city"><Input id="v-city" {...register("city")} /></Field>
          <Field label="State" htmlFor="v-state"><Input id="v-state" {...register("state")} /></Field>
          <Field label="Country" htmlFor="v-country"><Input id="v-country" {...register("country")} /></Field>
        </div>
        <Field label="Founded" htmlFor="v-founded" error={e.foundedYear?.message}><Input id="v-founded" type="number" {...register("foundedYear", { setValueAs: (v) => (v === "" ? null : Number(v)) })} /></Field>
        <Field label="Employees" htmlFor="v-emp" hint="E.g. 201–500"><Input id="v-emp" {...register("employeeRange")} /></Field>
        <Field label="About the company" htmlFor="v-desc" className="md:col-span-2"><Textarea id="v-desc" rows={5} {...register("description")} /></Field>
        {reseller && (
          <Field label="Cities served" htmlFor="v-cities" className="md:col-span-2" hint="Comma separated, e.g. Delhi, Gurugram, Noida. Shown next to your name on product pages." error={e.serviceCities?.message}>
            <Controller
              control={control}
              name="serviceCities"
              render={({ field }) => <CitiesInput id="v-cities" value={field.value ?? []} onChange={field.onChange} />}
            />
          </Field>
        )}
        <Field label="Logo"><Controller control={control} name="logoId" render={({ field }) => <MediaField value={field.value} preview={logoPreview} onChange={field.onChange} label="Choose logo" />} /></Field>
        {mode === "staff" && (
          <div className="space-y-3 pt-6">
            <Switch label="Active" hint={reseller ? "Inactive resellers are hidden from product pages." : "Inactive vendors are hidden from vendor pages."} {...register("isActive")} />
            <Switch label={reseller ? "Reseller can receive leads you forward" : "Vendor can see its leads in the portal"} {...register("receivesLeads")} />
          </div>
        )}
      </div>
      {mode === "staff" && id && (
        <details className="group mt-6 rounded-control border border-line px-3 open:pb-4">
          <summary className="flex h-9 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold hover:text-mint-ink [&::-webkit-details-marker]:hidden">SEO for the {reseller ? "reseller" : "vendor"} page<ChevronDown className="h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" aria-hidden /></summary>
          <div className="mt-4"><SeoFields register={register} control={control} /></div>
        </details>
      )}
      </fieldset>
      {readOnly ? (
        <p className="text-sm text-muted">Your role can view the company profile but not propose changes.</p>
      ) : (
        <Button type="submit" size="sm" loading={save.pending} disabled={mode === "vendor" && !formState.isDirty}>{mode === "vendor" ? "Send changes for approval" : id ? "Save profile" : reseller ? "Create reseller" : "Create vendor"}</Button>
      )}
    </form>
  );
}

/** Comma-separated list input that keeps what's typed until the field loses focus. */
function CitiesInput({ id, value, onChange }: { id: string; value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  return (
    <Input
      id={id}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.split(",").map((c) => c.trim()).filter(Boolean));
      }}
      onBlur={() => setText(value.join(", "))}
      placeholder="Delhi, Gurugram, Noida"
    />
  );
}
