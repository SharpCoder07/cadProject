/**
 * Website forms built from settings (Admin › Pages › Forms): the enquiry form and the two partner
 * application forms. Each form has built-in fields (saved into the lead's own columns) and any number
 * of custom fields (added to the lead's message as “Label: answer” lines). Shared by the website,
 * the admin editor and the /api/leads route, so the same rules check answers in the browser and on the server.
 */
import { z } from "zod";
import { phoneProblem, splitPhone } from "@/lib/countries";
import { splitCities } from "@/lib/cities";
import type { T } from "@/lib/site-texts";

export const FORM_KEYS = ["enquiry", "listSoftware", "becomeReseller"] as const;
export type FormKey = (typeof FORM_KEYS)[number];

export const FIELD_TYPES = ["text", "textarea", "email", "phone", "url", "number", "select", "radio", "checkbox", "date", "city"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email",
  phone: "Phone number",
  url: "Website address",
  number: "Number",
  select: "Drop-down",
  radio: "Choice buttons",
  checkbox: "Tick box",
  date: "Date",
  city: "City (searchable list)",
};

/** Lead column a built-in field fills. Fields without one are added to the message. */
type Column = "name" | "email" | "phone" | "company" | "companySize" | "city" | "message" | "requirement";

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder: string;
  hint: string;
  required: boolean;
  visible: boolean;
  /** Drop-down / choice options, one per entry. */
  options: string[];
  width: "half" | "full";
  /** Enquiry form only: also shown in the short form in sidebars. */
  compact: boolean;
  /** City field: several cities can be picked (saved as “Delhi, Noida”). */
  multiple: boolean;
}

export interface FormDef {
  fields: FormField[];
  /** Partner forms: button text and thank-you message (the enquiry form uses Labels & messages). */
  submitLabel: string;
  successTitle: string;
  successText: string;
}

interface BuiltIn {
  field: Omit<FormField, "id">;
  column?: Column;
  /** Always shown and required (the lead can't be saved or followed up without it). */
  locked?: boolean;
  /** Prefix for the requirement line, e.g. “Wants to list: ”. */
  prefix?: string;
}

const f = (type: FieldType, label: string, o: Partial<Omit<FormField, "id" | "type" | "label">> = {}): Omit<FormField, "id"> => ({
  type, label, placeholder: "", hint: "", required: false, visible: true, options: [], width: "half", compact: true, multiple: false, ...o,
});

const CONTACT = (company: string, companyRequired: boolean): Record<string, BuiltIn> => ({
  name: { field: f("text", "Your name", { required: true }), column: "name", locked: true },
  email: { field: f("email", "Work email", { required: true }), column: "email", locked: true },
  phone: { field: f("phone", "Mobile number", { required: true }), column: "phone", locked: true },
  company: { field: f("text", company, { required: companyRequired }), column: "company" },
});

export const BUILT_INS: Record<FormKey, Record<string, BuiltIn>> = {
  enquiry: {
    name: { field: f("text", "Your name", { required: true }), column: "name", locked: true },
    phone: { field: f("phone", "Mobile number", { required: true }), column: "phone", locked: true },
    email: { field: f("email", "Work email", { required: true }), column: "email", locked: true },
    company: { field: f("text", "Company"), column: "company" },
    companySize: { field: f("select", "Team size", { compact: false, hint: "" }), column: "companySize" },
    city: { field: f("city", "City", { compact: false }), column: "city" },
    message: { field: f("textarea", "What do you need?", { width: "full", placeholder: "E.g. GST billing for 3 branches, 10 users" }), column: "message" },
  },
  listSoftware: {
    ...CONTACT("Company name", true),
    website: { field: f("url", "Company website", { required: true, placeholder: "yourcompany.com" }) },
    product: { field: f("text", "Product name", { required: true, placeholder: "e.g. Ledgerline Books" }), column: "requirement", prefix: "Wants to list: " },
    category: { field: f("text", "Category", { width: "full", hint: "Optional, e.g. Accounting, HR & Payroll, CAD" }) },
    about: { field: f("textarea", "Tell us about your product", { width: "full", hint: "Optional. Who it's for, key features, pricing model." }), column: "message" },
  },
  becomeReseller: {
    ...CONTACT("Company name", true),
    website: { field: f("url", "Company website", { placeholder: "yourcompany.com" }) },
    city: { field: f("city", "Cities you serve", { required: true, multiple: true, hint: "Pick every city you serve." }), column: "city" },
    product: { field: f("text", "Software or brands you sell", { required: true, width: "full", hint: "e.g. Tally, Zoho, AutoCAD. Mention any partner level you hold." }), column: "requirement", prefix: "Reseller for: " },
    about: { field: f("textarea", "Tell us about your company", { width: "full", hint: "Optional. Team size, years in business, services you offer (installation, training, support)." }), column: "message" },
  },
};

