"use client";

import { Search, Star } from "lucide-react";
import { luminance, themeVariables, type ThemeInput } from "@/lib/theme";
import { fontVar } from "@/lib/font-choices";

type PreviewTheme = ThemeInput & { displayFont: string; bodyFont: string; headerStyle?: string; showAnnouncementBar?: boolean; footerNote?: string; announcementColor?: string; design?: string };

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Live preview of Website design: a small version of the website (announcement bar, header, hero,
 * product cards, footer) drawn with the values in the form, before they are saved. It uses the same
 * colour, font and corner variables as the real site, scoped to this box.
 */
export function ThemePreview({ theme }: { theme: PreviewTheme }) {
  // Half-typed colours would break the preview, so fall back to the defaults until they are complete.
  const safe: ThemeInput = {
    primary: HEX.test(theme.primary) ? theme.primary : "#0F766E",
    accent: HEX.test(theme.accent) ? theme.accent : "#F59E0B",
    ink: HEX.test(theme.ink) ? theme.ink : "#111827",
    background: HEX.test(theme.background) ? theme.background : "#F7F8FA",
    surface: HEX.test(theme.surface) ? theme.surface : "#FFFFFF",
    success: HEX.test(theme.success) ? theme.success : "#059669",
    radius: theme.radius ?? "soft",
  };
  const vars = { ...themeVariables(safe), "--font-display": fontVar(theme.displayFont), "--font-body": fontVar(theme.bodyFont) } as React.CSSProperties;
  const compact = theme.headerStyle === "compact";
  // Same rules as the website: announcement bar in Accent when chosen (or automatically when Primary is nearly
  // black, see components/site/header.tsx); Fresh Lime Design (design1) restyles the page.
  const accentBar = theme.announcementColor === "accent" || ((theme.announcementColor ?? "auto") === "auto" && luminance(safe.primary) < 0.03);
  const fresh = theme.design === "design1";
  const limeTint = safe.primary.toLowerCase() === "#00301e" && safe.accent.toLowerCase() === "#cdf757";
  const grad = limeTint
    ? "linear-gradient(294deg,#a4ea5b 7.55%,#53cf64 37.55%,#7bdc60 63.22%,#01b46d 94.19%)"
    : `linear-gradient(294deg,${safe.accent} 5%,${safe.primary} 95%)`;
  const gradText = { background: grad, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as React.CSSProperties;
  const products = [
    { name: "Ledgerline Books", by: "Ledgerline", price: "₹ 799", unit: "/user/month", rating: 4.6, reviews: 128, badge: "Free trial" },
    { name: "PayPilot HR", by: "PayPilot", price: "₹ 1,499", unit: "/month", rating: 4.3, reviews: 64, badge: "Popular" },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">Live preview</p>
      <div style={vars} className={`overflow-hidden rounded-xl border border-line ${fresh ? "bg-white" : "bg-bg"} font-sans text-ink shadow-[0_12px_32px_-20px_rgb(16_24_40/0.35)]`}>
        {theme.showAnnouncementBar !== false && (
          <div className={`px-3 py-1.5 text-center text-[11px] font-medium ${accentBar ? "bg-accent text-accent-fg" : "bg-primary text-primary-fg"}`}>New: compare up to three products side by side. <span className="underline">Try it</span></div>
        )}
        <div className={`flex items-center gap-3 border-b border-line bg-surface px-4 ${compact ? "py-2" : "py-3"}`}>
          <span className="font-display text-base font-extrabold text-primary">cadgram</span>
          <span className="flex h-8 flex-1 items-center gap-2 rounded-control border border-line bg-bg px-2.5 text-[11px] text-muted">
            <Search className="h-3.5 w-3.5" aria-hidden /> Search accounting, payroll, CRM…
          </span>
          <span className={`hidden bg-accent px-3 py-1.5 text-[11px] font-semibold text-accent-fg sm:inline ${fresh ? "rounded-[10px]" : "rounded-control"}`}>Get free quote</span>
        </div>
        <div className={`px-4 pb-5 pt-6 text-center ${fresh ? "bg-white" : "bg-[linear-gradient(180deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-surface))_100%)]"}`}>
          {fresh && <p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-primary">Software discovery platform</p>}
          <p className={`font-display text-xl leading-tight sm:text-2xl ${fresh ? "font-semibold tracking-[-0.03em]" : "font-extrabold tracking-[-0.01em]"}`}>
            Discover, compare and buy the right <span style={fresh ? gradText : undefined}>software</span>
          </p>
          <p className="mx-auto mt-2 max-w-sm text-xs text-muted">Compare prices, features and verified reviews of 1,000+ business tools.</p>
          {/* Like the website's hero search: icon and text, no button (Enter searches). */}
          <div className={`mx-auto mt-3 flex h-9 max-w-sm items-center gap-2 border border-primary/20 bg-surface px-3 text-left text-[11px] text-muted shadow-[0_10px_24px_-16px_rgb(var(--color-primary)/0.6)] ${fresh ? "rounded-full" : "rounded-control"}`}>
            <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="flex-1 truncate">Search accounting, payroll, CRM…</span>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {["Accounting", "Payroll", "CRM", "GST billing"].map((c) => (
              <span key={c} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-[11px]">{c}</span>
            ))}
          </div>
        </div>
        {fresh && (
          <div className="mx-4 mb-4 grid grid-cols-3 divide-x divide-line overflow-hidden rounded-[14px] border border-line bg-white text-center">
            {[["30+", "Products"], ["30+", "Categories"], ["80+", "Reviews"]].map(([n, l]) => (
              <div key={l} className="py-2"><p className="font-display text-base font-bold" style={gradText}>{n}</p><p className="text-[10px] text-muted">{l}</p></div>
            ))}
          </div>
        )}
        <div className="grid gap-3 px-4 pb-5 sm:grid-cols-2">
          {products.map((p) => (
            <div key={p.name} className={`border border-line p-3 ${fresh ? "rounded-[16px] bg-[linear-gradient(#fff,color-mix(in_srgb,rgb(var(--color-primary))_4%,#fff))]" : "rounded-panel bg-surface"}`}>
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-primary-soft font-display text-sm font-bold text-primary">{p.name[0]}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold">{p.name}</p>
                  <p className="text-[11px] text-muted">by {p.by}</p>
                </div>
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold text-success">{p.badge}</span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-[11px]">
                <Star className="h-3 w-3 text-accent" fill="currentColor" strokeWidth={0} aria-hidden />
                <span className="font-semibold">{p.rating}</span>
                <span className="text-muted">({p.reviews} reviews)</span>
              </p>
              <p className="mt-2 text-[11px] text-muted">Starting from <span className="font-display text-sm font-bold text-ink">{p.price}</span> {p.unit}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <span className="rounded-control border border-primary/40 py-1.5 text-center text-[11px] font-semibold text-primary">Compare</span>
                <span className={`bg-accent py-1.5 text-center text-[11px] font-semibold text-accent-fg ${fresh ? "rounded-[10px]" : "rounded-control"}`}>Get free quote</span>
              </div>
            </div>
          ))}
        </div>
        <div className={`px-4 py-3 text-[10px] ${fresh ? "rounded-t-[18px] border-t border-line bg-[#fafafa] text-ink/70" : "bg-band text-white/70"}`}>
          <span className={`font-display text-xs font-bold ${fresh ? "text-ink" : "text-surface"}`}>cadgram</span>
          {theme.footerNote ? <span> · {theme.footerNote}</span> : null}
        </div>
      </div>
      <p className="text-xs text-muted">Shows your unsaved changes. Press Save to apply them to the website.</p>
    </div>
  );
}
