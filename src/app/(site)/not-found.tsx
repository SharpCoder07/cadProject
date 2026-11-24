import Link from "next/link";
import { SearchBox } from "@/components/site/search-box";
import { getT } from "@/server/texts";
import { getSettings } from "@/server/settings";
import { searchExamples } from "@/lib/search-examples";

export default async function NotFound() {
  const [t, settings] = await Promise.all([getT(), getSettings()]);
  return (
    <div className="container py-20">
      <p className="text-sm font-medium text-primary">{t("notFound.code")}</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{t("notFound.heading")}</h1>
      <p className="mt-3 max-w-xl text-muted">{t("notFound.text")}</p>
      <SearchBox placeholder={t("notFound.search")} hints={searchExamples(settings.labels)} className="mt-6 max-w-xl" />
      {t("notFound.link") && (
        <p className="mt-6 text-sm">
          <Link href={t("notFound.linkUrl") || "/categories"} className="text-primary hover:underline">{t("notFound.link")}</Link>
        </p>
      )}
    </div>
  );
}
