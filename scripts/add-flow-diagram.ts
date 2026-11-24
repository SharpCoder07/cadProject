/**
 * Adds the "Connection diagram" section (FLOW_DIAGRAM block) to the homepage, right after "How it works"
 * (or after the top banner when there is no "How it works"). Safe to re-run: it does nothing if the
 * homepage already has one.
 *
 *   npm run db:add-flow-diagram             # add it
 *   npm run db:add-flow-diagram -- --remove # take it off the homepage again
 *
 * Edit its texts and cards afterwards in Admin › Website › Pages & homepage › Home.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { defaultBlockData } from "../src/lib/blocks/schemas";

const db = new PrismaClient();
const TYPE = "FLOW_DIAGRAM";
const LABEL = "Connection diagram";

interface DraftSection { id: string; type: string; label: string | null; isEnabled: boolean; data: Record<string, unknown>; reusableBlockId: string | null }
type DraftDelegate = {
  findUnique: (q: { where: { key: string } }) => Promise<{ key: string; value: unknown } | null>;
  update: (q: { where: { key: string }; data: { value: object } }) => Promise<unknown>;
};
const drafts = (db as unknown as { editDraft?: DraftDelegate }).editDraft;

async function main() {
  const home = await db.page.findUnique({ where: { slug: "home" }, include: { sections: { orderBy: { sortOrder: "asc" } } } });
  if (!home) throw new Error("No homepage found (page with slug “home”). Run the seed first: npx prisma db seed");
  const draftKey = `page:${home.id}`;
  const draft = drafts ? await drafts.findUnique({ where: { key: draftKey } }).catch(() => null) : null;
  const draftList = draft && Array.isArray(draft.value) ? (draft.value as DraftSection[]) : null;

  if (process.argv.includes("--remove")) {
    const { count } = await db.pageSection.deleteMany({ where: { pageId: home.id, type: TYPE } });
    if (draftList && draftList.some((s) => s.type === TYPE)) {
      await drafts!.update({ where: { key: draftKey }, data: { value: draftList.filter((s) => s.type !== TYPE) } });
    }
    console.log(count ? `✓ removed the ${LABEL} from the homepage` : `· the homepage had no ${LABEL}`);
    return;
  }

  if (home.sections.some((s) => s.type === TYPE)) {
    console.log(`· the homepage already has a ${LABEL}; nothing to do. Edit it in Admin › Website › Pages & homepage › Home.`);
    return;
  }

  // Place it after "How it works", else after the top banner, else at the end.
  const anchor = home.sections.find((s) => s.type === "HOW_IT_WORKS") ?? home.sections.find((s) => s.type === "HERO");
  const order = anchor ? anchor.sortOrder + 1 : (home.sections.at(-1)?.sortOrder ?? -1) + 1;
  const data = defaultBlockData(TYPE) as unknown as Prisma.InputJsonObject;

  const created = await db.$transaction(async (tx) => {
    // Make room: push every later section down by one.
    await tx.pageSection.updateMany({ where: { pageId: home.id, sortOrder: { gte: order } }, data: { sortOrder: { increment: 1 } } });
    return tx.pageSection.create({ data: { pageId: home.id, type: TYPE, label: LABEL, sortOrder: order, isEnabled: true, data } });
  });

  // An unpublished website-edit-mode draft keeps its own copy of the sections; add it there too,
  // so publishing that draft later doesn't drop the new section.
  if (draftList && !draftList.some((s) => s.type === TYPE)) {
    const at = draftList.findIndex((s) => s.type === (anchor?.type ?? ""));
    const entry: DraftSection = { id: created.id, type: TYPE, label: LABEL, isEnabled: true, data: data as Record<string, unknown>, reusableBlockId: null };
    const next = [...draftList];
    next.splice(at >= 0 ? at + 1 : next.length, 0, entry);
    await drafts!.update({ where: { key: draftKey }, data: { value: next } });
  }

  console.log(`✓ added the ${LABEL} to the homepage${anchor ? ` after “${anchor.label ?? anchor.type}”` : ""}.`);
  if (home.status !== "PUBLISHED") console.log("! The homepage itself is not published; publish it in Admin › Website › Pages & homepage.");
}

/** The homepage is cached by Next.js; clear the development cache so the change shows after a restart. */
async function clearDevCache() {
  await rm(path.join(process.cwd(), ".next", "cache", "fetch-cache"), { recursive: true, force: true }).catch(() => undefined);
  console.log("✓ cleared the development page cache. Restart `npm run dev` (Ctrl+C, then npm run dev) and refresh the homepage.");
}

main()
  .then(() => clearDevCache())
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
