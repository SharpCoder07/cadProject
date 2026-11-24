"use client";

import { useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { BlockForm } from "@/components/admin/blocks/block-form";
import type { BlockField } from "@/components/admin/blocks/block-fields";
import { useServerAction } from "@/components/admin/use-action";
import type { SettingKey } from "@/server/settings/schemas";
import { saveSettingAction } from "./actions";
import { ThemePreview } from "./theme-preview";
import { THEME_PRESETS, presetValues, type ThemePreset } from "@/lib/theme-presets";

/**
 * One settings tab. "Discard changes" puts back what is saved; when `defaults` is given (Website
 * design), "Restore default design" saves the built-in defaults after asking.
 */
export function SettingsForm({ settingKey, fields, initial, defaults, resetLabel = "Restore defaults", preview, children }: { settingKey: SettingKey; fields: BlockField[]; initial: Record<string, unknown>; defaults?: Record<string, unknown>; resetLabel?: string; /** "theme": live preview beside the fields. */ preview?: "theme"; children?: React.ReactNode }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [version, setVersion] = useState(0);
  const [askReset, setAskReset] = useState(false);
  const [preset, setPreset] = useState<ThemePreset | null>(null);
  // Ready-made colour themes: applied to the form and saved, so the website changes straight away.
  const applyPreset = useServerAction(saveSettingAction, {
    success: () => `${preset?.name ?? "Theme"} applied — the website uses its colours now`,
    onSuccess: () => {
      const next = { ...saved, ...presetValues(preset!) };
      setValue(next);
      setSaved(next);
      setDirty(false);
      setVersion((v) => v + 1);
      setPreset(null);
    },
  });
  const save = useServerAction(saveSettingAction, { onSuccess: () => { setDirty(false); setSaved(value); } });
  const reset = useServerAction(saveSettingAction, {
    success: "Default design restored — the site is updated",
    onSuccess: () => {
      setValue(defaults!);
      setSaved(defaults!);
      setDirty(false);
      setVersion((v) => v + 1);
      setAskReset(false);
    },
  });
  const discard = () => {
    setValue(saved);
    setDirty(false);
    setVersion((v) => v + 1); // rebuild the fields so every input shows the saved value again
  };
  const isDefault = defaults ? JSON.stringify(saved) === JSON.stringify({ ...saved, ...defaults }) : true;
  const errors = Object.entries(save.fieldErrors);
  return (
    <form onSubmit={(e) => { e.preventDefault(); void save.run({ key: settingKey, value }); }} className="space-y-5">
      {preview === "theme" && (
        <div className="rounded-panel border border-line p-4">
          <p className="text-sm font-semibold text-ink">Ready-made themes and designs</p>
          <p className="text-xs text-muted">A theme sets colours, fonts and corners; Fresh Lime Design switches the whole website's look as well, in Lime or Teal colours. Your pages and content stay the same. To go back, choose Classic under “Website design” (or “{resetLabel}”).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {THEME_PRESETS.map((p, _i, all) => {
              // "In use": every value the preset sets matches. A colour-only theme that shares its colours with a whole-site
              // design preset (Lime & Forest Green Color theme / Fresh Lime Design) steps back when that design is in use,
              // so only one of them is marked.
              const matches = (q: (typeof all)[number]) => Object.entries(presetValues(q)).every(([k, c]) => String(saved[k] ?? "").toLowerCase() === c.toLowerCase());
              const presetActive = (q: (typeof all)[number]) => matches(q) && (q.design?.design ? true : !all.some((d) => d !== q && d.design?.design && matches(d)));
              const active = presetActive(p);
              return (
                <button key={p.key} type="button" onClick={() => setPreset(p)} title={p.description} className="inline-flex items-center gap-2.5 rounded-control border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition hover:border-primary">
                  <span className="flex -space-x-1" aria-hidden>
                    {[p.colors.primary, p.colors.accent, p.colors.ink, p.colors.background].map((c) => <span key={c} className="h-5 w-5 rounded-full border border-white shadow-sm" style={{ background: c }} />)}
                  </span>
                  {p.name}
                  {active && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] text-success">In use</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {preview === "theme" ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <BlockForm key={version} fields={fields} value={value} idPrefix={settingKey} onChange={(v) => { setValue(v); setDirty(true); }} />
          <div className="xl:sticky xl:top-24">
            <ThemePreview theme={value as unknown as Parameters<typeof ThemePreview>[0]["theme"]} />
          </div>
        </div>
      ) : (
        <BlockForm key={version} fields={fields} value={value} idPrefix={settingKey} onChange={(v) => { setValue(v); setDirty(true); }} />
      )}
      {errors.length > 0 && <ul className="space-y-1 text-xs text-danger">{errors.map(([k, v]) => <li key={k}>{k}: {v[0]}</li>)}</ul>}
      {children}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button size="sm" type="submit" loading={save.pending} disabled={!dirty}>Save</Button>
        {dirty && (
          <Button size="sm" variant="secondary" onClick={discard} disabled={save.pending}>
            <Undo2 className="h-4 w-4" aria-hidden /> Discard changes
          </Button>
        )}
        {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
        {defaults && (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAskReset(true)} disabled={save.pending || reset.pending || (isDefault && !dirty)} title={isDefault && !dirty ? "Already using the default design" : undefined}>
            <RotateCcw className="h-4 w-4" aria-hidden /> {resetLabel}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={preset !== null}
        onClose={() => setPreset(null)}
        onConfirm={() => preset && void applyPreset.run({ key: settingKey, value: { ...saved, ...presetValues(preset) } })}
        busy={applyPreset.pending}
        tone="primary"
        title={`Apply ${preset?.name ?? ""} to the website?`}
        confirmLabel={`Apply ${preset?.name ?? ""}`}
      >
        <p>{preset?.description}</p>
        {preset && (
          <ul className="mt-3 grid grid-cols-3 gap-2 text-xs">
            {Object.entries(preset.colors).map(([k, c]) => (
              <li key={k} className="flex items-center gap-1.5"><span className="h-4 w-4 rounded border border-line" style={{ background: c }} aria-hidden /> {k} <code className="text-muted">{c}</code></li>
            ))}
          </ul>
        )}
        {preset?.design && <p className="mt-2 text-xs text-muted">Also: {[preset.design.displayFont && `heading font ${preset.design.displayFont}`, preset.design.bodyFont && `body font ${preset.design.bodyFont}`, preset.design.radius && `${preset.design.radius} corners`, preset.design.announcementColor === "accent" && "announcement bar in the accent colour", preset.design.design === "design1" && "the Fresh Lime Design website layout and styles", preset.design.animations && `${preset.design.animations} animations`].filter(Boolean).join(", ")}.</p>}
        {dirty && <p className="mt-3 text-warning">Your unsaved changes on this tab are replaced.</p>}
      </ConfirmDialog>
      {defaults && (
        <ConfirmDialog
          open={askReset}
          onClose={() => setAskReset(false)}
          onConfirm={() => void reset.run({ key: settingKey, value: defaults })}
          busy={reset.pending}
          tone="primary"
          title={`${resetLabel}?`}
          confirmLabel={resetLabel}
        >
          Colours, fonts, corners, header style and the other design options go back to how they were when the site was installed, and the website updates straight away. Your logo, pages and content aren&apos;t affected.
        </ConfirmDialog>
      )}
    </form>
  );
}
