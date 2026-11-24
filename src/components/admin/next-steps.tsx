import { Panel, PanelHeader } from "@/components/ui/misc";

/** Side panel on "Add vendor" / "Add reseller": what happens after the company is created. */
export function NextSteps({ title = "What happens next", steps, note }: { title?: string; steps: { title: string; text: string }[]; note?: string }) {
  return (
    <Panel>
      <PanelHeader title={title} />
      <ol className="space-y-4 p-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mint-soft text-xs font-semibold text-mint-ink">{i + 1}</span>
            <span className="text-sm">
              <span className="block font-medium text-ink">{s.title}</span>
              <span className="mt-0.5 block text-muted">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
      {note && <p className="border-t border-line px-5 py-3 text-xs text-muted">{note}</p>}
    </Panel>
  );
}
