import Link from "next/link";
import { CalendarClock, History, Mail } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { EditRegion } from "./edit-mode";
import type { T } from "@/lib/site-texts";

/** Adds ids to the h2 headings and returns the "On this page" list. */
export function withToc(html: string): { html: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (_m, attrs: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    let id = /\bid="([^"]+)"/.exec(attrs)?.[1] ?? (text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section");
    while (used.has(id)) id += "-2";
    used.add(id);
    toc.push({ id, text });
    return `<h2${attrs.replace(/\s*\bid="[^"]*"/, "")} id="${id}">${inner}</h2>`;
  });
  return { html: out, toc };
}

/**
 * Legal page layout (Website pages with the Legal template and Compliance › Legal documents): title, date line,
 * "On this page" list, questions box and the document text.
 */
export function LegalLayout({ t, title, path, dateLine, notice, html, email, editActions, editLive, history }: {
  t: T;
  title: string;
  path: string;
  dateLine: string;
  notice?: React.ReactNode;
  html: string;
  email?: string | null;
  editActions: { label: string; href: string }[];
  editLive?: React.ComponentProps<typeof EditRegion>["live"];
  history?: { label: string; href: string; current: boolean }[];
}) {
  const { html: body, toc } = withToc(html);
  return (
    <>
      <EditRegion label="Page title" actions={editActions}>
        <header className="border-b border-line bg-[linear-gradient(180deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-bg))_100%)]">
          <div className="container py-8 sm:py-10">
            <Breadcrumbs items={[{ name: title, path }]} />
            <h1 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[2.6rem]">{title}</h1>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden /> {dateLine}
            </p>
          </div>
        </header>
      </EditRegion>
      {notice}
      <EditRegion label="Page text" live={editLive} actions={editActions}>
        <div className="container grid gap-8 py-8 sm:py-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
          <aside className="order-2 space-y-4 lg:order-1">
            <div className="space-y-4 lg:sticky lg:top-36">
              {toc.length > 1 && (
                <nav aria-label={t("page.onThisPage")} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{t("page.onThisPage")}</p>
                  <ol className="mt-3 space-y-1 text-sm">
                    {toc.map((x, i) => (
                      <li key={x.id}>
                        <a href={`#${x.id}`} className="flex gap-2 rounded-md px-2 py-1.5 text-ink/80 hover:bg-primary-soft hover:text-primary">
                          <span className="tabular-nums text-muted">{i + 1}.</span>{x.text}
                        </a>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              {history && history.length > 1 && (
                <nav aria-label={t("legal.history")} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-muted"><History className="h-3.5 w-3.5" aria-hidden />{t("legal.history")}</p>
                  <ol className="mt-3 space-y-1 text-sm">
                    {history.map((h) => (
                      <li key={h.href}>
                        <Link href={h.href} aria-current={h.current ? "page" : undefined} className={`block rounded-md px-2 py-1.5 ${h.current ? "bg-primary-soft font-semibold text-primary" : "text-ink/80 hover:bg-primary-soft hover:text-primary"}`}>{h.label}</Link>
                      </li>
                    ))}
                  </ol>
                </nav>
              )}
              {email && (
                <div className="rounded-2xl border border-line bg-surface p-4 text-sm">
                  <p className="font-semibold text-ink">{t("page.questionsTitle")}</p>
                  <p className="mt-1 text-muted">{t("page.questionsText")}</p>
                  <a href={`mailto:${email}`} className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
                    <Mail className="h-4 w-4" aria-hidden /> {email}
                  </a>
                </div>
              )}
            </div>
          </aside>
          <article className="order-1 min-w-0 rounded-[1.5rem] border border-line bg-surface p-6 shadow-[0_24px_60px_-48px_rgb(var(--color-ink)/0.4)] sm:p-10 lg:order-2">
            {body ? <div className="prose-content max-w-none [&_h2]:scroll-mt-40" dangerouslySetInnerHTML={{ __html: body }} /> : <p className="text-muted">{t("page.empty")}</p>}
          </article>
        </div>
      </EditRegion>
    </>
  );
}
