import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { getApproval } from "@/server/services/approvals";
import { getSoftwareForEdit, toSoftwareInput } from "@/server/services/software";
import { AppError } from "@/server/errors";
import { diffObjects, referencedIds, type DiffRow } from "@/lib/approval-diff";
import { formatDateTime } from "@/lib/format";
import { vendorPermissionLabel } from "@/server/rbac/permissions";
import { cn } from "@/lib/utils";
import { Alert, Panel, PanelHeader, Stars } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { ActionBadge, ENTITY_NAME, RequestStatusBadge } from "@/components/admin/approval-badges";
import { DecisionPanel } from "./decision-panel";

export const metadata = { title: "Approval request" };
export const dynamic = "force-dynamic";

type Obj = Record<string, unknown>;

function DiffTable({ rows, beforeLabel, afterLabel, onlyAfter }: { rows: DiffRow[]; beforeLabel: string; afterLabel: string; onlyAfter?: boolean }) {
  const changed = rows.filter((r) => r.changed);
  const shown = onlyAfter ? rows.filter((r) => r.after !== "—") : rows;
  return (
    <div className="overflow-x-auto">
      {!onlyAfter && <p className="px-5 pt-4 text-sm text-muted">{changed.length ? `${changed.length} field${changed.length === 1 ? "" : "s"} changed. Changed rows are highlighted.` : "No visible fields changed."}</p>}
      <table className="mt-2 w-full min-w-[36rem] text-left text-sm">
        <thead className="border-y border-line bg-bg/60 text-xs uppercase tracking-[0.05em] text-muted">
          <tr>
            <th className="w-44 px-5 py-2.5 font-semibold">Field</th>
            {!onlyAfter && <th className="px-5 py-2.5 font-semibold">{beforeLabel}</th>}
            <th className="px-5 py-2.5 font-semibold">{afterLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shown.map((r) => (
            <tr key={r.key} className={cn(!onlyAfter && r.changed && "bg-accent/[0.07]")}>
              <td className="px-5 py-3 align-top font-medium text-ink">{r.label}{!onlyAfter && r.changed && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" aria-label="changed" />}</td>
              {!onlyAfter && <td className={cn("whitespace-pre-line px-5 py-3 align-top", r.changed ? "text-muted line-through decoration-danger/40" : "text-muted")}>{r.before}</td>}
              <td className="whitespace-pre-line px-5 py-3 align-top text-ink">{r.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type TeamPayload = { name?: string; email?: string; permissions?: string[]; avatarUrl?: string | null; mode?: string };

function AccessList({ perms, compare, tone }: { perms: string[]; compare?: string[]; tone?: "added" | "removed" }) {
  if (!perms.length) return <span className="text-muted">—</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {perms.filter((p) => p !== "vendor.portal").map((p) => {
        const changed = compare && !compare.includes(p);
        return (
          <li key={p} className={cn("rounded-full px-2 py-0.5 text-xs ring-1", changed ? (tone === "added" ? "bg-success/10 text-success ring-success/30" : "bg-danger/10 text-danger line-through ring-danger/30") : "bg-bg text-ink ring-line")}>
            {vendorPermissionLabel(p)}
          </li>
        );
      })}
    </ul>
  );
}

async function TeamRequestBody({ r }: { r: Awaited<ReturnType<typeof getApproval>> }) {
  const p = (r.payload ?? {}) as TeamPayload;
  const b = (r.before ?? {}) as TeamPayload;
  const target = r.action === "CREATE" ? null : await db.user.findUnique({ where: { id: r.entityId }, select: { id: true, name: true, email: true, status: true, role: { select: { name: true } } } });
  const who = target ? (
    <p className="text-sm text-muted">
      <Link href={`/admin/users/${target.id}`} className="font-medium text-ink hover:underline">{target.name}</Link> · {target.email} · {target.role.name} · {target.status.toLowerCase()}
      {r.requestedById === target.id && <span className="ml-1">(their own account)</span>}
    </p>
  ) : null;
  const rows: { label: string; before: React.ReactNode; after: React.ReactNode }[] = [];
  if (r.action === "CREATE") {
    return (
      <div className="space-y-4 p-5 text-sm">
        <p>Invite <strong>{p.name}</strong> ({p.email}) to {r.vendor.name}&apos;s vendor portal. They&apos;ll get an email to set their password.</p>
        <div><p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.05em] text-muted">Access</p><AccessList perms={p.permissions ?? []} /></div>
      </div>
    );
  }
  if (!target) return <Alert tone="warning" className="m-5" title="This user no longer exists" />;
  if (r.action === "DELETE") {
    return <div className="space-y-2 p-5 text-sm">{who}<p>Permanently remove this user. They&apos;re signed out everywhere; their past activity stays in the audit log.</p></div>;
  }
  if (r.action === "PASSWORD") {
    return (
      <div className="space-y-2 p-5 text-sm">
        {who}
        <p>{p.mode === "hash" ? "Set the new password they chose (never shown to anyone). They'll be signed out on all devices and sign in with the new password." : "Email them a password reset link."}</p>
      </div>
    );
  }
  if (p.name !== undefined) rows.push({ label: "Name", before: b.name ?? target.name, after: p.name });
  if ("avatarUrl" in p) {
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded avatar preview
    const img = (url?: string | null) => (url ? <img src={url} alt="" className="h-14 w-14 rounded-full object-cover ring-1 ring-line" /> : <span className="text-muted">No photo</span>);
    rows.push({ label: "Photo", before: img(b.avatarUrl), after: img(p.avatarUrl) });
  }
  if (p.permissions) rows.push({ label: "Access", before: <AccessList perms={b.permissions ?? []} compare={p.permissions} tone="removed" />, after: <AccessList perms={p.permissions} compare={b.permissions ?? []} tone="added" /> });
  return (
    <div>
      <div className="px-5 pt-4">{who}</div>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="border-y border-line bg-bg/60 text-xs uppercase tracking-[0.05em] text-muted"><tr><th className="w-32 px-5 py-2.5">Field</th><th className="px-5 py-2.5">Now</th><th className="px-5 py-2.5">Proposed</th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => <tr key={row.label}><td className="px-5 py-3 align-top font-medium">{row.label}</td><td className="px-5 py-3 align-top">{row.before}</td><td className="px-5 py-3 align-top">{row.after}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

async function nameLookups(...objs: (Obj | null)[]) {
  const ids = referencedIds(...objs);
  const [cats, inds, sws, brands, terms] = await Promise.all([
    ids.categories.length ? db.category.findMany({ where: { id: { in: ids.categories } }, select: { id: true, name: true } }) : [],
    ids.industries.length ? db.industry.findMany({ where: { id: { in: ids.industries } }, select: { id: true, name: true } }) : [],
    ids.software.length ? db.software.findMany({ where: { id: { in: ids.software } }, select: { id: true, name: true } }) : [],
    ids.brands.length ? db.brand.findMany({ where: { id: { in: ids.brands } }, select: { id: true, name: true } }) : [],
    ids.terms.length ? db.taxonomyTerm.findMany({ where: { id: { in: ids.terms } }, select: { id: true, name: true } }) : [],
  ]);
  return Object.fromEntries([...cats, ...inds, ...sws, ...brands, ...terms].map((x) => [x.id, x.name]));
}

export default async function ApprovalDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("approvals.manage", `/admin/approvals/${id}`);
  const r = await getApproval(user, id).catch((e) => { if (e instanceof AppError && e.code === "NOT_FOUND") notFound(); throw e; });

  let body: React.ReactNode = null;
  let stale = false;
  let links: React.ReactNode = null;

  if (r.entityType === "SOFTWARE") {
    const sw = await getSoftwareForEdit(user, r.entityId).catch(() => null);
    if (!sw) {
      body = <Alert tone="warning" className="m-5" title="This product no longer exists">It may have been deleted after the request was made. Reject or leave it.</Alert>;
    } else {
      const live = toSoftwareInput(sw) as unknown as Obj;
      links = (
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={`/software/${sw.slug}${sw.status === "PUBLISHED" ? "" : "?preview=1"}`} target="_blank" className="inline-flex items-center gap-1 font-medium text-ink hover:underline">{sw.status === "PUBLISHED" ? "View live page" : "Preview draft"} <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>
          <Link href={`/admin/software/${sw.id}`} className="font-medium text-ink hover:underline">Open in product editor</Link>
        </div>
      );
      if (r.action === "UPDATE") {
        const proposed = (r.payload ?? null) as Obj | null;
        stale = r.status === "PENDING" && sw.updatedAt > r.updatedAt;
        body = <DiffTable rows={diffObjects(live, proposed, await nameLookups(live, proposed))} beforeLabel="Live now" afterLabel="Proposed by vendor" />;
      } else if (r.action === "CREATE" || r.action === "PUBLISH") {
        body = <DiffTable rows={diffObjects(null, live, await nameLookups(live))} beforeLabel="" afterLabel="Draft to publish" onlyAfter />;
      } else {
        body = (
          <div className="p-5 text-sm">
            <p>The vendor asked to <strong>{r.action === "DELETE" ? "delete" : "unpublish"}</strong> “{sw.name}”. It&apos;s currently <strong>{sw.status.toLowerCase().replace("_", " ")}</strong>{sw.status === "PUBLISHED" ? " and visible on the website" : ""}.</p>
            {r.action === "DELETE" && <p className="mt-2 text-muted">Deleting removes the product, its pricing, FAQs and history. Leads stay in the leads list.</p>}
          </div>
        );
      }
    }
  } else if (r.entityType === "VENDOR_PROFILE") {
    const v = await db.vendor.findUnique({ where: { id: r.entityId }, select: { slug: true, updatedAt: true } });
    stale = Boolean(v && r.status === "PENDING" && v.updatedAt > r.updatedAt);
    body = <DiffTable rows={diffObjects((r.before ?? null) as Obj | null, (r.payload ?? null) as Obj | null)} beforeLabel="Current profile" afterLabel="Proposed by vendor" />;
    if (v) links = <Link href={`/vendors/${v.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline">View public vendor page <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>;
  } else if (r.entityType === "VENDOR_USER") {
    body = await TeamRequestBody({ r });
  } else if (r.entityType === "OFFER") {
    const offer = await db.productOffer.findUnique({ where: { id: r.entityId }, select: { status: true, updatedAt: true, software: { select: { name: true, slug: true } } } });
    const before = (r.before ?? null) as Obj | null;
    const proposed = (r.payload ?? null) as Obj | null;
    const names = Object.fromEntries((await db.software.findMany({ where: { id: { in: [before?.softwareId, proposed?.softwareId].filter((x): x is string => typeof x === "string") } }, select: { id: true, name: true } })).map((s) => [s.id, s.name]));
    if (!offer && r.status === "PENDING") {
      body = <Alert tone="warning" className="m-5" title="This offer no longer exists">It may have been deleted after the request was made. Reject or leave it.</Alert>;
    } else if (r.action === "DELETE") {
      body = (
        <div className="space-y-3 p-5 text-sm">
          <p>The vendor asked to <strong>remove</strong> this offer{offer ? ` from ${offer.software.name}` : ""}. It disappears from the product page straight away when approved.</p>
          <DiffTable rows={diffObjects(null, before, names)} beforeLabel="" afterLabel="Current offer" onlyAfter />
        </div>
      );
    } else {
      stale = Boolean(offer && r.status === "PENDING" && r.action === "UPDATE" && offer.updatedAt > r.updatedAt);
      body = r.action === "CREATE"
        ? <DiffTable rows={diffObjects(null, proposed, names)} beforeLabel="" afterLabel="New offer" onlyAfter />
        : <DiffTable rows={diffObjects(before, proposed, names)} beforeLabel="Live now" afterLabel="Proposed by vendor" />;
    }
    if (offer) links = <Link href={`/software/${offer.software.slug}`} target="_blank" className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline">View product page <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>;
    if (r.status === "PENDING" && r.action !== "DELETE") {
      body = (
        <>
          {body}
          <p className="border-t border-line px-5 py-3 text-xs text-muted">Approving makes the offer live from its start date. Everyone who favourited the product is emailed once when it goes live.</p>
        </>
      );
    }
  } else if (r.entityType === "RESELLER_PRODUCT") {
    const softwareId = r.entityId.split(":")[1] ?? "";
    const [sw, reseller, live] = await Promise.all([
      db.software.findUnique({ where: { id: softwareId }, select: { name: true, slug: true, status: true, vendor: { select: { name: true } } } }),
      db.vendor.findUnique({ where: { id: r.vendorId }, select: { id: true, name: true, city: true, serviceCities: true, verification: true } }),
      db.resellerProduct.findUnique({ where: { resellerId_softwareId: { resellerId: r.vendorId, softwareId } }, select: { partnerLevel: true } }),
    ]);
    const proposed = (r.payload ?? null) as { partnerLevel?: string | null } | null;
    body = sw ? (
      <div className="space-y-4 p-5 text-sm">
        <p>
          <strong>{reseller?.name ?? "The reseller"}</strong>{" "}
          {r.action === "DELETE" ? "no longer wants to be listed as an authorised reseller of" : r.action === "UPDATE" ? "wants to change its partner level for" : "wants to be listed as an authorised reseller of"}{" "}
          <strong>{sw.name}</strong>{sw.vendor ? ` (by ${sw.vendor.name})` : ""}.
        </p>
        <div className="grid gap-4 rounded-xl bg-bg p-4 ring-1 ring-line md:grid-cols-2">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted">Now</p><p>{live ? `Authorised${live.partnerLevel ? ` · ${live.partnerLevel}` : ""}` : "Not authorised"}</p></div>
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted">After approval</p><p>{r.action === "DELETE" ? "Not authorised" : `Authorised${proposed?.partnerLevel ? ` · ${proposed.partnerLevel}` : ""}`}</p></div>
        </div>
        {reseller && (
          <p className="text-muted">
            Reseller: {[reseller.city, reseller.verification === "VERIFIED" ? "verified" : `${reseller.verification.toLowerCase()} verification`].filter(Boolean).join(" · ")}
            {reseller.serviceCities.length ? ` · serves ${reseller.serviceCities.join(", ")}` : ""}
          </p>
        )}
        {r.action !== "DELETE" && r.status === "PENDING" && <p className="text-xs text-muted">Approving shows this reseller under “Authorised resellers” on the product page. Check their partner certificate or the vendor&apos;s confirmation before approving.</p>}
      </div>
    ) : <Alert tone="warning" className="m-5" title="This product no longer exists">It may have been deleted after the request was made. Reject or leave it.</Alert>;
    if (sw) links = (
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={`/software/${sw.slug}`} target="_blank" className="inline-flex items-center gap-1 font-medium text-ink hover:underline">View product page <ExternalLink className="h-3.5 w-3.5" aria-hidden /></Link>
        {reseller && <Link href={`/admin/resellers/${reseller.id}`} className="font-medium text-ink hover:underline">Open reseller</Link>}
      </div>
    );
  } else {
    const review = await db.review.findUnique({ where: { id: r.entityId }, select: { title: true, body: true, rating: true, authorName: true, companyName: true, vendorReply: true, software: { select: { name: true, slug: true } } } });
    body = review ? (
      <div className="space-y-4 p-5 text-sm">
        <div className="rounded-xl bg-bg p-4 ring-1 ring-line">
          <div className="flex items-center gap-2"><Stars value={review.rating} /><span className="font-semibold">{review.title}</span></div>
          <p className="mt-2 whitespace-pre-line text-ink/80">{review.body}</p>
          <p className="mt-2 text-xs text-muted">{review.authorName}{review.companyName ? `, ${review.companyName}` : ""} · review of {review.software.name}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted">Current public reply</p><p className="whitespace-pre-line">{review.vendorReply ?? "—"}</p></div>
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-[0.05em] text-muted">{r.action === "DELETE" ? "Proposed" : "Proposed reply"}</p><p className="whitespace-pre-line">{r.action === "DELETE" ? "Remove the reply" : String((r.payload as { reply?: string } | null)?.reply ?? "—")}</p></div>
        </div>
      </div>
    ) : <Alert tone="warning" className="m-5" title="This review no longer exists" />;
  }

  return (
    <>
      <PageHeader title={r.entityLabel} description={`${ENTITY_NAME[r.entityType]} request from ${r.vendor.name}`} back={{ href: "/admin/approvals", label: "Approvals" }} />
      <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          {stale && (
            <Alert tone="warning" title="Changed since this request was made">
              Someone edited this record after the vendor submitted the request. Approving replaces those edits with the vendor&apos;s version.
            </Alert>
          )}
          <Panel>
            <PanelHeader title="What will change" actions={links} />
            {body}
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Request" />
            <dl className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between gap-3"><dt className="text-muted">Status</dt><dd><RequestStatusBadge status={r.status} /></dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-muted">Action</dt><dd><ActionBadge action={r.action} /></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Vendor</dt><dd><Link href={`/admin/vendor-portal/${r.vendor.id}`} className="font-medium hover:underline">{r.vendor.name}</Link></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Requested by</dt><dd className="text-right">{r.requestedBy ? <Link href={`/admin/users/${r.requestedBy.id}`} className="font-medium hover:underline">{r.requestedBy.name}</Link> : "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Submitted</dt><dd>{formatDateTime(r.createdAt)}</dd></div>
              {r.updatedAt.getTime() - r.createdAt.getTime() > 60_000 && <div className="flex justify-between gap-3"><dt className="text-muted">Last updated</dt><dd>{formatDateTime(r.updatedAt)}</dd></div>}
              {r.note && <div className="border-t border-line pt-3"><dt className="text-muted">Vendor&apos;s note</dt><dd className="mt-1 whitespace-pre-line">{r.note}</dd></div>}
              {r.decidedAt && (
                <div className="border-t border-line pt-3">
                  <dt className="text-muted">{r.status === "CANCELLED" ? "Closed" : `Decided by ${r.decidedBy?.name ?? "—"}`}</dt>
                  <dd className="mt-1">{formatDateTime(r.decidedAt)}{r.decisionNote && <span className="mt-1 block whitespace-pre-line text-ink">{r.decisionNote}</span>}</dd>
                </div>
              )}
            </dl>
          </Panel>
          {r.status === "PENDING" && (
            <Panel>
              <PanelHeader title="Your decision" />
              <DecisionPanel id={r.id} destructive={r.action === "DELETE" || r.action === "PASSWORD"} />
            </Panel>
          )}
          {r.status === "PENDING" && <p className="flex gap-2 px-1 text-xs text-muted"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />Nothing has changed on the website yet.</p>}
        </div>
      </div>
    </>
  );
}
