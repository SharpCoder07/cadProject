import Link from "next/link";
import { Handshake } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Panel, PanelHeader } from "@/components/ui/misc";

/**
 * Read-only: the resellers this enquiry was shared with. Sharing is automatic — every active reseller
 * of the enquired products gets the lead in their portal and an email when it arrives.
 */
export function ResellerPanel({ rows }: { rows: { createdAt: Date; reseller: { id: string; name: string; city: string | null } }[] }) {
  return (
    <Panel>
      <PanelHeader title={<span className="flex items-center gap-2"><Handshake className="h-4 w-4 text-muted" aria-hidden />Shared with resellers</span>} />
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted">No reseller sells the enquired products yet, so this lead stayed with your team.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {rows.map((r) => (
            <li key={r.reseller.id} className="px-4 py-2.5">
              <Link href={`/admin/resellers/${r.reseller.id}`} className="font-medium hover:text-mint-ink">{r.reseller.name}</Link>
              <span className="block text-xs text-muted">{[r.reseller.city, formatDateTime(r.createdAt)].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Shared automatically with every reseller of these products. Contact details stay hidden until they buy a plan.</p>
    </Panel>
  );
}
