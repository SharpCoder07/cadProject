import { requirePermission } from "@/server/auth/session";
import { compareShowcaseAdmin } from "@/server/services/comparisons";
import { PageHeader } from "@/components/admin/page-header";
import { ShowcaseEditor } from "./showcase-editor";

export const metadata = { title: "Compare page lists" };
export const dynamic = "force-dynamic";

export default async function CompareShowcasePage() {
  const user = await requirePermission("comparisons.view", "/admin/comparisons/showcase");
  const data = await compareShowcaseAdmin(user);
  return (
    <>
      <PageHeader
        title="Compare page lists"
        description="Choose what “Trending product comparisons” and “Popular comparisons by category” show on the compare page: automatic picks from popularity, or your own published comparisons (their pages open with your content)."
        back={{ href: "/admin/comparisons", label: "Comparisons" }}
      />
      <ShowcaseEditor initial={data.settings} auto={data.auto} comparisons={data.comparisons} />
    </>
  );
}
