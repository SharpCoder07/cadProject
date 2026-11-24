import { absoluteUrl } from "@/server/seo/metadata";
import { generateSitemaps } from "../sitemaps/sitemap";

export const dynamic = "force-dynamic";


/** Sitemap index pointing at the chunked sitemaps under /sitemaps/sitemap/{id}.xml. */
export async function GET() {
  const ids = await generateSitemaps();
  const now = new Date().toISOString();
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ids
    .map(({ id }) => `  <sitemap><loc>${absoluteUrl(`/sitemaps/sitemap/${id}.xml`)}</loc><lastmod>${now}</lastmod></sitemap>`)
    .join("\n")}\n</sitemapindex>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
