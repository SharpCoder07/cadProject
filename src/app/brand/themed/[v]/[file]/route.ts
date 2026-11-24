import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSettings } from "@/server/settings";
import { BRAND_FILES, recolorBrandSvg, themeTag, type BrandFile } from "@/lib/brand-logo";

/**
 * The built-in Cadgram logo in the website's theme colours: /brand/themed/<colours>/<file>.svg. The colours
 * are part of the address, so each theme gets its own URL and browsers can keep it for good.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ v: string; file: string }> }) {
  const { v, file } = await params;
  if (!(BRAND_FILES as readonly string[]).includes(file)) return new Response("Not found", { status: 404 });
  const { theme } = await getSettings();
  const svg = await readFile(path.join(process.cwd(), "public", "brand", file), "utf8").catch(() => null);
  if (!svg) return new Response("Not found", { status: 404 });
  // The address carries the two colours (primary + text, 12 hex digits), so the admin can ask for its own shade.
  const m = /^([0-9a-f]{6})([0-9a-f]{6})$/.exec(v);
  const colors = m ? { primary: `#${m[1]}`, ink: `#${m[2]}` } : theme;
  const current = Boolean(m) || themeTag(theme) === v;
  return new Response(recolorBrandSvg(svg, file as BrandFile, colors), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // An old colour address still answers (with today's colours), but isn't cached long.
      "Cache-Control": current ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