export const FORM_META: Record<FormKey, { label: string; description: string; url: string; source: "PRODUCT_PAGE" | "LIST_SOFTWARE" | "BECOME_RESELLER"; defaults: Omit<FormDef, "fields"> }> = {
  enquiry: {
    label: "Enquiry form",
    description: "“Get free quote” pop-up, the form on product, city and contact pages, and the Enquiry form block.",
    url: "/contact-us",
    source: "PRODUCT_PAGE",
    defaults: { submitLabel: "", successTitle: "", successText: "" },
  },
  listSoftware: {
    label: "List your software",
    description: "Application form on /list-your-software.",
    url: "/list-your-software",
    source: "LIST_SOFTWARE",
    defaults: { submitLabel: "Send request", successTitle: "Thanks, we've got your request", successText: "Our partnerships team will review your details and get back to you within two business days. We've emailed you a copy." },
  },
  becomeReseller: {
    label: "Become a reseller",
    description: "Application form on /become-a-reseller.",
    url: "/become-a-reseller",
    source: "BECOME_RESELLER",
    defaults: { submitLabel: "Apply now", successTitle: "Thanks, we've got your request", successText: "Our partnerships team will review your application and get back to you within two business days. We've emailed you a copy." },
  },
};

// ─── Saved shape (settings key `forms`) ───────────────────────────────────────

const fieldSchema = z.object({
  id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,40}$/),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().max(160).default(""),
  placeholder: z.string().max(200).default(""),
  hint: z.string().max(400).default(""),
  required: z.boolean().default(false),
  visible: z.boolean().default(true),
  options: z.array(z.string().trim().max(120)).max(50).default([]),
  width: z.enum(["half", "full"]).default("half"),
  compact: z.boolean().default(true),
  multiple: z.boolean().default(false),
});

export const formDefSchema = z.object({
  fields: z.array(fieldSchema).max(40).default([]),
  submitLabel: z.string().max(60).default(""),
  successTitle: z.string().max(160).default(""),
  successText: z.string().max(600).default(""),
});

export const formsSettingSchema = z
  .object({ enquiry: formDefSchema.optional(), listSoftware: formDefSchema.optional(), becomeReseller: formDefSchema.optional() })
  .default({});
export type FormsSetting = z.infer<typeof formsSettingSchema>;

export const isCustom = (form: FormKey, id: string) => !(id in BUILT_INS[form]);
export const isLocked = (form: FormKey, id: string) => Boolean(BUILT_INS[form][id]?.locked);

/**
 * The form as the website shows it: saved order and wording, with every built-in field present
 * (a missing one is added at the end), built-in types fixed, and name/email/phone always shown and required.
 */
export function resolveForm(form: FormKey, saved: z.input<typeof formDefSchema> | undefined, extra: { companySizes?: string[]; requireCompany?: boolean } = {}): FormDef {
  const parsed = formDefSchema.safeParse(saved ?? {});
  const s = parsed.success ? parsed.data : formDefSchema.parse({});
  const built = BUILT_INS[form];
  const seen = new Set<string>();
  const fields: FormField[] = [];
  for (const x of s.fields) {
    if (seen.has(x.id)) continue;
    seen.add(x.id);
    const b = built[x.id];
    if (b) {
      fields.push({ ...x, type: b.field.type, label: x.label || b.field.label, ...(b.locked ? { visible: true, required: true } : {}) });
    } else if (x.label) {
      fields.push(x);
    }
  }
  // Not set up yet: built-in defaults (the old “Require company name” switch still decides the enquiry form's company field).
  for (const [id, b] of Object.entries(built)) if (!seen.has(id)) fields.push({ id, ...b.field, ...(form === "enquiry" && id === "company" && extra.requireCompany ? { required: true } : {}) });
  for (const x of fields) {
    if (x.id === "companySize" && x.options.length === 0) x.options = extra.companySizes ?? [];
  }
  const d = FORM_META[form].defaults;
  return { fields, submitLabel: s.submitLabel || d.submitLabel, successTitle: s.successTitle || d.successTitle, successText: s.successText || d.successText };
}

