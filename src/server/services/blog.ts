import "server-only";
import type { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { db, type Tx } from "@/server/db";
import { audit } from "@/server/audit";
import { AppError, isUniqueViolation, notFound } from "@/server/errors";
import { recordRevision } from "@/server/revisions";
import { sanitizeRichText } from "@/server/sanitize";
import { assertCan, type Principal } from "@/server/rbac/policy";
import { excerpt, readingMinutes, slugify } from "@/lib/utils";
import type { PostInput } from "@/lib/validation/cms";
import { upsertSeo } from "./seo";
import { addSlugRedirect } from "./navigation";
import { moveToBin, withBin } from "@/server/system/trash";
import { guardDelete } from "@/server/rbac/deletion";

export const BLOG_TAG = "blog";
const postTag = (slug: string) => `post:${slug}`;

function revalidate(...slugs: (string | undefined)[]) {
  revalidateTag(BLOG_TAG);
  for (const s of slugs) if (s) revalidateTag(postTag(s));
}

// ─── Public ──────────────────────────────────────────────────────────────────

export const postCardSelect = {
  id: true, title: true, slug: true, type: true, excerpt: true, publishedAt: true, readingMinutes: true,
  cover: { select: { url: true, alt: true } },
  author: { select: { name: true, slug: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.PostSelect;
export type PostCard = Prisma.PostGetPayload<{ select: typeof postCardSelect }>;

export const listPublishedPosts = unstable_cache(
  async (opts: { page?: number; perPage?: number; categorySlug?: string; tagSlug?: string; authorSlug?: string; type?: string; softwareId?: string; softwareIds?: string[]; q?: string; excludeIds?: string[] }) => {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 12;
    const where: Prisma.PostWhereInput = {
      status: "PUBLISHED",
      ...(opts.categorySlug ? { category: { slug: opts.categorySlug } } : {}),
      ...(opts.tagSlug ? { tags: { some: { tag: { slug: opts.tagSlug } } } } : {}),
      ...(opts.authorSlug ? { author: { slug: opts.authorSlug } } : {}),
      ...(opts.type && opts.type !== "ANY" ? { type: opts.type as Prisma.EnumPostTypeFilter["equals"] } : {}),
      ...(opts.softwareId ? { software: { some: { softwareId: opts.softwareId } } } : {}),
      ...(opts.softwareIds?.length ? { software: { some: { softwareId: { in: opts.softwareIds } } } } : {}),
      ...(opts.excludeIds?.length ? { id: { notIn: opts.excludeIds } } : {}),
      ...(opts.q?.trim()
        ? { OR: [{ title: { contains: opts.q.trim(), mode: "insensitive" as const } }, { excerpt: { contains: opts.q.trim(), mode: "insensitive" as const } }, { tags: { some: { tag: { name: { contains: opts.q.trim(), mode: "insensitive" as const } } } } }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.post.findMany({ where, orderBy: { publishedAt: "desc" }, skip: (page - 1) * perPage, take: perPage, select: postCardSelect }),
      db.post.count({ where }),
    ]);
    return { items, total, page, pages: Math.max(1, Math.ceil(total / perPage)) };
  },
  ["blog:list"],
  { tags: [BLOG_TAG], revalidate: 900 },
);

/** "What matters now" on the blog: featured posts first, topped up with the newest. */
export const blogTopStories = unstable_cache(
  async (limit: number) => db.post.findMany({ where: { status: "PUBLISHED" }, orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }], take: limit, select: postCardSelect }),
  ["blog:top"],
  { tags: [BLOG_TAG], revalidate: 900 },
);

/** "Specialist coverage": each blog category that has posts, with its three newest. */
export const blogTopics = unstable_cache(
  async (perTopic: number) => {
    const cats = await db.blogCategory.findMany({
      where: { posts: { some: { status: "PUBLISHED" } } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        slug: true,
        description: true,
        posts: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: perTopic, select: postCardSelect },
        _count: { select: { posts: { where: { status: "PUBLISHED" } } } },
      },
    });
    return cats.map((c) => ({ name: c.name, slug: c.slug, description: c.description, total: c._count.posts, posts: c.posts }));
  },
  ["blog:topics"],
  { tags: [BLOG_TAG], revalidate: 900 },
);

export const getPublishedPost = (slug: string) =>
  unstable_cache(
    () =>
      db.post.findFirst({
        where: { slug, status: "PUBLISHED" },
        include: {
          seo: { include: { ogImage: true } },
          cover: true,
          author: { include: { avatar: true } },
          category: true,
          tags: { include: { tag: true } },
          software: { include: { software: { select: { id: true } } } },
        },
      }),
    ["post", slug],
    { tags: [BLOG_TAG, postTag(slug)], revalidate: 3600 },
  )();

// ─── Admin ───────────────────────────────────────────────────────────────────

async function writeTags(tx: Tx, postId: string, tags: string[], softwareIds: string[]) {
  await tx.postTag.deleteMany({ where: { postId } });
  for (const name of new Set(tags)) {
    const slug = slugify(name);
    if (!slug) continue;
    const tag = await tx.blogTag.upsert({ where: { slug }, create: { slug, name }, update: {} });
    await tx.postTag.create({ data: { postId, tagId: tag.id } });
  }
  await tx.postSoftware.deleteMany({ where: { postId } });
  if (softwareIds.length) await tx.postSoftware.createMany({ data: softwareIds.map((softwareId) => ({ postId, softwareId })), skipDuplicates: true });
}

const postData = (input: PostInput) => {
  const content = sanitizeRichText(input.content) ?? "";
  return {
    title: input.title,
    slug: input.slug,
    type: input.type,
    excerpt: input.excerpt ?? excerpt(content, 200),
    content,
    readingMinutes: readingMinutes(content),
    coverId: input.coverId,
    authorId: input.authorId,
    categoryId: input.categoryId,
    isFeatured: input.isFeatured,
  };
};

async function snapshot(tx: Tx, id: string) {
  const p = await tx.post.findUniqueOrThrow({ where: { id }, include: { seo: true, tags: { include: { tag: true } }, software: true } });
  return JSON.parse(JSON.stringify(p)) as Prisma.InputJsonValue;
}

export async function savePost(user: Principal, id: string | null, input: PostInput) {
  assertCan(user, id ? "blog.manage" : "blog.create");
  const existing = id ? await db.post.findUnique({ where: { id }, select: { slug: true, seoId: true } }) : null;
  if (id && !existing) throw notFound("Post");
  try {
    const post = await db.$transaction(async (tx) => {
      const seoId = await upsertSeo(tx, existing?.seoId ?? null, input.seo);
      const p = id ? await tx.post.update({ where: { id }, data: { ...postData(input), seoId } }) : await tx.post.create({ data: { ...postData(input), seoId } });
      await writeTags(tx, p.id, input.tags, input.softwareIds);
      await recordRevision(tx, "post", p.id, await snapshot(tx, p.id), user.id, input.revisionMessage ?? (id ? undefined : "Created"));
      await audit({ actorId: user.id, action: id ? "post.update" : "post.create", entityType: "post", entityId: p.id, summary: p.title }, tx);
      return p;
    }, { timeout: 20_000 });
    if (existing && existing.slug !== post.slug) await addSlugRedirect(`/blog/${existing.slug}`, `/blog/${post.slug}`);
    revalidate(existing?.slug, post.slug);
    return post;
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new AppError("Another post already uses that URL.", "CONFLICT", { slug: ["Already in use"] });
    throw e;
  }
}

export async function setPostStatus(user: Principal, id: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED", scheduledAt?: Date | null) {
  assertCan(user, "cms.publish");
  const post = await db.post.findUnique({ where: { id } });
  if (!post) throw notFound("Post");
  const scheduled = status === "PUBLISHED" && scheduledAt && scheduledAt > new Date();
  await db.post.update({
    where: { id },
    data: scheduled ? { status: "DRAFT", scheduledAt } : { status, scheduledAt: null, ...(status === "PUBLISHED" && !post.publishedAt ? { publishedAt: new Date() } : {}) },
  });
  await audit({ actorId: user.id, action: scheduled ? "post.schedule" : `post.status.${status.toLowerCase()}`, entityType: "post", entityId: id, summary: post.title });
  revalidate(post.slug);
}

export async function deletePost(user: Principal, id: string) {
  await guardDelete(user, "post", { id });
  const post = await db.post.findUnique({ where: { id } });
  if (!post) throw notFound("Post");
  await db.$transaction(async (tx) => {
    await moveToBin(tx, user, "Post", [id]);
    await tx.post.delete({ where: { id } });
    if (post.seoId) await tx.seoMeta.delete({ where: { id: post.seoId } }).catch(() => undefined);
    await tx.revision.deleteMany({ where: { entityType: "post", entityId: id } });
    await audit({ actorId: user.id, action: "post.delete", entityType: "post", entityId: id, summary: post.title }, tx);
  }, { timeout: 60_000, maxWait: 10_000 });
  revalidate(post.slug);
}

export async function publishDuePosts(): Promise<number> {
  const due = await db.post.findMany({ where: { scheduledAt: { lte: new Date() } }, select: { id: true, slug: true, publishedAt: true } });
  for (const p of due) await db.post.update({ where: { id: p.id }, data: { status: "PUBLISHED", scheduledAt: null, publishedAt: p.publishedAt ?? new Date() } });
  if (due.length) revalidate(...due.map((d) => d.slug));
  return due.length;
}

export async function restorePostRevision(user: Principal, revisionId: string) {
  const rev = await db.revision.findUnique({ where: { id: revisionId } });
  if (!rev || rev.entityType !== "post") throw notFound("Revision");
  const s = rev.snapshot as unknown as {
    title: string; slug: string; type: PostInput["type"]; excerpt: string | null; content: string; coverId: string | null; authorId: string | null;
    categoryId: string | null; isFeatured: boolean; tags: { tag: { name: string } }[]; software: { softwareId: string }[];
    seo: { title: string | null; description: string | null; keywords: string | null; canonicalUrl: string | null; noIndex: boolean; ogImageId: string | null } | null;
  };
  return savePost(user, rev.entityId, {
    title: s.title, slug: s.slug, type: s.type, excerpt: s.excerpt, content: s.content, coverId: s.coverId, authorId: s.authorId, categoryId: s.categoryId,
    isFeatured: s.isFeatured, tags: s.tags.map((t) => t.tag.name), softwareIds: s.software.map((x) => x.softwareId),
    seo: s.seo ?? { title: null, description: null, keywords: null, canonicalUrl: null, noIndex: false, ogImageId: null },
    revisionMessage: `Restored version ${rev.version}`,
  });
}

export async function saveAuthor(user: Principal, id: string | null, input: { name: string; slug: string; bio: string | null; jobTitle: string | null; avatarId?: string | null; userId?: string | null }) {
  assertCan(user, id ? "blog.manage" : "blog.create");
  const data = { ...input, avatarId: input.avatarId ?? null, userId: input.userId ?? null };
  try {
    const a = id ? await db.author.update({ where: { id }, data }) : await db.author.create({ data });
    revalidate();
    return a;
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("That slug or user is already linked to another author.", "CONFLICT");
    throw e;
  }
}

export async function saveBlogCategory(user: Principal, id: string | null, input: { name: string; slug: string; description: string | null }) {
  assertCan(user, id ? "blog.manage" : "blog.create");
  try {
    const c = id ? await db.blogCategory.update({ where: { id }, data: input }) : await db.blogCategory.create({ data: input });
    revalidate();
    return c;
  } catch (e) {
    if (isUniqueViolation(e, "slug")) throw new AppError("Another category uses that slug.", "CONFLICT", { slug: ["Already in use"] });
    throw e;
  }
}

export async function deleteAuthor(user: Principal, id: string) {
  await guardDelete(user, "author", { id });
  await withBin(user, "Author", [id], (tx) => tx.author.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "blog.author.delete", entityType: "author", entityId: id, summary: "Deleted a blog author" });
}

export async function deleteBlogCategory(user: Principal, id: string) {
  await guardDelete(user, "blogCategory", { id });
  await withBin(user, "BlogCategory", [id], (tx) => tx.blogCategory.delete({ where: { id } }));
  await audit({ actorId: user.id, action: "blog.category.delete", entityType: "blogCategory", entityId: id, summary: "Deleted a blog category" });
}
