import { ImageResponse } from "next/og";
import { getSettings } from "@/server/settings";

/**
 * Fallback favicon / home-screen icon (first letter on the brand colour), used only when no
 * favicon is uploaded in Settings. GET /brand-icon?size=64|180|512
 */
export async function GET(req: Request) {
  const n = Number(new URL(req.url).searchParams.get("size"));
  const size = [32, 64, 180, 192, 512].includes(n) ? n : 64;
  const { site, theme } = await getSettings();
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: theme.primary, color: "#fff", fontSize: Math.round(size * 0.62), fontWeight: 800, borderRadius: size <= 64 ? Math.round(size * 0.22) : 0 }}>
      {site.name.slice(0, 1)}
    </div>,
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
