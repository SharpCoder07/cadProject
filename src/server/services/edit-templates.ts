import "server-only";
import { z } from "zod";
import { db } from "@/server/db";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { audit } from "@/server/audit";
import { isBlockType } from "@/lib/blocks/schemas";
import { cleanBlockData } from "./cms";
import { guardDelete } from "@/server/rbac/deletion";
import { withBin } from "@/server/system/trash";

/**
 * Website edit mode templates: a section, a Free layout row, or a whole page's sections, saved to
 * insert again anywhere (always as copies — changing a template later doesn't change pages).
 */
export const TEMPLATE_KINDS = ["section", "row", "page"] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];
interface Row { id: string; name: string; kind: string; data: unknown; createdById: string | null; createdAt: Date; updatedAt: Date }
interface Delegate {
  findMany(args: { orderBy: { updatedAt: "desc" }; select: { id: true; name: true; kind: true; updatedAt: true } }): Promise<Pick<Row, "id" | "name" | "kind" | "updatedAt">[]>;
  findUnique(args: { where: { id: string } }): Promise<Row | null>;
  create(args: { data: { name: string; kind: string; data: object; createdById: string } }): Promise<Row>;
  update(args: { where: { id: string }; data: { name: string } }): Promise<Row>;
  delete(args: { where: { id: string } }): Promise<Row>;
}
/** The EditTemplate table (typed here so this works before and after `prisma generate`). */
const templates = (db as unknown as { editTemplate: Delegate }).editTemplate;

const name = z.string().trim().min(1, "Give the template a name").max(80);
const sectionData = z.object({ blockType: z.string().max(40), label: z.string().max(120).default(""), data: z.record(z.unknown()).default({}) });

/** Checks and cleans a template's content the same way sections are checked when a page is saved. */
function cleanData(kind: TemplateKind, raw: unknown): object {
  if (kind === "section") {
    const d = sectionData.parse(raw);
    if (!isBlockType(d.blockType)) throw new AppError("Unknown section type.");
    return { ...d, data: cleanBlockData(d.blockType, d.data) };
  }
  if (kind === "row") {
    const rows = z.object({ rows: z.array(z.unknown()).min(1).max(30) }).parse(raw).rows;
    return cleanBlockData("LAYOUT", { rows }) as object;
  }
  const sections = z
    .object({ sections: z.array(z.object({ type: z.string().max(40), label: z.string().max(120).nullable().optional(), data: z.record(z.unknown()).default({}) })).min(1).max(80) })
    .parse(raw).sections;
  return {
    sections: sections.map((s) => {
      if (!isBlockType(s.type)) throw new AppError(`Unknown section type “${s.type}”.`);
      return { type: s.type, label: s.label ?? null, data: cleanBlockData(s.type, s.data) };
    }),
  };
}

export async function listTemplates(user: Principal) {
  assertCan(user, "cms.pages.view");
  return templates.findMany({ orderBy: { updatedAt: "desc" }, select: { id: true, name: true, kind: true, updatedAt: true } }).catch(() => []);
}

export async function getTemplate(user: Principal, id: string) {
  assertCan(user, "cms.pages.view");
  const t = await templates.findUnique({ where: { id } });
  if (!t) throw notFound("Template");
  return { id: t.id, name: t.name, kind: t.kind as TemplateKind, data: t.data };
}

export async function saveTemplate(user: Principal, input: { name: string; kind: TemplateKind; data?: unknown }) {
  assertCan(user, "cms.pages.create");
  if (user.readOnly) throw new AppError("View-only accounts can't change anything.", "FORBIDDEN");
  const t = await templates.create({ data: { name: name.parse(input.name), kind: input.kind, data: cleanData(input.kind, input.data), createdById: user.id } });
  await audit({ actorId: user.id, action: "template.create", entityType: "template", entityId: t.id, summary: `Saved ${input.kind} template “${t.name}”` });
  return { id: t.id, name: t.name, kind: t.kind };
}

export async function renameTemplate(user: Principal, id: string, newName: string) {
  assertCan(user, "cms.pages");
  if (user.readOnly) throw new AppError("View-only accounts can't change anything.", "FORBIDDEN");
  await templates.update({ where: { id }, data: { name: name.parse(newName) } });
}

export async function deleteTemplate(user: Principal, id: string) {
  if (user.readOnly) throw new AppError("View-only accounts can't change anything.", "FORBIDDEN");
  await guardDelete(user, "template", { id });
  // Kept in the recycle bin like everything else (System › Recycle bin), so it can be restored.
  const t = await withBin(user, "EditTemplate", [id], (tx) => (tx as unknown as { editTemplate: Delegate }).editTemplate.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "template.delete", entityType: "template", entityId: id, summary: `Deleted template “${t.name}”` });
}
