import { requirePermission } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/page-header";
import { LAYOUT_KEYS, type LayoutPageKey } from "@/lib/layouts";
import { LayoutsEditor } from "./layouts-editor";

export const metadata = { title: "Page layouts" };
export const dynamic = "force-dynamic";

export default async function LayoutsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("settings.manage", "/admin/cms/layouts");
  const [settings, sp] = await Promise.all([getSettings(), searchParams]);
  const initial = (LAYOUT_KEYS as string[]).includes(sp.page ?? "") ? (sp.page as LayoutPageKey) : "product";
  const s = settings.detail.sections;
  return (
    <>
      <PageHeader
        title="Page layouts"
        description="Choose which sections appear on every product, category, blog article, brand and vendor page, and in what order. A section with nothing to show (no FAQs, no screenshots…) stays hidden on that page anyway."
      />
      <LayoutsEditor
        saved={settings.layouts}
        initialPage={initial}
        productDefaults={{ overview: s.overview, features: s.features, gallery: s.screenshots, pricing: s.pricing, specifications: s.specifications, faqs: s.faqs, reviews: s.reviews, alternatives: s.alternatives, vendor: s.vendor, articles: s.relatedArticles }}
      />
    </>
  );
}
