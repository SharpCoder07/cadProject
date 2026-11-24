import "server-only";
import { z } from "zod";
import { revalidateTag, unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, notFound } from "@/server/errors";
import { assertCan, type Principal } from "@/server/rbac/policy";
import type { CookieChoiceInput } from "@/lib/compliance/consent";

export interface CookieInfo { name: string; provider: string; duration: string; purpose: string }
export interface PublicCookieCategory { key: string; name: string; description: string; isNecessary: boolean; cookies: CookieInfo[] }

const TAG = "cookie-categories";
const asCookies = (v: Prisma.JsonValue): CookieInfo[] =>
  Array.isArray(v)
    ? v.flatMap((c) => (c && typeof c === "object" && !Array.isArray(c) && typeof c.name === "string" ? [{ name: String(c.name), provider: String(c.provider ?? ""), duration: String(c.duration ?? ""), purpose: String(c.purpose ?? "") }] : []))
    : [];

/** Active categories for the cookie banner (cached; refreshed when an admin edits them). */
export const publicCookieCategories = unstable_cache(
  async (): Promise<PublicCookieCategory[]> => {
    const rows = await db.cookieCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    return rows.map((r) => ({ key: r.key, name: r.name, description: r.description, isNecessary: r.isNecessary, cookies: asCookies(r.cookies) }));
  },
  ["cookie-categories"],
  { tags: [TAG], revalidate: 3600 },
);

/** Logs a visitor's cookie choice (a new row each time, so the history is kept). Unknown categories are dropped. */
export async function recordCookieChoice(input: CookieChoiceInput, ctx: { userId: string | null; ipHash: string | null; userAgent: string | null }) {
  const known = new Map((await publicCookieCategories()).map((c) => [c.key, c]));
  const choices: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(input.choices)) {
    const c = known.get(k);
    if (c) choices[k] = c.isNecessary ? true : v;
  }
  await db.cookiePreference.create({
    data: { visitorId: input.visitorId, userId: ctx.userId, choices, action: input.action, noticeVersion: input.noticeVersion, ipHash: ctx.ipHash, userAgent: ctx.userAgent?.slice(0, 300) ?? null },
  });
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export const cookieCategoryInput = z.object({
  key: z.string().trim().regex(/^[a-z0-9_]{2,40}$/, "Lower-case letters, numbers and _ only"),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(5).max(1000),
  isNecessary: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  /** One cookie per line: name | provider | duration | purpose */
  cookies: z.string().max(8000).default(""),
});

export const cookiesToText = (v: Prisma.JsonValue) => asCookies(v).map((c) => [c.name, c.provider, c.duration, c.purpose].join(" | ")).join("\n");
export const textToCookies = (s: string): CookieInfo[] =>
  s.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 60).map((l) => {
    const [name = "", provider = "", duration = "", purpose = ""] = l.split("|").map((x) => x.trim().slice(0, 200));
    return { name, provider, duration, purpose };
  }).filter((c) => c.name);

export async function saveCookieCategory(user: Principal, id: string | null, raw: unknown) {
  assertCan(user, "compliance.manage");
  const d = cookieCategoryInput.parse(raw);
  const data = { key: d.key, name: d.name, description: d.description, isNecessary: d.isNecessary, sortOrder: d.sortOrder, cookies: textToCookies(d.cookies) as unknown as Prisma.InputJsonValue };
  if (id) {
    const before = await db.cookieCategory.findUnique({ where: { id } });
    if (!before) throw notFound("Cookie category");
    if (before.key !== d.key && ["necessary", "analytics", "marketing", "functional"].includes(before.key)) throw new AppError("The built-in categories keep their key: the website uses it to decide which scripts may load.", "BAD_REQUEST");
    await db.cookieCategory.update({ where: { id }, data });
    await audit({ actorId: user.id, action: "cookies.category_updated", entityType: "cookieCategory", entityId: id, summary: `Edited cookie category ${d.name}` });
  } else {
    if (await db.cookieCategory.findUnique({ where: { key: d.key } })) throw new AppError("A category with this key already exists.", "BAD_REQUEST");
    const c = await db.cookieCategory.create({ data });
    await audit({ actorId: user.id, action: "cookies.category_created", entityType: "cookieCategory", entityId: c.id, summary: `Added cookie category ${d.name}` });
  }
  revalidateTag(TAG);
}

export async function toggleCookieCategory(user: Principal, id: string, isActive: boolean) {
  assertCan(user, "compliance.manage");
  const c = await db.cookieCategory.findUnique({ where: { id } });
  if (!c) throw notFound("Cookie category");
  if (c.key === "necessary" && !isActive) throw new AppError("Strictly necessary cookies can't be switched off.", "BAD_REQUEST");
  await db.cookieCategory.update({ where: { id }, data: { isActive } });
  await audit({ actorId: user.id, action: "cookies.category_toggled", entityType: "cookieCategory", entityId: id, summary: `${isActive ? "Switched on" : "Switched off"} cookie category ${c.name}` });
  revalidateTag(TAG);
}

export const cookieLogQuery = z.object({
  action: z.enum(["accept_all", "reject_all", "custom"]).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});
const PAGE = 50;

/** Cookie choice log (no personal data beyond a random visitor id and a hashed network). */
export async function listCookieChoices(user: Principal, query: z.infer<typeof cookieLogQuery>) {
  assertCan(user, "compliance.view");
  const where: Prisma.CookiePreferenceWhereInput = query.action ? { action: query.action } : {};
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [total, rows, byAction] = await Promise.all([
    db.cookiePreference.count({ where }),
    db.cookiePreference.findMany({ where, orderBy: { createdAt: "desc" }, skip: (query.page - 1) * PAGE, take: PAGE, select: { id: true, visitorId: true, userId: true, choices: true, action: true, noticeVersion: true, createdAt: true } }),
    db.cookiePreference.groupBy({ by: ["action"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const last30 = Object.fromEntries(byAction.map((b) => [b.action, b._count._all])) as Record<string, number>;
  return { total, page: query.page, pages: Math.max(1, Math.ceil(total / PAGE)), rows, last30 };
}
