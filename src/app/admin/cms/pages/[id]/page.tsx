import { db } from "@/server/db";
import { requirePermission } from "@/server/auth/session";
import { listRevisions } from "@/server/revisions";
import { getPageForEdit } from "@/server/services/cms";
import { canDeleteSections } from "@/lib/section-delete";
import { draftKey, getDraft } from "@/server/edit-drafts";
import { Panel, PanelHeader } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader } from "@/components/admin/page-header";
import { PageBuilder } from "@/components/admin/blocks/page-builder";
import { PageMetaForm, PagePublishPanel } from "../page-meta-form";

export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("cms.pages.view", `/admin/cms/pages/${id}`);
  const [page, reusable, revisions, draft] = await Promise.all([getPageForEdit(user, id), db.reusableBlock.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }), listRevisions("page", id), getDraft(draftKey.page(id))]);
  return (
    <>
      <PageHeader title={page.title} description={page.slug === "home" ? "This is your homepage. Reorder and edit its sections below." : undefined} back={{ href: "/admin/cms/pages", label: "Pages" }} />
      {draft !== null && (
        <p className="mb-4 rounded-panel border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-ink" role="status">
          <strong>This page has unpublished changes made on the website (edit mode).</strong> The sections below are the live ones. Publish or discard those changes from the website&apos;s edit bar first — publishing them later replaces what you save here.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <div className="min-w-0">
          <Tabs
            tabs={[
              {
                id: "sections",
                label: "Sections",
                content: (
                  <PageBuilder
                    canDelete={canDeleteSections(user)}
                    pageId={page.id}
                    reusable={reusable}
                    initial={page.sections.map((s) => ({ key: s.id, id: s.id, type: s.type, label: s.label, isEnabled: s.isEnabled, data: (s.data as Record<string, unknown>) ?? {}, reusableBlockId: s.reusableBlockId, reusableName: s.reusableBlock?.name }))}
                  />
                ),
              },
              {
                id: "settings",
                label: "Page settings & SEO",
                content: (
                  <Panel>
                    <PanelHeader title="Page settings" />
                    <div className="p-5">
                      <PageMetaForm
                        id={page.id}
                        isSystem={page.isSystem}
                        defaults={{ title: page.title, slug: page.slug, template: page.template, seo: { title: page.seo?.title ?? null, description: page.seo?.description ?? null, keywords: page.seo?.keywords ?? null, canonicalUrl: page.seo?.canonicalUrl ?? null, noIndex: page.seo?.noIndex ?? false, ogImageId: page.seo?.ogImageId ?? null } }}
                      />
                    </div>
                  </Panel>
                ),
              },
            ]}
            urlParam="tab"
          />
        </div>
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <PagePublishPanel
            id={page.id}
            slug={page.slug}
            status={page.status}
            isSystem={page.isSystem}
            previewKey={page.previewKey}
            publishedAt={page.publishedAt?.toISOString() ?? null}
            scheduledAt={page.scheduledAt?.toISOString() ?? null}
            canPublish={user.permissions.has("cms.publish")}
            revisions={revisions.map((r) => ({ id: r.id, version: r.version, message: r.message, createdAt: r.createdAt.toISOString(), author: r.author?.name ?? null }))}
          />
        </aside>
      </div>
    </>
  );
}
