import Link from "next/link";
import type { listLeads } from "@/server/services/leads";
import { formatDateTime, relativeTime } from "@/lib/format";
import { LEAD_SOURCE_LABEL, LEAD_STATUS_LABEL, LEAD_TYPE_LABEL, type LeadTypeKey } from "@/lib/validation/leads";
import { Badge, type BadgeTone } from "@/components/ui/misc";
import { AdminTable } from "./page-header";
import { AllCheckbox, RowCheckbox } from "./bulk-table";
import { ContactValue, ViewNowButton } from "@/components/vendor/contact-lock";

const TONE: Record<string, BadgeTone> = { NEW: "accent", CONTACTED: "primary", QUALIFIED: "primary", DEMO_SCHEDULED: "primary", PROPOSAL: "primary", WON: "success", LOST: "neutral", SPAM: "danger" };
export const leadTone = (s: string) => TONE[s] ?? "neutral";
const TYPE_TONE: Record<LeadTypeKey, BadgeTone> = { ENQUIRY: "neutral", QUOTE: "accent", DEMO: "primary", TRIAL: "primary", PURCHASE: "success", CALLBACK: "warning", PARTNERSHIP: "neutral" };
/** Small badge for what the buyer asked for (enquiry, price quote, demo…). */
export const LeadTypeBadge = ({ type }: { type: LeadTypeKey }) => <Badge tone={TYPE_TONE[type] ?? "neutral"}>{LEAD_TYPE_LABEL[type] ?? type}</Badge>;

/** `vendorView` swaps staff columns (assignee, follow-up) for the buyer's contact details. */
export function LeadTable({ items, basePath, selectable, vendorView, bare }: { items: Awaited<ReturnType<typeof listLeads>>["items"]; basePath: string; selectable: boolean; vendorView?: boolean; bare?: boolean }) {
  return (
    <AdminTable minWidth={vendorView ? 56 : undefined} bare={bare}>
      <thead>
        <tr>
          {selectable && <th className="w-10"><AllCheckbox ids={items.map((i) => i.id)} /></th>}
          <th>Lead</th><th>Type</th>{vendorView && <th>Contact</th>}<th>Software</th><th>Status</th><th>Source</th>{!vendorView && <><th>Assigned</th><th>Follow-up</th></>}<th>Received</th>{vendorView && <th className="text-right">Details</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((l) => {
          const due = l.nextFollowUpAt && l.nextFollowUpAt < new Date();
          return (
            <tr key={l.id} className="hover:bg-bg">
              {selectable && <td><RowCheckbox id={l.id} label={l.name} /></td>}
              <td>
                <Link href={`${basePath}/${l.id}`} className="font-medium hover:text-mint-ink">{l.name}</Link>
                {l.priority === "HIGH" && <Badge tone="danger" className="ml-2">High</Badge>}
                <span className="block text-xs text-muted">{vendorView ? l.company ?? "—" : l.company ?? l.email} · {l.referenceNo}</span>
              </td>
              <td><LeadTypeBadge type={l.type} /></td>
              {vendorView && (
                <td className="space-y-1 text-sm">
                  <div><ContactValue kind="email" value={l.email} locked={l.contactLocked} compact /></div>
                  <div><ContactValue kind="phone" value={l.phone} locked={l.contactLocked} compact /></div>
                </td>
              )}
              <td className="max-w-[12rem] truncate text-muted">{l.software.map((s) => s.software.name).join(", ") || "General"}</td>
              <td><Badge tone={leadTone(l.status)}>{LEAD_STATUS_LABEL[l.status]}</Badge></td>
              <td className="text-muted">{LEAD_SOURCE_LABEL[l.source]}</td>
              {!vendorView && (
                <>
                  <td className="text-muted">
                    {l.assignedTo?.name ?? "—"}
                    {l._count.resellers > 0 && <span className="block text-xs text-mint-ink">+ {l._count.resellers} reseller{l._count.resellers === 1 ? "" : "s"}</span>}
                  </td>
                  <td className={due ? "font-medium text-danger" : "text-muted"}>{l.nextFollowUpAt ? formatDateTime(l.nextFollowUpAt) : "—"}</td>
                </>
              )}
              <td className="whitespace-nowrap text-muted" title={relativeTime(l.createdAt)}>{formatDateTime(l.createdAt)}</td>
              {vendorView && (
                <td className="text-right">
                  {l.contactLocked ? (
                    <ViewNowButton />
                  ) : (
                    <Link href={`${basePath}/${l.id}`} className="inline-flex h-8 items-center rounded-control border border-line px-3 text-sm font-medium text-ink hover:bg-bg">View</Link>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </AdminTable>
  );
}
