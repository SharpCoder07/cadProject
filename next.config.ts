import type { NextConfig } from "next";

const storageHost = (() => {
  try {
    return process.env.STORAGE_PUBLIC_URL ? new URL(process.env.STORAGE_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

const isDev = process.env.NODE_ENV !== "production";

// Inline scripts are limited to JSON-LD, theme variables and the analytics snippets configured in Settings.
// Razorpay Checkout (vendor plan payments) loads its script and payment window from *.razorpay.com.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.clarity.ms https://www.facebook.com https://api.razorpay.com https://lumberjack.razorpay.com",
  "frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com https://www.googletagmanager.com https://api.razorpay.com https://checkout.razorpay.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://api.razorpay.com",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Trailing slashes are removed by the middleware with a 301 (so old /compare/?products[]=… links redirect in one step).
  skipTrailingSlashRedirect: true,
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      ...(storageHost ? [{ protocol: "https" as const, hostname: storageHost }] : []),
      { protocol: "https", hostname: "images.unsplash.com" },
      // Azure Blob Storage, Azure CDN and Azure Front Door (Admin → Integrations → Media storage).
      { protocol: "https", hostname: "*.blob.core.windows.net" },
      { protocol: "https", hostname: "*.azureedge.net" },
      { protocol: "https", hostname: "*.azurefd.net" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  serverExternalPackages: ["@node-rs/argon2", "sharp"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
