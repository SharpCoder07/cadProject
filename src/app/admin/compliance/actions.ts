"use server";

import { z } from "zod";
import { action, ok } from "@/server/action";
import { actor, refresh } from "@/app/admin/_lib";
import { purposeInput, savePurpose, togglePurpose } from "@/server/services/compliance/consent";
import { archiveVersion, createDraft, deleteDraft, draftInput, legalDocumentInput, publishVersion, saveDraft, saveLegalDocument, toggleLegalDocument } from "@/server/services/compliance/legal";
import { cookieCategoryInput, saveCookieCategory, toggleCookieCategory } from "@/server/services/compliance/cookies";

// The starting rows have readable ids (cp_account, cc_analytics…), so ids aren't cuid-checked here.
const id = z.string().min(1).max(40);

export const savePurposeAction = action(z.object({ id: id.nullable(), data: purposeInput }), async ({ id, data }) => {
  await savePurpose(await actor(), id, data);
  refresh("/admin/compliance/consent");
  return ok(undefined);
});
export const togglePurposeAction = action(z.object({ id, isActive: z.boolean() }), async ({ id, isActive }) => {
  await togglePurpose(await actor(), id, isActive);
  refresh("/admin/compliance/consent");
  return ok(undefined, isActive ? "Purpose switched on" : "Purpose switched off");
});
export const saveCookieCategoryAction = action(z.object({ id: id.nullable(), data: cookieCategoryInput }), async ({ id, data }) => {
  await saveCookieCategory(await actor(), id, data);
  refresh("/admin/compliance/cookies");
  return ok(undefined);
});
export const toggleCookieCategoryAction = action(z.object({ id, isActive: z.boolean() }), async ({ id, isActive }) => {
  await toggleCookieCategory(await actor(), id, isActive);
  refresh("/admin/compliance/cookies");
  return ok(undefined, isActive ? "Category switched on" : "Category switched off");
});

// ─── Legal documents ────────────────────────────────────────────────────────

const legalPaths = (docId?: string) => refresh("/admin/compliance/legal", ...(docId ? [`/admin/compliance/legal/${docId}`] : []));

export const saveLegalDocumentAction = action(z.object({ id: id.nullable(), data: legalDocumentInput }), async ({ id, data }) => {
  await saveLegalDocument(await actor(), id, data);
  legalPaths(id ?? undefined);
  return ok(undefined);
});
export const toggleLegalDocumentAction = action(z.object({ id, isActive: z.boolean() }), async ({ id, isActive }) => {
  await toggleLegalDocument(await actor(), id, isActive);
  legalPaths(id);
  return ok(undefined, isActive ? "Document switched on" : "Document switched off");
});
export const createLegalDraftAction = action(z.object({ documentId: id }), async ({ documentId }) => {
  const versionId = await createDraft(await actor(), documentId);
  legalPaths(documentId);
  return ok(versionId, "Draft ready");
});
export const saveLegalDraftAction = action(z.object({ id: z.string().min(1).max(40), documentId: id, data: draftInput }), async ({ id, documentId, data }) => {
  await saveDraft(await actor(), id, data);
  legalPaths(documentId);
  return ok(undefined, "Saved");
});
export const deleteLegalDraftAction = action(z.object({ id: z.string().min(1).max(40), documentId: id }), async ({ id, documentId }) => {
  await deleteDraft(await actor(), id);
  legalPaths(documentId);
  return ok(undefined, "Draft deleted");
});
export const publishLegalVersionAction = action(
  z.object({ id: z.string().min(1).max(40), documentId: id, effectiveAt: z.string().datetime({ offset: true }).nullable() }),
  async ({ id, documentId, effectiveAt }) => {
    await publishVersion(await actor(), id, effectiveAt ? new Date(effectiveAt) : null);
    legalPaths(documentId);
    return ok(undefined, effectiveAt && new Date(effectiveAt) > new Date() ? "Published: it comes into force on the date you chose" : "Published and in force");
  },
);
export const archiveLegalVersionAction = action(z.object({ id: z.string().min(1).max(40), documentId: id }), async ({ id, documentId }) => {
  await archiveVersion(await actor(), id);
  legalPaths(documentId);
  return ok(undefined, "Version archived");
});

// ─── Data requests and grievances ───────────────────────────────────────────
const caseId = z.string().cuid();
const casePaths = (id: string) => refresh("/admin/compliance", ...["requests", "grievances", "content"].flatMap((p) => [`/admin/compliance/${p}`, `/admin/compliance/${p}/${id}`]));

