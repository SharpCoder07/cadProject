import Link from "next/link";
import { CalendarClock, FileCheck2, FilePen, FileText, Scale } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/rbac/policy";
import { listLegalDocuments } from "@/server/services/compliance/legal";
import { LEGAL_AUDIENCES } from "@/lib/compliance/legal";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { saveLegalDocumentAction, toggleLegalDocumentAction } from "../actions";

export const metadata = { title: "Legal documents" };

const AUDIENCE = Object.fromEntries(LEGAL_AUDIENCES.map((a) => [a.value, a.label.split(" (")[0]]));

/** Compliance & Privacy › Legal documents: versioned privacy policy, terms and the rest, with acceptance records. */
export default async function LegalDocumentsPage() {
  const user = await requirePermission("compliance.view", "/admin/compliance/legal");
  const docs = await listLegalDocuments(user);
  const editable = can(user, "compliance.manage");
  return (
    <>
      <PageHeader
        title="Legal documents"
        description="Each document keeps every version: draft, preview, publish now or from a date, and archive. Published text can't be changed, so you always know what people were shown and who accepted which version."
        actions={editable ? <CrudAddButton entity="legal-doc" label="Add document" /> : undefined}
      />
      <PageStats
        items={[
          { label: "In force", value: docs.filter((d) => d.current).length, icon: FileCheck2, tone: "green", sub: `of ${docs.filter((d) => d.isActive).length} documents` },
          { label: "Drafts", value: docs.reduce((n, d) => n + d.drafts, 0), icon: FilePen, sub: "Not visible to visitors" },
          { label: "Scheduled", value: docs.filter((d) => d.scheduled).length, icon: CalendarClock, sub: "Come into force later" },
          { label: "Not legally reviewed", value: docs.filter((d) => d.current && !d.current.legalReviewed).length, icon: Scale, tone: "red", sub: "Versions in force" },
        ]}
      />
      <div className="mb-5 rounded-2xl border border-warning/40 bg-warning/5 p-4 text-sm text-muted">
        <span className="font-semibold text-ink">Legal review: </span>
        no legal text is provided: write or paste each document and have it reviewed by a lawyer before publishing. Once a version is in force it replaces
        the Website page at the same address (for example the existing Privacy policy page); until then that page keeps showing.
      </div>
      <CrudManager
        addInHeader
        entity="legal-doc"
        newLabel="Add document"
        columns={["Document", "In force", "Who accepts", "Accepted (this version)", ""]}
        rows={docs.map((d) => ({
          id: d.id,
          name: d.title,
          active: d.isActive,
          searchText: `${d.title} ${d.slug}`,
          cells: [
            <span key="t" className="flex items-center gap-2.5">
              <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <span><Link href={`/admin/compliance/legal/${d.id}`} className="font-medium text-ink hover:text-primary hover:underline">{d.title}</Link><span className="block text-xs text-muted">/{d.slug}</span></span>
            </span>,
            d.current
              ? <span key="c"><span className="block text-ink">v{d.current.version}</span><span className="block text-xs text-muted">since {formatDate(d.current.effectiveAt!)}{d.scheduled ? ` · v${d.scheduled.version} from ${formatDate(d.scheduled.effectiveAt!)}` : ""}</span></span>
              : <span key="c" className="text-muted">{d.scheduled ? `v${d.scheduled.version} from ${formatDate(d.scheduled.effectiveAt!)}` : d.drafts ? "Draft only" : "Nothing yet"}</span>,
            d.requiresAcceptance ? AUDIENCE[d.audience] ?? d.audience : "Not asked",
            d.requiresAcceptance && d.current ? d.acceptancesCurrent.toLocaleString("en-IN") : "—",
            <Link key="o" href={`/admin/compliance/legal/${d.id}`} className="whitespace-nowrap text-sm font-semibold text-primary hover:underline">Versions</Link>,
          ],
          values: { title: d.title, slug: d.slug, key: d.key, audience: d.audience, requiresAcceptance: d.requiresAcceptance, sortOrder: d.sortOrder },
        }))}
        fields={[
          { name: "title", label: "Name", type: "text", required: true },
          { name: "slug", label: "Address", type: "text", required: true, hint: "Shown at /<address>, e.g. privacy-policy." },
          { name: "key", label: "Key", type: "text", required: true, hint: "Lower-case, can't change later (the website looks documents up by it: terms, privacy-policy…)." },
          { name: "audience", label: "Who it applies to", type: "select", options: LEGAL_AUDIENCES },
          { name: "requiresAcceptance", label: "Needs acceptance", type: "switch", hint: "Accepted at sign-up (terms and privacy policy) and, when a new version asks for it, from a notice in the account area or partner portal." },
          { name: "sortOrder", label: "Order", type: "number" },
        ]}
        emptyValues={{ title: "", slug: "", key: "", audience: "all", requiresAcceptance: false, sortOrder: docs.length }}
        save={saveLegalDocumentAction}
        toggle={editable ? toggleLegalDocumentAction : undefined}
        emptyText="No documents yet. Run npm run db:migrate to add the standard set."
      />
    </>
  );
}
