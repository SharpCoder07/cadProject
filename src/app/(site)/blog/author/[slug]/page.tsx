import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { listPublishedPosts } from "@/server/services/blog";
import { buildMetadata } from "@/server/seo/metadata";
import { formatDate } from "@/lib/format";
import { absoluteUrl } from "@/server/seo/metadata";
import { itemListLd } from "@/server/seo/jsonld";
import { JsonLd } from "@/components/site/json-ld";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { EditRegion } from "@/components/site/edit-mode";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await db.author.findUnique({ where: { slug: (await params).slug } });
  if (!a) return {};
  const posts = await db.post.count({ where: { status: "PUBLISHED", author: { slug: a.slug } } });
  return buildMetadata({ path: `/blog/author/${a.slug}`, title: `Articles by ${a.name}`, description: a.bio || `${a.name}${a.jobTitle ? `, ${a.jobTitle}` : ""} — articles and buying guides.`, noIndex: posts === 0 });
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const author = await db.author.findUnique({ where: { slug } });
  if (!author) notFound();
  const { items } = await listPublishedPosts({ authorSlug: slug, perPage: 50 });
  return (
    <EditRegion label="Author page" actions={[{ label: "Edit authors", href: "/admin/blog/authors" }, { label: "Wording", href: "/admin/cms/texts?group=blog" }]}>
    <div className="container max-w-3xl py-8">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            url: absoluteUrl(`/blog/author/${author.slug}`),
            mainEntity: { "@type": "Person", name: author.name, jobTitle: author.jobTitle ?? undefined, description: author.bio ?? undefined },
          },
          ...[itemListLd(`Articles by ${author.name}`, items.map((p) => ({ name: p.title, path: `/blog/${p.slug}` })))].filter((x): x is Record<string, unknown> => Boolean(x)),
        ]}
      />
      <Breadcrumbs items={[{ name: "Blog", path: "/blog" }, { name: author.name, path: `/blog/author/${author.slug}` }]} />
      <h1 className="mt-4 text-3xl font-semibold">{author.name}</h1>
      {author.jobTitle && <p className="text-muted">{author.jobTitle}</p>}
      {author.bio && <p className="mt-4 text-ink">{author.bio}</p>}
      <ul className="mt-8 divide-y divide-line">
        {items.map((p) => (
          <li key={p.id} className="py-4">
            <Link href={`/blog/${p.slug}`} className="font-medium hover:text-primary">{p.title}</Link>
            <p className="text-sm text-muted">{formatDate(p.publishedAt)}</p>
          </li>
        ))}
      </ul>
    </div>
    </EditRegion>
  );
}
