import { FileText, ImageOff, UserRound } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { PageHeader } from "@/components/admin/page-header";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { PageStats } from "@/components/admin/page-stats";
import { ItemTitle } from "@/components/admin/list-panel";

import { deleteAuthorAction, saveAuthorAction } from "../actions";

export const metadata = { title: "Authors" };

export default async function AuthorsPage() {
  await requirePermission("blog.view", "/admin/blog/authors");
  const authors = await db.author.findMany({ orderBy: { name: "asc" }, include: { avatar: { select: { url: true } }, _count: { select: { posts: true } } } });
  return (
    <>
      <PageHeader title="Authors" description="Manage every author credited on your blog." actions={<CrudAddButton entity="author" label="Add author" />} />
      <PageStats
        items={[
          { label: "Authors", value: authors.length, icon: UserRound, tone: "red", sub: "Credited on posts" },
          { label: "Posts written", value: authors.reduce((n, a) => n + a._count.posts, 0), icon: FileText, tone: "green", sub: "Across all authors" },
          { label: "Without a photo", value: authors.filter((a) => !a.avatar).length, icon: ImageOff, sub: "Show initials instead" },
        ]}
      />
      <CrudManager
        addInHeader
        entity="author" newLabel="Add author" columns={["Author", "Posts"]}
        rows={authors.map((a) => ({ id: a.id, name: a.name, searchText: `${a.name} ${a.jobTitle ?? ""}`, cells: [<ItemTitle key="t" round image={a.avatar?.url} title={a.name} sub={a.jobTitle} />, String(a._count.posts)], values: { name: a.name, slug: a.slug, jobTitle: a.jobTitle, bio: a.bio, avatarId: a.avatarId, _avatar: a.avatar?.url } }))}
        fields={[
          { name: "name", label: "Name", type: "text", required: true }, { name: "slug", label: "URL slug", type: "text", required: true },
          { name: "jobTitle", label: "Job title", type: "text" }, { name: "avatarId", label: "Photo", type: "media", previewKey: "_avatar" },
          { name: "bio", label: "Bio", type: "textarea" },
        ]}
        emptyValues={{ name: "", slug: "" }} save={saveAuthorAction} remove={deleteAuthorAction}
      />
    </>
  );
}
