import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Mail, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { getT } from "@/server/texts";
import { buildMetadata } from "@/server/seo/metadata";
import { isBuyerRoleKey } from "@/server/rbac/permissions";
import { formatPhone } from "@/lib/countries";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { CaseForm } from "@/components/compliance/case-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return buildMetadata({ path: "/privacy-center", title: t("privacyCenter.title"), description: t("privacyCenter.intro") });
}

/** Public Privacy center: rights, grievance officer and the request/complaint form (Compliance & Privacy). */
export default async function PrivacyCenterPage({ searchParams }: { searchParams: Promise<{ type?: string; kind?: string }> }) {
  const [t, s, user, sp] = await Promise.all([getT(), getSettings(), getCurrentUser().catch(() => null), searchParams]);
  const c = s.compliance;
  const buyer = user && isBuyerRoleKey(user.roleKey) ? user : null;
  const officerEmail = c.grievanceOfficerEmail || c.privacyEmail;
  const kind = sp.kind === "grievance" ? "GRIEVANCE" : sp.kind === "content" ? "CONTENT_COMPLAINT" : "DATA_REQUEST";
  return (
    <>
      <header className="border-b border-line bg-[linear-gradient(180deg,rgb(var(--color-primary-soft))_0%,rgb(var(--color-bg))_100%)]">
        <div className="container py-8 sm:py-10">
          <Breadcrumbs items={[{ name: t("privacyCenter.title"), path: "/privacy-center" }]} />
          <h1 className="mt-3 text-[2rem] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[2.6rem]">{t("privacyCenter.title")}</h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{t("privacyCenter.intro")}</p>
        </div>
      </header>
      <div className="container grid gap-8 py-8 sm:py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="pc-form" className="rounded-[1.5rem] border border-line bg-surface p-6 sm:p-8">
          <h2 id="pc-form" className="mb-5 text-xl font-bold text-ink">{t("privacyCenter.formTitle")}</h2>
          <CaseForm kind={kind} initialType={sp.type} account={buyer ? { name: buyer.name, email: buyer.email } : null} />
        </section>
        <aside className="space-y-4">
          {buyer && (
            <div className="rounded-2xl border border-primary/30 bg-primary-soft/50 p-5 text-sm">
              <p className="flex items-center gap-2 font-semibold text-ink"><UserRound className="h-4 w-4 text-primary" aria-hidden />{t("privacyCenter.accountTitle")}</p>
              <p className="mt-1 text-muted">{t("privacyCenter.accountText")}</p>
              <Link href="/account/privacy" className="mt-3 inline-block font-semibold text-primary hover:underline">{t("privacyCenter.accountLink")}</Link>
            </div>
          )}
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden />{t("privacyCenter.rightsTitle")}</p>
            <ul className="mt-3 space-y-2 text-muted">
              {[1, 2, 3, 4, 5].map((n) => t(`privacyCenter.right${n}`)).filter(Boolean).map((r) => (
                <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{r}</li>
              ))}
            </ul>
          </div>
          {(c.grievanceOfficerName || officerEmail) && (
            <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
              <p className="font-semibold text-ink">{t("privacyCenter.officerTitle")}</p>
              {c.grievanceOfficerName && <p className="mt-2 text-ink">{c.grievanceOfficerName}{c.grievanceOfficerDesignation && <span className="text-muted">, {c.grievanceOfficerDesignation}</span>}</p>}
              {c.legalEntityName && <p className="text-muted">{c.legalEntityName}</p>}
              <div className="mt-3 space-y-1.5">
                {officerEmail && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" aria-hidden /><a href={`mailto:${officerEmail}`} className="text-primary hover:underline">{officerEmail}</a></p>}
                {c.grievanceOfficerPhone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" aria-hidden />{formatPhone(c.grievanceOfficerPhone)}</p>}
                {c.grievanceOfficerAddress && <p className="flex items-start gap-2 whitespace-pre-line text-muted"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{c.grievanceOfficerAddress}</p>}
                {c.grievanceHours && <p className="text-muted">{t("privacyCenter.officerHours", { hours: c.grievanceHours })}</p>}
              </div>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
