import { ImageResponse } from "next/og";
import { getSettings } from "@/server/settings";

/**
 * Branded 1200×630 share image for pages without their own picture (used by buildMetadata).
 * GET /og?title=…&subtitle=…  — cached by browsers/CDNs for a day.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = (url.searchParams.get("title") || "").slice(0, 110);
  const subtitle = (url.searchParams.get("subtitle") || "").slice(0, 160);
  const { site, theme } = await getSettings();
  const host = (process.env.APP_URL || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const size = title.length > 70 ? 54 : title.length > 40 ? 64 : 76;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: `linear-gradient(135deg, ${theme.ink} 0%, ${theme.primary} 100%)`,
          color: "#fff",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", right: -120, top: -120, width: 420, height: 420, borderRadius: 9999, background: theme.accent, opacity: 0.18, display: "flex" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#fff", color: theme.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800 }}>
            {site.name.slice(0, 1)}
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -0.5 }}>{site.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1000 }}>
          <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.5 }}>{title || site.name}</div>
          {subtitle && <div style={{ fontSize: 28, lineHeight: 1.35, opacity: 0.82 }}>{subtitle.length > 140 ? `${subtitle.slice(0, 137)}…` : subtitle}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, opacity: 0.85 }}>
          <div style={{ display: "flex" }}>Compare · Shortlist · Buy the right software</div>
          {host && <div style={{ display: "flex", fontWeight: 700 }}>{host}</div>}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 10, background: theme.accent, display: "flex" }} />
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } },
  );
}