// ─── Answers ──────────────────────────────────────────────────────────────────

export type Answers = Record<string, string | boolean>;

export const answersSchema = z.record(z.string().max(60), z.union([z.string().max(4000), z.boolean()])).refine((o) => Object.keys(o).length <= 60);

export function normaliseUrl(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.hostname.includes(".") ? u.toString().replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

const LIMIT: Partial<Record<FieldType, number>> = { textarea: 2000, text: 200, email: 200, url: 300, city: 600 };

/** Checks answers against the form. Returns error messages by field id (empty when all is well) and the cleaned answers. */
export function checkAnswers(def: FormDef, answers: Answers, t: T, { compact = false }: { compact?: boolean } = {}): { errors: Record<string, string>; clean: Record<string, string> } {
  const errors: Record<string, string> = {};
  const clean: Record<string, string> = {};
  for (const fd of def.fields) {
    if (!fd.visible || (compact && !fd.compact)) continue;
    const raw = answers[fd.id];
    if (fd.type === "checkbox") {
      const on = raw === true || raw === "true" || raw === "on";
      if (fd.required && !on) errors[fd.id] = t("forms.errTick");
      clean[fd.id] = on ? t("forms.yes") : "";
      continue;
    }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (!v) {
      if (fd.required) errors[fd.id] = fd.type === "select" || fd.type === "radio" ? t("forms.errChoose") : t("forms.errRequired", { label: fd.label });
      continue;
    }
    const max = LIMIT[fd.type] ?? 200;
    if (v.length > max) { errors[fd.id] = t("forms.errTooLong", { max }); continue; }
    switch (fd.type) {
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errors[fd.id] = t("forms.errEmail");
        break;
      case "phone": {
        const { country, national } = splitPhone(v);
        const problem = phoneProblem(country, national, { mobile: fd.id === "phone" });
        if (problem) errors[fd.id] = problem;
        else { clean[fd.id] = `+${country.dial}${national}`; continue; }
        break;
      }
      case "url": {
        const u = normaliseUrl(v);
        if (!u) errors[fd.id] = t("forms.errUrl");
        else { clean[fd.id] = u; continue; }
        break;
      }
      case "number":
        if (!/^-?\d+(\.\d+)?$/.test(v.replace(/,/g, ""))) errors[fd.id] = t("forms.errNumber");
        break;
      case "date":
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[fd.id] = t("forms.errDate");
        break;
      case "select":
      case "radio":
        if (fd.options.length && !fd.options.includes(v)) errors[fd.id] = t("forms.errChoose");
        break;
      case "city": {
        // Own list: only those cities. Built-in list: any city name (a missing one can be typed in).
        const cities = fd.multiple ? splitCities(v) : [v];
        if (fd.options.length && cities.some((c) => !fd.options.includes(c))) errors[fd.id] = t("forms.errChoose");
        else if (cities.length > 15 || cities.some((c) => c.length > 80)) errors[fd.id] = t("forms.errTooLong", { max: 80 });
        else { clean[fd.id] = cities.join(", "); continue; }
        break;
      }
    }
    clean[fd.id] = v;
  }
  return { errors, clean };
}

/** Turns checked answers into the lead's columns; other answers become “Label: answer” lines in the message. */
export function answersToLead(form: FormKey, def: FormDef, clean: Record<string, string>) {
  const built = BUILT_INS[form];
  const cols: Partial<Record<Column, string>> = {};
  const lines: string[] = [];
  let note = "";
  for (const fd of def.fields) {
    const v = clean[fd.id];
    if (!v) continue;
    const col = built[fd.id]?.column;
    if (col === "message") note = v;
    else if (col === "requirement") cols.requirement = `${built[fd.id]!.prefix ?? ""}${v}`.slice(0, 200);
    else if (col === "city" && v.length > 80) { cols.city = `${v.slice(0, 77)}…`; lines.push(`${fd.label}: ${v}`); }
    else if (col) cols[col] = v;
    else lines.push(`${fd.label}: ${v}`);
  }
  const message = [lines.join("\n"), note].filter(Boolean).join(lines.length && note ? "\n\n" : "").slice(0, 4000);
  return {
    name: (cols.name ?? "").slice(0, 100),
    email: cols.email ?? "",
    phone: cols.phone ?? "",
    company: cols.company?.slice(0, 120) || null,
    companySize: cols.companySize?.slice(0, 40) || null,
    city: cols.city?.slice(0, 80) || null,
    requirement: cols.requirement || null,
    message: message || null,
  };
}
