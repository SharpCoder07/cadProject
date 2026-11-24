import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Inbox, MapPin, Users } from "lucide-react";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/server/seo/metadata";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ListingForm } from "../list-your-software/listing-form";
import { makeT } from "@/lib/site-texts";
import { EditRegion } from "@/components/site/edit-mode";
import { Roadmap } from "@/components/site/roadmap";

export async function generateMetadata(): Promise<Metadata> {
  const { site, texts } = await getSettings();
  const t = makeT(texts);
  return buildMetadata({ path: "/become-a-reseller", title: t("becomeReseller.metaTitle"), description: t("becomeReseller.metaDescription", { site: site.name }) });
}

const BENEFITS = [{ icon: BadgeCheck, n: 1 }, { icon: Inbox, n: 2 }, { icon: MapPin, n: 3 }, { icon: Users, n: 4 }];
const STEPS = [1, 2, 3, 4, 5];

export default async function BecomeResellerPage() {
  const { site, leads, texts } = await getSettings();
  const t = makeT(texts);
  return (
    <EditRegion label="Become a reseller" actions={[{ label: "Edit wording", href: "/admin/cms/texts?group=becomeReseller" }, { label: "Form fields", href: "/admin/cms/forms?form=becomeReseller" }]}>
    <div className="container py-8">
      <Breadcrumbs items={[{ name: t("becomeReseller.breadcrumb"), path: "/become-a-reseller" }]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_minmax(0,32rem)] lg:gap-14">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("becomeReseller.eyebrow")}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">{t("becomeReseller.heading", { site: site.name })}</h1>
          <p className="mt-3 max-w-xl text-muted">{t("becomeReseller.lead")}</p>
          <a href="#apply" className="mt-5 inline-flex h-11 items-center rounded-control bg-accent px-5 text-sm font-semibold text-accent-fg lg:hidden">{t("becomeReseller.applyNow")}</a>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {BENEFITS.map((b) => ({ ...b, title: t(`becomeReseller.benefit${b.n}Title`), text: t(`becomeReseller.benefit${b.n}Text`) })).filter((b) => b.title).map((b) => (
              <li key={b.n} className="flex gap-3 rounded-panel border border-line bg-surface p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><b.icon className="h-5 w-5" aria-hidden /></span>
                <span>
                  <span className="block font-semibold text-ink">{b.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">{b.text}</span>
                </span>
              </li>
            ))}
          </ul>

          <Roadmap
            eyebrow={t("becomeReseller.howEyebrow") || undefined}
            title={t("becomeReseller.howTitle")}
            counter={t("becomeReseller.stepCounter")}
            steps={STEPS.map((n) => ({ label: t(`becomeReseller.step${n}Label`), text: t(`becomeReseller.step${n}`) })).filter((s) => s.text).map((s, i) => ({ ...s, label: s.label || String(i + 1) }))}
          />
          <p className="mt-8 text-sm text-muted">
            {t("becomeReseller.signInQ")} <Link href="/login?as=reseller" className="font-semibold text-primary hover:underline">{t("becomeReseller.signInLink")}</Link>
            <span className="mx-2">·</span>
            {t("becomeReseller.otherQ")} <Link href="/list-your-software" className="font-semibold text-primary hover:underline">{t("becomeReseller.otherLink")}</Link>
          </p>
        </div>

        <div id="apply" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <div className="cg-apply rounded-panel border border-line bg-surface p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-ink">{t("becomeReseller.formTitle")}</h2>
            <p className="mb-5 mt-1 text-sm text-muted">{t("becomeReseller.formText")}</p>
            <ListingForm consentText={leads.consentText} variant="reseller" />
          </div>
        </div>
      </div>
    </div>
    </EditRegion>
  );
}
