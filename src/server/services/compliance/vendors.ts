import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { versionInForce } from "@/lib/compliance/legal";

export const KYC_STATUSES = [
  { value: "not_started", label: "Not started" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "not_required", label: "Not required" },
] as const;
export const DATA_ROLES = [
  { value: "undecided", label: "Not decided" },
  { value: "independent", label: "Independent (decides how to use the leads)" },
  { value: "processor", label: "Processes data for us" },
] as const;

/** Every vendor and reseller with its compliance record and whether the current partner agreement is accepted. */
export async function listVendorCompliance(user: Principal) {
  assertCan(user, "compliance.view");
  const [vendors, docs] = await Promise.all([
    db.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, kind: true, isActive: true, receivesLeads: true, compliance: true } }),
    db.legalDocument.findMany({ where: { key: { in: ["vendor-agreement", "reseller-agreement"] }, isActive: true }, include: { versions: { where: { status: "PUBLISHED" }, select: { id: true, status: true, effectiveAt: true, version: true } } } }),
  ]);
  const current = Object.fromEntries(docs.map((d) => [d.key, versionInForce(d.versions)]));
  const versionIds = Object.values(current).flatMap((v) => (v ? [v.id] : []));
  const accepted = versionIds.length
    ? await db.legalAcceptance.findMany({ where: { versionId: { in: versionIds }, user: { vendorId: { not: null } } }, select: { versionId: true, user: { select: { vendorId: true } } } })
    : [];
  const ok = new Set(accepted.map((a) => `${a.user?.vendorId}:${a.versionId}`));
  return vendors.map((v) => {
    const doc = current[v.kind === "RESELLER" ? "reseller-agreement" : "vendor-agreement"];
    return { ...v, agreement: doc ? { version: doc.version, accepted: ok.has(`${v.id}:${doc.id}`) } : null };
  });
}

const optDate = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.date().nullable());
export const vendorComplianceInput = z.object({
  kycStatus: z.enum(["not_started", "pending", "verified", "rejected", "not_required"]),
  kycNote: z.string().trim().max(1000).nullable().optional(),
  gstinVerified: z.boolean(),
  dpaSigned: z.boolean(),
  dpaSignedAt: optDate,
  dataRole: z.enum(["undecided", "independent", "processor"]),
  lastReviewedAt: optDate,
  nextReviewAt: optDate,
  notes: z.string().trim().max(5000).nullable().optional(),
});

export async function saveVendorCompliance(user: Principal, vendorId: string, data: z.infer<typeof vendorComplianceInput>) {
  assertCan(user, "compliance.manage");
  const v = await db.vendor.findUnique({ where: { id: vendorId }, select: { name: true, compliance: true } });
  if (!v) throw notFound("Company");
  const clean = { ...data, kycNote: data.kycNote || null, notes: data.notes || null, updatedById: user.id };
  await db.vendorCompliance.upsert({ where: { vendorId }, create: { vendorId, ...clean }, update: clean });
  await audit({ actorId: user.id, action: "compliance.vendor_updated", entityType: "vendor", entityId: vendorId, summary: `Compliance record for ${v.name}: KYC ${data.kycStatus}, DPA ${data.dpaSigned ? "signed" : "not signed"}`, diff: { before: v.compliance ? { kycStatus: v.compliance.kycStatus, dpaSigned: v.compliance.dpaSigned, dataRole: v.compliance.dataRole } : null, after: { kycStatus: data.kycStatus, dpaSigned: data.dpaSigned, dataRole: data.dataRole } } });
}
