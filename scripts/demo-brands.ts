/**
 * Adds fictional demo brands with designed logos, so the homepage "Top software brands" marquee has enough
 * logos to show two rows moving in opposite directions (8+ brands). Not linked to any product or vendor.
 *
 *   npm run db:demo-brands            # adds the brands that don't exist yet (safe to re-run)
 *   npm run db:demo-brands -- --remove # deletes these demo brands and their logos again
 *
 * Local storage only (logos go to public/uploads/brand-logos); never in production.
 */
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { brandLogoSvg } from "../prisma/brand-logo";

const db = new PrismaClient();

const DEMO = [
  ["Nimbus Ledger", "Cloud accounting and GST filing for growing businesses."],
  ["Kavya HR", "Payroll, attendance and leave for Indian teams."],
  ["Orbitly", "Project planning and team collaboration."],
  ["Sanchay Retail", "Billing, inventory and POS for shops and chains."],
  ["Tarang CRM", "Sales pipeline and WhatsApp follow-ups."],
  ["Vistaar ERP", "Manufacturing and distribution ERP."],
  ["Prakash Secure", "Endpoint protection and device management."],
  ["Medisutra", "Clinic and hospital management."],
  ["Vidyaloka", "School management and fee collection."],
  ["Quillmark", "Contracts and e-signatures."],
] as const;

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The homepage hero shows hand-picked brands when any are picked (Hero › Logos), otherwise brands by display order.
 * When brands are hand-picked there (also in edit-mode drafts), the demo brands are added to / removed from that list.
 */
async function updateHeroPicks(ids: string[], add: boolean) {
  const sections = await db.pageSection.findMany({ where: { type: "HERO" }, select: { id: true, data: true } });
  let changed = 0;
  for (const sec of sections) {
    const data = (sec.data ?? {}) as { logoBrandIds?: string[] };
    const picked = Array.isArray(data.logoBrandIds) ? data.logoBrandIds : [];
    if (!picked.length) continue;
    const next = add ? [...picked, ...ids.filter((id) => !picked.includes(id))] : picked.filter((id) => !ids.includes(id));
    if (next.length === picked.length) continue;
    await db.pageSection.update({ where: { id: sec.id }, data: { data: { ...data, logoBrandIds: next } } });
    changed++;
  }
  // Unpublished website-edit-mode drafts of pages keep their own copy of the sections.
  const drafts = await (db as unknown as { editDraft?: { findMany: (q: unknown) => Promise<{ key: string; value: unknown }[]>; update: (q: unknown) => Promise<unknown> } }).editDraft
    ?.findMany({ where: { key: { startsWith: "page:" } } }).catch(() => []) ?? [];
  for (const d of drafts) {
    const list = Array.isArray(d.value) ? (d.value as { type?: string; data?: { logoBrandIds?: string[] } }[]) : [];
    let touched = false;
    for (const s of list) {
      const picked = s.type === "HERO" && Array.isArray(s.data?.logoBrandIds) ? s.data!.logoBrandIds! : [];
      if (!picked.length) continue;
      s.data!.logoBrandIds = add ? [...picked, ...ids.filter((id) => !picked.includes(id))] : picked.filter((id) => !ids.includes(id));
      touched = true;
    }
    if (touched) {
      await (db as unknown as { editDraft: { update: (q: unknown) => Promise<unknown> } }).editDraft.update({ where: { key: d.key }, data: { value: list } });
      changed++;
    }
  }
  if (changed) console.log(`✓ homepage hero: hand-picked brands ${add ? "now include" : "no longer include"} the demo brands`);
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Demo brands are for development only.");
  if ((process.env.STORAGE_DRIVER || "local") !== "local") console.warn("! Logos are written to local storage (public/uploads).");
  const remove = process.argv.includes("--remove");

  if (remove) {
    let n = 0;
    const removedIds: string[] = [];
    for (const [name] of DEMO) {
      const slug = `demo-${slugify(name)}`;
      const b = await db.brand.findUnique({ where: { slug }, select: { id: true, logoId: true } });
      if (!b) continue;
      await db.brand.delete({ where: { id: b.id } });
      if (b.logoId) await db.mediaAsset.delete({ where: { id: b.logoId } }).catch(() => undefined);
      await unlink(path.join(process.cwd(), "public", "uploads", "brand-logos", `${slug}.png`)).catch(() => undefined);
      removedIds.push(b.id);
      n++;
    }
    await updateHeroPicks(removedIds, false);
    console.log(`✓ removed ${n} demo brand(s)`);
    return;
  }

  const last = await db.brand.aggregate({ _max: { sortOrder: true } });
  let order = (last._max.sortOrder ?? 0) + 1;
  let made = 0;
  const ids: string[] = [];
  for (const [name, description] of DEMO) {
    const slug = `demo-${slugify(name)}`;
    const existing = await db.brand.findUnique({ where: { slug }, select: { id: true } });
    if (existing) { ids.push(existing.id); continue; }
    const { svg } = brandLogoSvg(name, slug);
    const buf = await sharp(Buffer.from(svg), { density: 192 }).trim({ threshold: 1 }).png().toBuffer();
    const meta = await sharp(buf).metadata();
    const key = `brand-logos/${slug}.png`;
    const file = path.join(process.cwd(), "public", "uploads", key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, buf);
    const data = { provider: "local", url: `/uploads/${key}`, filename: `${slug}.png`, mimeType: "image/png", sizeBytes: buf.byteLength, width: meta.width ?? null, height: meta.height ?? null, alt: `${name} logo` };
    const asset = await db.mediaAsset.upsert({ where: { storageKey: key }, create: { storageKey: key, ...data }, update: data });
    const b = await db.brand.create({ data: { name, slug, description: `${description} (Demo brand.)`, logoId: asset.id, isActive: true, sortOrder: order++ } });
    ids.push(b.id);
    made++;
  }
  await updateHeroPicks(ids, true);
  console.log(`✓ ${made} demo brand(s) added. Open the homepage: “Top software brands” now shows two moving rows.`);
  console.log("  Remove them later with: npm run db:demo-brands -- --remove");
}

/**
 * Pages and brand lists are cached by Next.js and normally refreshed when you save in the admin. This script
 * writes to the database directly, so it clears the development cache instead; restart `npm run dev` afterwards.
 */
async function clearDevCache() {
  await rm(path.join(process.cwd(), ".next", "cache", "fetch-cache"), { recursive: true, force: true }).catch(() => undefined);
  console.log("✓ cleared the development page cache. Restart `npm run dev` (Ctrl+C, then npm run dev) and refresh the homepage.");
}

main()
  .then(() => clearDevCache())
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
