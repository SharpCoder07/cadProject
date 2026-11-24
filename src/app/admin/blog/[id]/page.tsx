import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listRevisions } from "@/server/revisions";
import { ExternalLink } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { PostEditor } from "../post-editor";

export const metadata = { title: "Post" };

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("blog.view", `/admin/blog/${id}`);
  const isNew = id === "new";
  const [post, authors, categories, revisions] = await Promise.all([
    isNew ? null : db.post.findUnique({ where: { id }, include: { seo: true, cover: true, tags: { include: { tag: true } }, software: true } }),
    db.author.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.blogCategory.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    isNew ? [] : listRevisions("post", id),
  ]);
  if (!isNew && !post) notFound();
  return (
    <>
      <PageHeader
        title={post?.title ?? "New post"}
        back={{ href: "/admin/blog", label: "Blog" }}
        actions={post && (
          <a href={post.status === "PUBLISHED" ? `/blog/${post.slug}` : `/blog/${post.slug}?preview=${post.previewKey}`} target="_blank" rel="noopener" className={buttonClass("secondary", "sm")}>
            {post.status === "PUBLISHED" ? "View post" : "Preview"} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      />
      <PostEditor
        id={post?.id ?? null}
        status={post?.status}
        previewKey={post?.previewKey}
        scheduledAt={post?.scheduledAt?.toISOString() ?? null}
        coverPreview={post?.cover?.url}
        authors={authors}
        categories={categories}
        canPublish={user.permissions.has("cms.publish")}
        revisions={revisions.map((r) => ({ id: r.id, version: r.version, message: r.message, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null }))}
        defaults={{
          title: post?.title ?? "", slug: post?.slug ?? "", type: post?.type ?? "ARTICLE", excerpt: post?.excerpt ?? null, content: post?.content ?? "", coverId: post?.coverId ?? null,
          authorId: post?.authorId ?? null, categoryId: post?.categoryId ?? null, tags: post?.tags.map((t) => t.tag.name) ?? [], softwareIds: post?.software.map((s) => s.softwareId) ?? [],
          isFeatured: post?.isFeatured ?? false, revisionMessage: null,
          seo: { title: post?.seo?.title ?? null, description: post?.seo?.description ?? null, keywords: post?.seo?.keywords ?? null, canonicalUrl: post?.seo?.canonicalUrl ?? null, noIndex: post?.seo?.noIndex ?? false, ogImageId: post?.seo?.ogImageId ?? null },
        }}
      />
    </>
  );
}
