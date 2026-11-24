import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIES = ["__Host-cg_session", "cg_session"];

// Redirect rules are cached per instance for a minute to avoid a lookup on every request.
let redirectCache: { at: number; map: Record<string, { to: string; status: number }> } | null = null;
const REDIRECT_TTL_MS = 60_000;

async function redirectsFor(req: NextRequest) {
  if (redirectCache && Date.now() - redirectCache.at < REDIRECT_TTL_MS) return redirectCache.map;
  try {
    const res = await fetch(new URL("/api/redirects", req.nextUrl.origin), { headers: { "x-internal": "1" } });
    if (res.ok) redirectCache = { at: Date.now(), map: (await res.json()) as Record<string, { to: string; status: number }> };
  } catch {
    /* keep serving without redirects if the lookup fails */
  }
  return redirectCache?.map ?? {};
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Old comparison links (?products[]=…, ?p=a,b), with or without the trailing slash: one 301 to /compare/a-vs-b.
  if ((pathname === "/compare" || pathname === "/compare/") && /[?&](p|product|products(%5B\d*%5D|\[\d*\])?)=/i.test(search)) {
    return NextResponse.rewrite(new URL(`/api/compare/legacy${search}`, req.url));
  }
  // One address per page: drop a trailing slash with a permanent redirect (/compare/a-vs-b/ → /compare/a-vs-b).
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url, req.method === "GET" || req.method === "HEAD" ? 301 : 308);
  }

  // Staff, vendor and buyer areas: cheap cookie gate here; real session + permission checks run server-side.
  // Matched as whole path segments, so public pages like /vendors aren't caught by "/vendor".
  if (/^\/(admin|vendor|reseller|account)(\/|$)/.test(pathname)) {
    const hasSession = SESSION_COOKIES.some((c) => req.cookies.has(c));
    if (!hasSession) {
      const login = new URL("/login", req.url);
      login.searchParams.set("next", pathname + search);
      return NextResponse.redirect(login);
    }
    // The reseller portal is the partner portal under its own address: /reseller/… shows /vendor/….
    const reseller = req.cookies.get("cg_portal")?.value === "reseller";
    if (reseller && /^\/vendor(\/|$)/.test(pathname)) {
      return NextResponse.redirect(new URL(pathname.replace(/^\/vendor/, "/reseller") + search, req.url));
    }
    // ?embed=1: an admin screen opened inside the website's edit-mode side panel (no sidebar or top bar).
    const embedded = /^\/admin(\/|$)/.test(pathname) && req.nextUrl.searchParams.get("embed") === "1";
    const headers = new Headers(req.headers);
    if (embedded) headers.set("x-cg-embed", "1");
    else headers.delete("x-cg-embed");
    // Admin and portals always work on the live data, never on website edit-mode drafts.
    headers.set("x-cg-area", "staff");
    // Where the request went, for Error logs (server actions and API errors).
    headers.set("x-cg-path", pathname);
    const res = /^\/reseller(\/|$)/.test(pathname)
      ? NextResponse.rewrite(new URL(pathname.replace(/^\/reseller/, "/vendor") + search, req.url))
      : NextResponse.next({ request: { headers } });
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }

  if (req.method === "GET" && !pathname.startsWith("/api")) {
    const map = await redirectsFor(req);
    const key = pathname.toLowerCase().replace(/\/$/, "") || "/";
    const rule = map[key];
    if (rule) {
      const target = new URL(rule.to, req.url);
      if (!/^https?:\/\//.test(rule.to)) target.search = search;
      return NextResponse.redirect(target, rule.status);
    }
  }
  // Where the request went, for Error logs (server actions and API errors). Always set here, never trusted from the client.
  const headers = new Headers(req.headers);
  headers.set("x-cg-path", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Skip static assets and image optimisation.
  matcher: ["/((?!_next/static|_next/image|uploads/|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|css|js|woff2?)$).*)"],
};
