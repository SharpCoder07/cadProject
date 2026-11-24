import { getSettings } from "@/server/settings";
import { listPublishedPosts } from "@/server/services/blog";
import { absoluteUrl } from "@/server/seo/metadata";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** RSS 2.0 feed of the latest 30 blog posts (linked from every page's <head>). */
export async function GET() {
  const [{ site }, { items }] = await Promise.all([getSettings(), listPublishedPosts({ page: 1, perPage: 30 })]);
  const entries = items
    .map((p) => {
      const url = absoluteUrl(`/blog/${p.slug}`);
      const date = p.publishedAt ? new Date(p.publishedAt).toUTCString() : new Date().toUTCString();
      return `    <item>\n      <title>${esc(p.title)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${date}</pubDate>${p.excerpt ? `\n      <description>${esc(p.excerpt)}</description>` : ""}\n    </item>`;
    })
    .join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(site.name)} blog</title>
    <link>${absoluteUrl("/blog")}</link>
    <description>${esc(`Software buying guides, news and articles from ${site.name}.`)}</description>
    <language>en-IN</language>
    <atom:link href="${absoluteUrl("/blog/feed.xml")}" rel="self" type="application/rss+xml" />
${entries}
  </channel>
</rss>
`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
