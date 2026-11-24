"use client";

import { PILL_TRACK, pillTab } from "@/components/admin/list-panel";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ExternalLink, Lock, Plus, RotateCcw, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SortableList, moveItem } from "@/components/admin/sortable";
import { useServerAction } from "@/components/admin/use-action";
import { FormFields } from "@/components/site/form-fields";
import { FIELD_TYPES, FIELD_TYPE_LABEL, FORM_KEYS, FORM_META, isCustom, isLocked, resolveForm, type Answers, type FieldType, type FormDef, type FormField, type FormKey, type FormsSetting } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { INDIAN_CITIES } from "@/lib/cities";
import { saveSettingAction } from "../../settings/actions";

const HAS_PLACEHOLDER: FieldType[] = ["text", "textarea", "email", "url", "number", "select", "city"];
const HAS_OPTIONS: FieldType[] = ["select", "radio", "city"];
const NEEDS_OPTIONS: FieldType[] = ["select", "radio"];
const newId = () => `q_${Math.random().toString(36).slice(2, 8)}`;

export function FormsEditor({ saved, initialForm, companySizes, requireCompany, consentText, enquiry }: { saved: FormsSetting; initialForm: FormKey; companySizes: string[]; requireCompany: boolean; consentText: string; enquiry: { submitLabel: string; successMessage: string } }) {
  const build = (src: FormsSetting) => Object.fromEntries(FORM_KEYS.map((k) => [k, resolveForm(k, src[k], { companySizes: [], requireCompany })])) as Record<FormKey, FormDef>;
  const start = useMemo(() => build(saved), [saved]); // eslint-disable-line react-hooks/exhaustive-deps
  const [drafts, setDrafts] = useState(start);
  const [base, setBase] = useState(start);
  const [form, setForm] = useState<FormKey>(initialForm);
  const [open, setOpen] = useState<string | null>(null);
  const [newType, setNewType] = useState<FieldType>("text");
  const [askReset, setAskReset] = useState(false);
  const [preview, setPreview] = useState<Answers>({});
  const [compactPreview, setCompactPreview] = useState(false);
  const save = useServerAction(saveSettingAction, { success: "Forms saved — the website is updated", onSuccess: () => setBase(drafts) });

  const def = drafts[form];
  const dirty = JSON.stringify(drafts) !== JSON.stringify(base);
  const dirtyForms = FORM_KEYS.filter((k) => JSON.stringify(drafts[k]) !== JSON.stringify(base[k]));
  const setDef = (d: FormDef) => setDrafts((x) => ({ ...x, [form]: d }));
  const setField = (id: string, patch: Partial<FormField>) => setDef({ ...def, fields: def.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  const previewDef: FormDef = { ...def, fields: def.fields.map((f) => (f.id === "companySize" && !f.options.length ? { ...f, options: companySizes } : f)) };

  const addField = () => {
    const id = newId();
    const field: FormField = { id, type: newType, label: "New question", placeholder: "", hint: "", required: false, visible: true, options: NEEDS_OPTIONS.includes(newType) ? ["Option 1", "Option 2"] : [], width: newType === "textarea" || newType === "radio" ? "full" : "half", compact: false, multiple: false };
    setDef({ ...def, fields: [...def.fields, field] });
    setOpen(id);
  };

  // Every saved form is sent whole, so the website and the editor always agree.
  const payload = () => Object.fromEntries(FORM_KEYS.map((k) => [k, { ...drafts[k], fields: drafts[k].fields.map((f) => ({ ...f, label: f.label.trim() || (isCustom(k, f.id) ? "Question" : f.label) })) }]));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) void save.run({ key: "forms", value: payload() });
      }}
      className="space-y-4"
    >
      <div className={cn(PILL_TRACK, "flex-wrap")} role="tablist" aria-label="Forms">
        {FORM_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={form === k}
            onClick={() => { setForm(k); setOpen(null); setPreview({}); }}
            className={pillTab(form === k)}
          >
            {FORM_META[k].label}
            {dirtyForms.includes(k) && <span className="h-2 w-2 rounded-full bg-accent" title="Unsaved changes" />}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Fields */}
        <section className="rounded-panel border border-line bg-surface">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="font-semibold text-ink">{FORM_META[form].label}</h2>
              <p className="mt-0.5 text-sm text-muted">{FORM_META[form].description}</p>
            </div>
            <a href={FORM_META[form].url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-mint-ink hover:underline">
              See it on the website <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </div>

          <div className="p-4">
            <p className="mb-3 text-xs text-muted">Drag to change the order. Name, email and mobile number are always shown and required, because every lead needs them.</p>
            <SortableList
              items={def.fields}
              getId={(f) => f.id}
              onReorder={(fields) => setDef({ ...def, fields })}
              renderItem={(f, i, handle) => {
                const locked = isLocked(form, f.id);
                const custom = isCustom(form, f.id);
                const expanded = open === f.id;
                return (
                  <div className={cn("rounded-xl border bg-surface", expanded ? "border-mint shadow-sm" : "border-line", !f.visible && "bg-bg")}>
                    <div className="flex items-center gap-2 px-2 py-2">
                      {handle}
                      <button type="button" onClick={() => setOpen(expanded ? null : f.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={expanded}>
                        <span className={cn("truncate text-sm font-semibold", f.visible ? "text-ink" : "text-muted line-through")}>{f.label || "Question"}</span>
                        <span className="shrink-0 rounded bg-ink/[0.06] px-1.5 py-0.5 text-[11px] text-muted">{FIELD_TYPE_LABEL[f.type]}</span>
                        {f.required && f.visible && <Badge tone="primary">Required</Badge>}
                        {!f.visible && <Badge>Hidden</Badge>}
                        {custom ? <Badge tone="accent">Your question</Badge> : locked ? <Lock className="h-3.5 w-3.5 shrink-0 text-muted" aria-label="Always shown" /> : null}
                      </button>
                      <span className="flex shrink-0 items-center">
                        <button type="button" onClick={() => setDef({ ...def, fields: moveItem(def.fields, i, -1) })} disabled={i === 0} className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30" aria-label={`Move ${f.label} up`}><ArrowUp className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setDef({ ...def, fields: moveItem(def.fields, i, 1) })} disabled={i === def.fields.length - 1} className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30" aria-label={`Move ${f.label} down`}><ArrowDown className="h-4 w-4" /></button>
                        <button type="button" onClick={() => setOpen(expanded ? null : f.id)} className="rounded p-1 text-muted hover:bg-ink/5 hover:text-ink" aria-label={expanded ? "Close" : `Edit ${f.label}`}><ChevronDown className={cn("h-4 w-4 transition", expanded && "rotate-180")} /></button>
                      </span>
                    </div>
                    {expanded && (
                      <div className="space-y-4 border-t border-line px-4 py-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Label" htmlFor={`fe-${f.id}-label`}>
                            <Input id={`fe-${f.id}-label`} value={f.label} maxLength={160} onChange={(e) => setField(f.id, { label: e.target.value })} />
                          </Field>
                          {custom ? (
                            <Field label="Answer type" htmlFor={`fe-${f.id}-type`}>
                              <Select id={`fe-${f.id}-type`} value={f.type} onChange={(e) => { const type = e.target.value as FieldType; setField(f.id, { type, options: NEEDS_OPTIONS.includes(type) && !f.options.length ? ["Option 1", "Option 2"] : f.options }); }}>
                                {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>)}
                              </Select>
                            </Field>
                          ) : (
                            <Field label="Answer type" hint={locked ? "Saved in the lead's own field." : f.id === "message" || f.id === "about" ? "Shown as the lead's message." : "Saved with the lead."}>
                              <Input value={FIELD_TYPE_LABEL[f.type]} disabled />
                            </Field>
                          )}
                          {HAS_PLACEHOLDER.includes(f.type) && (
                            <Field label={f.type === "select" ? "Empty choice text" : "Example text inside the box"} htmlFor={`fe-${f.id}-ph`} hint={f.type === "select" ? "Empty = “Select”." : f.type === "city" ? "Empty = “Search your city”." : "Optional, shown in grey until they type."}>
                              <Input id={`fe-${f.id}-ph`} value={f.placeholder} maxLength={200} onChange={(e) => setField(f.id, { placeholder: e.target.value })} />
                            </Field>
                          )}
                          <Field label="Help text" htmlFor={`fe-${f.id}-hint`} hint="Optional, shown under the field." className={HAS_PLACEHOLDER.includes(f.type) ? undefined : "sm:col-span-2"}>
                            <Input id={`fe-${f.id}-hint`} value={f.hint} maxLength={400} onChange={(e) => setField(f.id, { hint: e.target.value })} />
                          </Field>
                          {HAS_OPTIONS.includes(f.type) && (
                            <Field label={f.type === "city" ? "Your own list of cities (optional)" : "Choices"} htmlFor={`fe-${f.id}-opts`} hint={f.type === "city" ? `One per line. Empty = ${INDIAN_CITIES.length} Indian cities, searchable by city or state; a city that isn’t listed can be typed in. With your own list only those cities can be picked.` : f.id === "companySize" ? "One per line. Empty = the company sizes in Website settings › Leads (shown as “… employees”)." : "One per line."} className="sm:col-span-2">
                              <Textarea id={`fe-${f.id}-opts`} rows={4} value={f.options.join("\n")} onChange={(e) => setField(f.id, { options: e.target.value.split("\n").map((o) => o.slice(0, 120)).slice(0, 50) })} onBlur={() => setField(f.id, { options: [...new Set(f.options.map((o) => o.trim()).filter(Boolean))] })} />
                            </Field>
                          )}
                          <Field label="Width" htmlFor={`fe-${f.id}-w`} hint="On wide screens two half-width fields sit side by side.">
                            <Select id={`fe-${f.id}-w`} value={f.width} onChange={(e) => setField(f.id, { width: e.target.value as FormField["width"] })}>
                              <option value="half">Half width</option>
                              <option value="full">Full width</option>
                            </Select>
                          </Field>
                        </div>
                        <div className="space-y-3 rounded-xl bg-bg p-3">
                          <Switch label="Show on the website" hint={locked ? "Always shown — every lead needs it." : undefined} checked={f.visible} disabled={locked} onChange={(e) => setField(f.id, { visible: e.target.checked })} />
                          <Switch label={f.type === "checkbox" ? "Must be ticked" : "Required"} hint={locked ? "Always required." : undefined} checked={f.required} disabled={locked} onChange={(e) => setField(f.id, { required: e.target.checked })} />
                          {f.type === "city" && <Switch label="Allow several cities" hint="For example “Cities you serve”." checked={f.multiple} onChange={(e) => setField(f.id, { multiple: e.target.checked })} />}
                          {form === "enquiry" && <Switch label="Show in the short form too" hint="The short version in product-page and city-page sidebars." checked={f.compact} disabled={locked} onChange={(e) => setField(f.id, { compact: e.target.checked })} />}
                        </div>
                        {custom && (
                          <button type="button" onClick={() => { setDef({ ...def, fields: def.fields.filter((x) => x.id !== f.id) }); setOpen(null); }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline">
                            <Trash2 className="h-4 w-4" aria-hidden /> Remove this question
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }}
            />

            <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-line p-3">
              <Field label="Add your own question" htmlFor="fe-new-type" className="min-w-[12rem] flex-1">
                <Select id="fe-new-type" value={newType} onChange={(e) => setNewType(e.target.value as FieldType)}>
                  {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>)}
                </Select>
              </Field>
              <Button size="sm" type="button" variant="secondary" onClick={addField} disabled={def.fields.length >= 40}><Plus className="h-4 w-4" aria-hidden /> Add field</Button>
            </div>
          </div>

          <div className="space-y-4 border-t border-line px-5 py-4">
            {form === "enquiry" ? (
              <p className="text-sm text-muted">
                Button text and the thank-you message: <Link href="/admin/settings?tab=labels" className="font-semibold text-mint-ink hover:underline">Website settings › Labels & messages</Link>. Consent text: <Link href="/admin/settings?tab=leads" className="font-semibold text-mint-ink hover:underline">Website settings › Leads</Link>.
              </p>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-ink">Button and thank-you message</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Button text" htmlFor="fe-submit"><Input id="fe-submit" value={def.submitLabel} maxLength={60} onChange={(e) => setDef({ ...def, submitLabel: e.target.value })} /></Field>
                  <Field label="Thank-you heading" htmlFor="fe-st"><Input id="fe-st" value={def.successTitle} maxLength={160} onChange={(e) => setDef({ ...def, successTitle: e.target.value })} /></Field>
                  <Field label="Thank-you text" htmlFor="fe-sx" className="sm:col-span-2"><Textarea id="fe-sx" rows={2} value={def.successText} maxLength={600} onChange={(e) => setDef({ ...def, successText: e.target.value })} /></Field>
                </div>
                <p className="text-xs text-muted">Consent text: <Link href="/admin/settings?tab=leads" className="font-semibold text-mint-ink hover:underline">Website settings › Leads</Link>.</p>
              </>
            )}
          </div>
        </section>

        {/* Live preview */}
        <section className="rounded-panel border border-line bg-surface xl:sticky xl:top-20">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
            <h2 className="font-semibold text-ink">Preview</h2>
            {form === "enquiry" && (
              <span className="inline-flex rounded-full border border-line p-0.5 text-xs font-semibold">
                <button type="button" onClick={() => setCompactPreview(false)} className={cn("rounded-full px-3 py-1", !compactPreview ? "bg-ink text-surface" : "text-muted")}>Full form</button>
                <button type="button" onClick={() => setCompactPreview(true)} className={cn("rounded-full px-3 py-1", compactPreview ? "bg-ink text-surface" : "text-muted")}>Short form</button>
              </span>
            )}
          </div>
          <div className={cn("p-5", compactPreview && form === "enquiry" && "mx-auto max-w-sm")}>
            <div className="pointer-events-auto space-y-4" aria-label="Form preview">
              <FormFields def={previewDef} values={preview} errors={{}} onChange={(id, v) => setPreview((x) => ({ ...x, [id]: v }))} idPrefix="pv" compact={form === "enquiry" && compactPreview} />
              <Checkbox label={consentText} disabled />
              <div className="flex h-12 w-full items-center justify-center rounded-control bg-accent text-base font-semibold text-accent-fg">{form === "enquiry" ? enquiry.submitLabel : def.submitLabel}</div>
            </div>
            <p className="mt-3 text-xs text-muted">You can type in the preview to try it; nothing is sent.</p>
          </div>
        </section>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 rounded-panel border border-line bg-surface/95 px-4 py-3 shadow-[0_-12px_30px_-24px_rgb(16_24_40/0.5)] backdrop-blur">
        <Button size="sm" type="submit" loading={save.pending} disabled={!dirty}>Save</Button>
        {dirty && (
          <Button size="sm" type="button" variant="secondary" onClick={() => { setDrafts(base); setOpen(null); }} disabled={save.pending}>
            <Undo2 className="h-4 w-4" aria-hidden /> Discard changes
          </Button>
        )}
        <Button size="sm" type="button" variant="ghost" onClick={() => setAskReset(true)}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Restore the default {FORM_META[form].label.toLowerCase()}
        </Button>
        <span className="text-sm text-muted">{dirty ? `Unsaved changes in ${dirtyForms.map((k) => FORM_META[k].label).join(", ")}` : "All changes saved"}</span>
      </div>

      <ConfirmDialog
        open={askReset}
        onClose={() => setAskReset(false)}
        title={`Restore the default ${FORM_META[form].label.toLowerCase()}?`}
        confirmLabel="Restore defaults"
        tone="primary"
        onConfirm={() => { setDef(resolveForm(form, undefined, { companySizes: [], requireCompany })); setOpen(null); setAskReset(false); }}
      >
        The built-in fields, wording and order come back and your own questions are removed from this form. Nothing changes on the website until you save.
      </ConfirmDialog>
    </form>
  );
}