export const assignCaseAction = action(z.object({ id: caseId, assigneeId: z.string().cuid().nullable() }), async ({ id, assigneeId }) => {
  const { assignCase } = await import("@/server/services/compliance/cases");
  await assignCase(await actor(), id, assigneeId);
  casePaths(id);
  return ok(undefined, assigneeId ? "Assigned" : "Unassigned");
});
export const updateCaseAction = action(z.object({ id: caseId, data: z.object({ status: z.enum(["OPEN", "IN_PROGRESS", "AWAITING_REQUESTER", "RESOLVED", "REJECTED", "CLOSED"]).nullable(), message: z.string().trim().max(5000).default(""), toRequester: z.boolean().default(false), actionTaken: z.enum(["removed", "disabled", "edited", "no_action"]).nullable().optional() }) }), async ({ id, data }) => {
  const { updateCase } = await import("@/server/services/compliance/cases");
  await updateCase(await actor(), id, data);
  casePaths(id);
  return ok(undefined, data.toRequester || data.status === "RESOLVED" || data.status === "REJECTED" ? "Saved and emailed to the requester" : "Saved");
});
export const exportCaseDataAction = action(z.object({ id: caseId }), async ({ id }) => {
  const { exportForCase } = await import("@/server/services/compliance/cases");
  const r = await exportForCase(await actor(), id);
  casePaths(id);
  return ok(r, "Export ready");
});
export const withdrawCaseConsentsAction = action(z.object({ id: caseId }), async ({ id }) => {
  const { withdrawConsentsForCase } = await import("@/server/services/compliance/cases");
  const n = await withdrawConsentsForCase(await actor(), id);
  casePaths(id);
  return ok(undefined, `${n} optional consent${n === 1 ? "" : "s"} withdrawn`);
});
export const eraseCaseDataAction = action(z.object({ id: caseId, enquiries: z.boolean().default(false), confirm: z.string() }), async ({ id, enquiries, confirm }) => {
  const { eraseForCase, erasureInput } = await import("@/server/services/compliance/cases");
  const opts = erasureInput.safeParse({ enquiries, confirm });
  if (!opts.success) return { ok: false as const, error: "Type ERASE to confirm.", fieldErrors: { confirm: ["Type ERASE"] } };
  const counts = await eraseForCase(await actor(), id, opts.data);
  casePaths(id);
  return ok(counts, "Personal data erased");
});

// ─── Retention, incidents, vendor compliance ────────────────────────────────
export const saveRetentionRuleAction = action(z.object({ id, data: z.object({ retentionDays: z.coerce.number().int().min(1).max(36_500).nullable(), isActive: z.boolean(), legalReviewed: z.boolean(), legalNote: z.string().trim().max(1000).nullable().optional() }) }), async ({ id, data }) => {
  const { saveRetentionRule } = await import("@/server/services/compliance/retention");
  await saveRetentionRule(await actor(), id, data);
  refresh("/admin/compliance/retention", "/admin/compliance");
  return ok(undefined, "Saved");
});
export const runRetentionRuleAction = action(z.object({ id }), async ({ id }) => {
  const { runRetentionRuleNow } = await import("@/server/services/compliance/retention");
  const n = await runRetentionRuleNow(await actor(), id);
  refresh("/admin/compliance/retention");
  return ok(n, `${n} record${n === 1 ? "" : "s"} processed`);
});
export const saveIncidentAction = action(z.object({ id: z.string().cuid().nullable(), data: z.record(z.unknown()), note: z.string().trim().max(5000).nullable().optional() }), async ({ id, data, note }) => {
  const { createIncident, incidentInput, updateIncident } = await import("@/server/services/compliance/incidents");
  const parsed = incidentInput.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  const user = await actor();
  const savedId = id ? (await updateIncident(user, id, parsed.data, note), id) : await createIncident(user, parsed.data);
  refresh("/admin/compliance/incidents", `/admin/compliance/incidents/${savedId}`, "/admin/compliance");
  return ok(savedId, id ? "Saved" : "Incident recorded");
});
export const saveVendorComplianceAction = action(z.object({ id: z.string().cuid().nullable(), data: z.record(z.unknown()) }), async ({ id, data }) => {
  const { saveVendorCompliance, vendorComplianceInput } = await import("@/server/services/compliance/vendors");
  if (!id) return { ok: false as const, error: "Choose a company from the list." };
  const parsed = vendorComplianceInput.safeParse(data);
  if (!parsed.success) return { ok: false as const, error: "Check the highlighted fields.", fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  await saveVendorCompliance(await actor(), id, parsed.data);
  refresh("/admin/compliance/vendors", "/admin/compliance");
  return ok(undefined, "Saved");
});
