"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhoneInput } from "@/components/ui/phone-input";
import { CitySelect } from "@/components/ui/city-select";
import { resolveForm, type Answers, type FormDef, type FormField, type FormKey, type FormsSetting } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { useT } from "./texts";

const Ctx = createContext<{ forms: FormsSetting; companySizes: string[]; requireCompany: boolean }>({ forms: {}, companySizes: [], requireCompany: false });

/** Gives the website's forms their saved set-up (Admin › Pages › Forms). */
export function FormsProvider({ forms, companySizes, requireCompany, children }: { forms: FormsSetting; companySizes: string[]; requireCompany: boolean; children: ReactNode }) {
  const value = useMemo(() => ({ forms, companySizes, requireCompany }), [forms, companySizes, requireCompany]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** One form as the website shows it. */
export function useFormDef(form: FormKey): FormDef {
  const { forms, companySizes, requireCompany } = useContext(Ctx);
  return useMemo(() => resolveForm(form, forms[form], { companySizes, requireCompany }), [form, forms, companySizes, requireCompany]);
}

/**
 * The fields of a form, in their saved order. `compact` (sidebars) shows only the fields marked
 * “Show in short forms” and puts every field on its own row.
 */
export function FormFields({ def, values, errors, onChange, idPrefix, compact = false, placeholders = {} }: { def: FormDef; values: Answers; errors: Record<string, string | undefined>; onChange: (id: string, value: string | boolean) => void; idPrefix: string; compact?: boolean; placeholders?: Record<string, string | undefined> }) {
  const t = useT();
  const shown = def.fields.filter((f) => f.visible && (!compact || f.compact));
  return (
    <div className={cn("grid gap-4", !compact && "sm:grid-cols-2")}>
      {shown.map((f) => (
        <FieldControl key={f.id} f={f} id={`${idPrefix}-${f.id}`} value={values[f.id]} error={errors[f.id]} onChange={(v) => onChange(f.id, v)} placeholder={placeholders[f.id] || f.placeholder} t={t} className={!compact && (f.width === "full" || f.type === "textarea" || f.type === "radio") ? "sm:col-span-2" : undefined} />
      ))}
    </div>
  );
}

function FieldControl({ f, id, value, error, onChange, placeholder, t, className }: { f: FormField; id: string; value: string | boolean | undefined; error?: string; onChange: (v: string | boolean) => void; placeholder: string; t: ReturnType<typeof useT>; className?: string }) {
  const str = typeof value === "string" ? value : "";
  const common = { id, "aria-invalid": !!error || undefined, "aria-describedby": error ? `${id}-error` : undefined };
  const auto: Partial<Record<string, string>> = { name: "name", email: "email", company: "organization", city: "address-level2", website: "url" };
  if (f.type === "checkbox") {
    return (
      <div className={className}>
        <Checkbox id={id} label={<>{f.label}{f.required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}</>} hint={f.hint || undefined} checked={value === true} onChange={(e) => onChange(e.target.checked)} aria-invalid={!!error || undefined} />
        {error && <p className="mt-1 text-xs text-danger" role="alert" id={`${id}-error`}>{error}</p>}
      </div>
    );
  }
  let control: ReactNode;
  switch (f.type) {
    case "textarea":
      control = <Textarea {...common} rows={3} maxLength={2000} placeholder={placeholder || undefined} value={str} onChange={(e) => onChange(e.target.value)} />;
      break;
    case "phone":
      control = <PhoneInput id={id} value={str} onChange={(v) => onChange(v)} invalid={!!error} />;
      break;
    case "city":
      control = (
        <CitySelect
          id={id}
          value={str}
          onChange={(v) => onChange(v)}
          options={f.options}
          multiple={f.multiple}
          placeholder={placeholder}
          invalid={!!error}
          labels={{ search: t(f.multiple ? "forms.citiesSearch" : "forms.citySearch"), other: (q) => t("forms.cityOther", { city: q }), none: t("forms.cityNone"), remove: (c) => t("forms.cityRemove", { city: c }) }}
        />
      );
      break;
    case "select":
      control = (
        <Select {...common} value={str} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder || t("forms.select")}</option>
          {f.options.map((o) => <option key={o} value={o}>{f.id === "companySize" ? t("forms.sizeOption", { size: o }) : o}</option>)}
        </Select>
      );
      break;
    case "radio":
      control = (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-2">
          {f.options.map((o) => (
            <label key={o} className={cn("inline-flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 text-sm", str === o ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface text-ink hover:border-primary/40")}>
              <input type="radio" name={id} value={o} checked={str === o} onChange={() => onChange(o)} className="h-4 w-4 border-line text-primary" />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    default:
      control = (
        <Input
          {...common}
          type={f.type === "email" ? "email" : f.type === "date" ? "date" : f.type === "number" ? "text" : "text"}
          inputMode={f.type === "number" ? "decimal" : f.type === "url" ? "url" : undefined}
          autoComplete={auto[f.id]}
          maxLength={f.type === "url" ? 300 : 200}
          placeholder={placeholder || undefined}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
  return (
    <Field label={<span id={`${id}-label`}>{f.label}</span>} htmlFor={f.type === "radio" ? undefined : id} hint={f.hint || undefined} error={error} required={f.required} className={className}>
      {control}
    </Field>
  );
}
