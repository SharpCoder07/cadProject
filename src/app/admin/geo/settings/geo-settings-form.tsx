"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch, Textarea } from "@/components/ui/field";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { useServerAction } from "@/components/admin/use-action";
import { saveGeoSettingsAction } from "../actions";

interface GeoSettings {
  enabled: boolean;
  productRouteBase: string;
  template: { hero: string; introduction: string; guide: string; faqs: { question: string; answer: string }[] };
}

const TOKENS = ["{{name}}", "{{city}}", "{{state}}", "{{country}}", "{{site_name}}"];

export function GeoSettingsForm({ initial }: { initial: GeoSettings }) {
  const [f, setF] = useState(initial);
  const save = useServerAction(saveGeoSettingsAction);
  const t = f.template;
  const setT = (patch: Partial<GeoSettings["template"]>) => setF({ ...f, template: { ...t, ...patch } });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save.run({ ...f, template: { ...t, faqs: t.faqs.filter((x) => x.question.trim() && x.answer.trim()) } }); }}>
      <Panel>
        <PanelHeader title="Routes" />
        <div className="space-y-4 p-5">
          <Switch label={<span className="font-medium">Enable geo routes</span>} hint="When off, every geo page returns “not found”." checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />
          <Field label="Product route base" htmlFor="geo-base" error={save.fieldErrors.productRouteBase?.[0]} hint={`Product geo pages live at /gurugram/${f.productRouteBase || "software"}/autocad. Brand geo pages use clean URLs such as /gurugram/autodesk.`}>
            <Input id="geo-base" value={f.productRouteBase} onChange={(e) => setF({ ...f, productRouteBase: e.target.value.toLowerCase() })} maxLength={40} />
          </Field>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Generic template" description={<>Used by sections set to “Inherit when empty”. Tokens: {TOKENS.map((x) => <code key={x} className="mx-0.5 rounded bg-bg px-1 text-xs">{x}</code>)}</>} />
        <div className="space-y-4 p-5">
          <Field label="Top banner text" htmlFor="geo-hero"><Textarea id="geo-hero" rows={2} value={t.hero} maxLength={400} onChange={(e) => setT({ hero: e.target.value })} /></Field>
          <Field label="Introduction" htmlFor="geo-intro"><Textarea id="geo-intro" rows={4} value={t.introduction} maxLength={4000} onChange={(e) => setT({ introduction: e.target.value })} /></Field>
          <Field label="Buying guide" htmlFor="geo-guide"><Textarea id="geo-guide" rows={4} value={t.guide} maxLength={6000} onChange={(e) => setT({ guide: e.target.value })} /></Field>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">FAQs</p>
              <Button size="sm" variant="secondary" onClick={() => setT({ faqs: [...t.faqs, { question: "", answer: "" }] })}><Plus className="h-3.5 w-3.5" aria-hidden /> Add FAQ</Button>
            </div>
            {t.faqs.map((q, i) => (
              <div key={i} className="grid gap-2 rounded-lg bg-bg p-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Input value={q.question} onChange={(e) => setT({ faqs: t.faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)) })} placeholder="Question" aria-label={`FAQ ${i + 1} question`} />
                  <Textarea rows={2} value={q.answer} onChange={(e) => setT({ faqs: t.faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)) })} placeholder="Answer" aria-label={`FAQ ${i + 1} answer`} />
                </div>
                <button type="button" onClick={() => setT({ faqs: t.faqs.filter((_, j) => j !== i) })} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Remove FAQ ${i + 1}`}><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end border-t border-line px-5 py-4">
          <Button size="sm" type="submit" loading={save.pending}>Save changes</Button>
        </div>
      </Panel>
    </form>
  );
}
