import Link from "next/link";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, ExternalLink, Repeat, Timer } from "lucide-react";
import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { PageHeader } from "@/components/admin/page-header";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { PageStats } from "@/components/admin/page-stats";
import { SettingsForm } from "../settings/settings-form";
import { SEO_FIELDS } from "../settings/fields";
import { deleteRedirectAction, saveRedirectAction } from "./actions";

export const metadata = { title: "SEO & redirects" };
export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const user = await requirePermission("seo.view", "/admin/seo");
  const [settings, redirects, noDesc, noLogo, hiddenProducts, catsNoDesc, postsNoExcerpt, termsNoDesc] = await Promise.all([
    getSettings(),
    db.redirect.findMany({ orderBy: { createdAt: "desc" } }),
    db.software.count({ where: { status: "PUBLISHED", OR: [{ shortDescription: null }, { shortDescription: "" }], seo: { is: null } } }),
    db.software.count({ where: { status: "PUBLISHED", logoId: null } }),
    db.software.count({ where: { status: "PUBLISHED", seo: { is: { noIndex: true } } } }),
    db.category.count({ where: { isActive: true, OR: [{ description: null }, { description: "" }] } }),
    db.post.count({ where: { status: "PUBLISHED", OR: [{ excerpt: null }, { excerpt: "" }] } }),
    db.taxonomyTerm.count({ where: { isActive: true, OR: [{ description: null }, { description: "" }], seoDescription: null } }),
  ]);
  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const local = /localhost|127\.0\.0\.1/.test(appUrl);
  const site = appUrl.replace(/\/$/, "");
  type Check = { ok: boolean; label: string; fix?: string; href?: string };
  const checks: Check[] = [
    { ok: settings.seo.allowIndexing, label: settings.seo.allowIndexing ? "Search engines are allowed to index the site" : "Indexing is switched off — the whole site is hidden from Google", fix: "Turn on “Allow search engines to index the site” below." },
    { ok: !local, label: local ? `Site address is ${appUrl}` : `Site address is ${appUrl}`, fix: "Set APP_URL on the server to your real domain before launch — canonicals, sitemap and share images use it." },
    { ok: Boolean(settings.seo.googleSiteVerification), label: settings.seo.googleSiteVerification ? "Google Search Console is verified" : "Google Search Console code not added", fix: "Paste the HTML-tag code from Search Console below, then submit /sitemap.xml there." },
    { ok: Boolean(settings.seo.bingSiteVerification), label: settings.seo.bingSiteVerification ? "Bing Webmaster Tools is verified" : "Bing Webmaster code not added", fix: "Optional, but Bing also powers other search engines." },
    { ok: Boolean(settings.site.logoUrl), label: settings.site.logoUrl ? "Logo set for Google’s organisation info" : "No site logo set", fix: "Upload it in Website settings → Branding.", href: "/admin/settings" },
    { ok: noDesc === 0, label: noDesc ? `${noDesc} live product${noDesc === 1 ? " has" : "s have"} no short description (used as the Google snippet)` : "Every live product has a description for Google", href: "/admin/software" },
    { ok: noLogo === 0, label: noLogo ? `${noLogo} live product${noLogo === 1 ? " has" : "s have"} no logo` : "Every live product has a logo", href: "/admin/software" },
    { ok: catsNoDesc === 0, label: catsNoDesc ? `${catsNoDesc} categor${catsNoDesc === 1 ? "y has" : "ies have"} no description` : "Every category has a description", href: "/admin/categories" },
    { ok: postsNoExcerpt === 0, label: postsNoExcerpt ? `${postsNoExcerpt} published post${postsNoExcerpt === 1 ? " has" : "s have"} no excerpt` : "Every published post has an excerpt", href: "/admin/blog" },
    { ok: termsNoDesc === 0, label: termsNoDesc ? `${termsNoDesc} classification page${termsNoDesc === 1 ? " has" : "s have"} no description` : "Every classification page has a description" },
  ];
  const passed = checks.filter((c) => c.ok).length;
  const permanent = redirects.filter((r) => r.statusCode === 301 || r.statusCode === 308).length;
  return (
    <>
      <PageHeader title="SEO & redirects" description="Manage SEO defaults and every URL redirect." actions={<CrudAddButton entity="redirect" label="Add redirect" />} />
      <PageStats
        items={[
          { label: "Redirects", value: redirects.length, icon: ArrowRightLeft, tone: "red", sub: "Old URLs forwarded" },
          { label: "Active", value: redirects.filter((r) => r.isActive).length, icon: CheckCircle2, tone: "green", sub: "Forwarding now" },
          { label: "Permanent", value: permanent, icon: Repeat, sub: "301 / 308" },
          { label: "Temporary", value: redirects.length - permanent, icon: Timer, sub: "302 / 307" },
        ]}
      />
      <div className="mb-6 grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel>
          <PanelHeader title="SEO health" description={`${passed} of ${checks.length} checks passed${hiddenProducts ? ` · ${hiddenProducts} live product${hiddenProducts === 1 ? " is" : "s are"} set to noindex` : ""}`} />
          <ul className="divide-y divide-line">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-3 px-5 py-3 text-sm">
                {c.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className={c.ok ? "text-ink" : "font-semibold text-ink"}>{c.label}</p>
                  {!c.ok && c.fix && <p className="mt-0.5 text-xs text-muted">{c.fix}</p>}
                </div>
                {!c.ok && c.href && <Link href={c.href} className="shrink-0 text-xs font-semibold text-mint-ink hover:underline">Fix</Link>}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader title="Site files & testing tools" description="Generated automatically from your content." />
          <ul className="divide-y divide-line text-sm">
            {[
              { label: "XML sitemap", href: "/sitemap.xml", note: "Submit this in Search Console" },
              { label: "robots.txt", href: "/robots.txt", note: "What search engines may crawl" },
              { label: "Blog RSS feed", href: "/blog/feed.xml", note: "Latest 30 posts" },
              { label: "Web app manifest", href: "/manifest.webmanifest", note: "Install icon and theme colour" },
              { label: "Google Rich Results Test", href: `https://search.google.com/test/rich-results?url=${encodeURIComponent(site + "/")}`, note: "Check structured data on a live page", external: true },
              { label: "PageSpeed Insights", href: `https://pagespeed.web.dev/analysis?url=${encodeURIComponent(site + "/")}`, note: "Speed and Core Web Vitals", external: true },
              { label: "Google Search Console", href: "https://search.google.com/search-console", note: "Indexing, queries and errors", external: true },
            ].map((l) => (
              <li key={l.label}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-bg/60">
                  <span className="min-w-0"><span className="block font-semibold text-ink">{l.label}</span><span className="block truncate text-xs text-muted">{l.note}</span></span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
          {local && <p className="border-t border-line px-5 py-3 text-xs text-muted">Google’s testing tools can’t reach localhost — use them once the site is live.</p>}
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel>
          <PanelHeader title="SEO defaults" description="Used across the website when a page has no SEO settings of its own." />
          <div className="p-5 sm:p-6">{user.permissions.has("settings.manage") ? <SettingsForm settingKey="seo" fields={SEO_FIELDS} initial={settings.seo} /> : <p className="text-sm text-muted">You need the website settings permission to change SEO defaults.</p>}</div>
        </Panel>
        <div className="min-w-0">
          <CrudManager
        addInHeader
            entity="redirect"
            newLabel="Add redirect"
            columns={["From", "To", "Type"]}
            rows={redirects.map((r) => ({ id: r.id, active: r.isActive, cells: [r.fromPath, r.toPath, `${r.statusCode}${r.note ? ` · ${r.note}` : ""}`], values: { fromPath: r.fromPath, toPath: r.toPath, statusCode: String(r.statusCode), isActive: r.isActive, note: r.note } }))}
            fields={[
              { name: "fromPath", label: "Old path", type: "text", required: true, placeholder: "/old-page" },
              { name: "toPath", label: "New path or URL", type: "text", required: true, placeholder: "/new-page" },
              { name: "statusCode", label: "Type", type: "select", options: [{ value: "301", label: "301 Permanent" }, { value: "302", label: "302 Temporary" }, { value: "308", label: "308 Permanent (keeps method)" }, { value: "307", label: "307 Temporary (keeps method)" }] },
              { name: "note", label: "Note", type: "text" },
              { name: "isActive", label: "Active", type: "switch" },
            ]}
            emptyValues={{ fromPath: "", toPath: "", statusCode: "301", isActive: true }}
            save={saveRedirectAction}
            remove={deleteRedirectAction}
          />
          <p className="mt-2 px-1 text-xs text-muted">Changing a product, category, page or post URL adds a redirect automatically.</p>
        </div>
      </div>
    </>
  );
}
