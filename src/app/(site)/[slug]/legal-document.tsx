import Link from "next/link";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { getT } from "@/server/texts";
import { previewLegalVersion, publicLegalDocument } from "@/server/services/compliance/legal";
import { formatDate } from "@/lib/format";
import { LegalLayout } from "@/components/site/legal-layout";

/**
 * A legal document from Compliance › Legal documents at /<slug>: the version in force, an earlier one
 * (?version=1.0), or a draft/scheduled version for staff with Compliance access (?legalPreview=<id>).
 * Returns null when no version is in force, so a Website page with the same address shows instead.
 */
export async function renderLegalDocument(slug: string, version?: string, previewId?: string) {
  const t = await getT();
  if (previewId) {
    const user = await getCurrentUser().catch(() => null);
    const v = await previewLegalVersion(user, slug, previewId).catch(() => null);
    if (v) {
      return (
        <>
          <p className="bg-warning/15 py-2 text-center text-sm">{t("legal.previewBanner", { version: v.version, status: v.status === "DRAFT" ? t("legal.statusDraft") : v.effectiveAt ? t("legal.statusScheduled", { date: formatDate(v.effectiveAt) }) : v.status.toLowerCase() })}</p>
          <LegalLayout t={t} title={v.title} path={`/${slug}`} dateLine={t("legal.versionLine", { version: v.version, date: v.effectiveAt ? formatDate(v.effectiveAt) : "—" })} html={v.content} editActions={[{ label: "Back to Legal documents", href: "/admin/compliance/legal" }]} />
        </>
      );
    }
  }
  const doc = await publicLegalDocument(slug, version);
  if (!doc) return null;
  const s = await getSettings();
  const old = doc.shown.id !== doc.current.id;
  const notice = old ? (
    <div className="border-b border-warning/30 bg-warning/10">
      <p className="container py-2.5 text-sm text-ink">
        {t("legal.olderNotice", { version: doc.shown.version })}{" "}
        <Link href={`/${doc.slug}`} className="font-semibold text-primary hover:underline">{t("legal.seeCurrent")}</Link>
      </p>
    </div>
  ) : doc.upcoming ? (
    <div className="border-b border-line bg-primary-soft/60">
      <p className="container py-2.5 text-sm text-ink">{t("legal.upcomingNotice", { version: doc.upcoming.version, date: formatDate(doc.upcoming.effectiveAt) })}</p>
    </div>
  ) : null;
  return (
    <LegalLayout
      t={t}
      title={doc.shown.title}
      path={`/${doc.slug}`}
      dateLine={t("legal.versionLine", { version: doc.shown.version, date: formatDate(doc.shown.effectiveAt) })}
      notice={notice}
      html={doc.shown.content}
      email={s.compliance?.privacyEmail || s.site.contactEmail}
      editActions={[{ label: "Edit in Legal documents", href: `/admin/compliance/legal/${doc.id}` }]}
      editLive={[{ kind: "texts", id: "legal", section: "texts", title: "Wording", only: ["legal.*", "page.onThisPage", "page.questions*"] }]}
      history={doc.history.map((h) => ({ label: t("legal.historyItem", { version: h.version, date: formatDate(h.effectiveAt) }), href: h.version === doc.current.version ? `/${doc.slug}` : `/${doc.slug}?version=${encodeURIComponent(h.version)}`, current: h.version === doc.shown.version }))}
    />
  );
}
