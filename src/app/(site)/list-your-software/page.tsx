import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, MessageSquareText, Search, Tag } from "lucide-react";
import { getSettings } from "@/server/settings";
import { buildMetadata } from "@/server/seo/metadata";
import { Breadcrumbs } from "@/components/site/breadcrumbs";
import { ListingForm } from "./listing-form";
import { makeT } from "@/lib/site-texts";
import { EditRegion } from "@/components/site/edit-mode";
import { Roadmap } from "@/components/site/roadmap";

export async function generateMetadata(): Promise<Metadata> {
  const { site, texts } = await getSettings();
  const t = makeT(texts);
  return buildMetadata({ path: "/list-your-software", title: t("listSoftware.metaTitle"), description: t("listSoftware.metaDescription", { site: site.name }) });
}

const BENEFITS = [{ icon: Search, n: 1 }, { icon: MessageSquareText, n: 2 }, { icon: BadgeCheck, n: 3 }, { icon: Tag, n: 4 }];
const STEPS = [1, 2, 3, 4, 5];

export default async function ListYourSoftwarePage() {
  const { site, leads, texts } = await getSettings();
  const t = makeT(texts);
  return (
    <EditRegion label="List your software" actions={[{ label: "Edit wording", href: "/admin/cms/texts?group=listSoftware" }, { label: "Form fields", href: "/admin/cms/forms?form=listSoftware" }]}>
    <div className="container py-8">
      <Breadcrumbs items={[{ name: t("listSoftware.breadcrumb"), path: "/list-your-software" }]} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_minmax(0,32rem)] lg:gap-14">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("listSoftware.eyebrow")}</p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ink sm:text-4xl">{t("listSoftware.heading", { site: site.name })}</h1>
          <p className="mt-3 max-w-xl text-muted">{t("listSoftware.lead")}</p>
          <a href="#apply" className="mt-5 inline-flex h-11 items-center rounded-control bg-accent px-5 text-sm font-semibold text-accent-fg lg:hidden">{t("listSoftware.applyNow")}</a>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {BENEFITS.map((b) => ({ ...b, title: t(`listSoftware.benefit${b.n}Title`), text: t(`listSoftware.benefit${b.n}Text`) })).filter((b) => b.title).map((b) => (
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
            eyebrow={t("listSoftware.howEyebrow") || undefined}
            title={t("listSoftware.howTitle")}
            counter={t("listSoftware.stepCounter")}
            steps={STEPS.map((n) => ({ label: t(`listSoftware.step${n}Label`), text: t(`listSoftware.step${n}`) })).filter((s) => s.text).map((s, i) => ({ ...s, label: s.label || String(i + 1) }))}
          />
          <p className="mt-8 text-sm text-muted">
            {t("listSoftware.signInQ")} <Link href="/login?as=vendor" className="font-semibold text-primary hover:underline">{t("listSoftware.signInLink")}</Link>
            <span className="mx-2">·</span>
            {t("listSoftware.otherQ")} <Link href="/become-a-reseller" className="font-semibold text-primary hover:underline">{t("listSoftware.otherLink")}</Link>
          </p>
        </div>

        <div id="apply" className="scroll-mt-24 lg:sticky lg:top-24 lg:self-start">
          <div className="cg-apply rounded-panel border border-line bg-surface p-6 shadow-sm">
            <h2 className="font-display text-xl font-semibold text-ink">{t("listSoftware.formTitle")}</h2>
            <p className="mb-5 mt-1 text-sm text-muted">{t("listSoftware.formText")}</p>
            <ListingForm consentText={leads.consentText} />
          </div>
        </div>
      </div>
    </div>
    </EditRegion>
  );
}
