import { requirePermission } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/page-header";
import { TextsEditor } from "./texts-editor";

export const metadata = { title: "Website texts" };
export const dynamic = "force-dynamic";

export default async function WebsiteTextsPage({ searchParams }: { searchParams: Promise<{ group?: string; q?: string }> }) {
  await requirePermission("settings.manage", "/admin/cms/texts");
  const [{ texts }, sp] = await Promise.all([getSettings(), searchParams]);
  return (
    <>
      <PageHeader
        title="Website texts"
        description="Every fixed heading, button, label and message on the website. Change the wording here; leave a text as it is to keep the default. Words in {curly brackets} are filled in by the page (a product name, a city…)."
      />
      <TextsEditor saved={texts} initialGroup={sp.group} initialQuery={sp.q} />
    </>
  );
}
