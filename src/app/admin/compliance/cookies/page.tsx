import { Ban, CheckCheck, Cookie, SlidersHorizontal } from "lucide-react";
import { requirePermission } from "@/server/auth/session";
import { can } from "@/server/rbac/policy";
import { getStoredSettings } from "@/server/settings";
import { db } from "@/server/db";
import { cookieLogQuery, cookiesToText, listCookieChoices } from "@/server/services/compliance/cookies";
import { COOKIE_FIELDS } from "@/lib/compliance/settings-fields";
import { formatDateTime } from "@/lib/format";
import { AdminTable, FilterBar, PageHeader } from "@/components/admin/page-header";
import { PageStats } from "@/components/admin/page-stats";
import { CrudAddButton, CrudManager } from "@/components/admin/crud-manager";
import { ListPanel, PanelEmpty, PanelPagination, SelectField, showing } from "@/components/admin/list-panel";
import { SettingsForm } from "../../settings/settings-form";
import { saveCookieCategoryAction, toggleCookieCategoryAction } from "../actions";

export const metadata = { title: "Cookies" };

type SP = { action?: string; page?: string };
const ACTION: Record<string, string> = { accept_all: "Accepted all", reject_all: "Rejected optional", custom: "Custom choice" };

/** Compliance & Privacy › Cookies: banner settings, cookie categories and the log of visitors' choices. */
export default async function CookiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("compliance.view", "/admin/compliance/cookies");
  const sp = await searchParams;
  const query = cookieLogQuery.parse({ action: sp.action || undefined, page: sp.page });
  const [categories, log, settings] = await Promise.all([
    db.cookieCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    listCookieChoices(user, query),
    getStoredSettings(),
  ]);
  const editable = can(user, "compliance.manage");
  const names = new Map(categories.map((c) => [c.key, c.name]));

  return (
    <>
      <PageHeader
        title="Cookies"
        description="The cookie banner, the categories visitors choose from, and a log of their choices. Analytics and marketing scripts (Settings › Analytics) only load after a visitor allows them."
        actions={editable ? <CrudAddButton entity="cookie-category" label="Add category" /> : undefined}
      />
      <PageStats
        items={[
          { label: "Accepted all (30 days)", value: log.last30.accept_all ?? 0, icon: CheckCheck, tone: "green", sub: "Banner choices" },
          { label: "Rejected optional (30 days)", value: log.last30.reject_all ?? 0, icon: Ban, tone: "red", sub: "Only necessary cookies" },
          { label: "Custom (30 days)", value: log.last30.custom ?? 0, icon: SlidersHorizontal, sub: "Chose per category" },
          { label: "Categories", value: categories.filter((c) => c.isActive).length, icon: Cookie, sub: "Shown in the banner" },
        ]}
      />

      {editable && (
        <section className="mb-6">
          <h2 className="mb-3 text-base font-semibold text-ink">Banner</h2>
          <SettingsForm settingKey="compliance" fields={COOKIE_FIELDS} initial={settings.compliance as Record<string, unknown>} />
          <p className="mt-2 text-xs text-muted">Change the banner wording in Pages › Website texts › Cookie banner and settings.</p>
        </section>
      )}

      <CrudManager
        addInHeader
        entity="cookie-category"
        newLabel="Add category"
        columns={["Category", "Type", "Cookies listed"]}
        rows={categories.map((c) => ({
          id: c.id,
          name: c.name,
          active: c.isActive,
          searchText: `${c.name} ${c.key} ${c.description}`,
          cells: [
            <span key="n"><span className="block font-medium text-ink">{c.name}</span><span className="block max-w-md text-xs text-muted">{c.description}</span></span>,
            c.isNecessary ? "Always on" : "Visitor chooses",
            String(Array.isArray(c.cookies) ? c.cookies.length : 0),
          ],
          values: { key: c.key, name: c.name, description: c.description, isNecessary: c.isNecessary, sortOrder: c.sortOrder, cookies: cookiesToText(c.cookies) },
        }))}
        fields={[
          { name: "name", label: "Name", type: "text", required: true },
          { name: "key", label: "Key", type: "text", required: true, hint: "Lower-case. The website uses analytics (Google Analytics, Clarity, Tag Manager) and marketing (Meta Pixel) to decide which scripts may load." },
          { name: "description", label: "Description", type: "textarea", required: true, hint: "Shown to visitors in Cookie settings." },
          { name: "isNecessary", label: "Strictly necessary (always on)", type: "switch", hint: "Only for cookies the website can't work without." },
          { name: "cookies", label: "Cookies in this category", type: "textarea", placeholder: "_ga | Google Analytics | 2 years | Distinguishes visitors", hint: "One per line: name | provider | how long | what for." },
          { name: "sortOrder", label: "Order", type: "number" },
        ]}
        emptyValues={{ key: "", name: "", description: "", isNecessary: false, sortOrder: categories.length, cookies: "" }}
        save={saveCookieCategoryAction}
        toggle={editable ? toggleCookieCategoryAction : undefined}
        emptyText="No categories yet. Run npm run db:migrate to add the starting set."
      />

      <div className="mt-6">
        <ListPanel
          title="Cookie choices"
          meta={showing(log.page, 50, log.total)}
          filters={
            <FilterBar action="/admin/compliance/cookies" bare>
              <SelectField name="action" label="Choice" value={sp.action}>
                <option value="">Any choice</option>
                {Object.entries(ACTION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </SelectField>
            </FilterBar>
          }
          footer={<PanelPagination page={log.page} pages={log.pages} basePath="/admin/compliance/cookies" params={sp} />}
        >
          {log.rows.length === 0 ? (
            <PanelEmpty icon={<Cookie className="h-5 w-5" />} title="No choices logged yet">They appear when visitors use the cookie banner.</PanelEmpty>
          ) : (
            <AdminTable bare minWidth={56}>
              <thead>
                <tr><th>When</th><th>Visitor</th><th>Choice</th><th>Allowed</th><th>Notice</th></tr>
              </thead>
              <tbody>
                {log.rows.map((r) => {
                  const on = Object.entries((r.choices ?? {}) as Record<string, boolean>).filter(([k, v]) => v && k !== "necessary").map(([k]) => names.get(k) ?? k);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</td>
                      <td><code className="text-xs text-muted">{r.visitorId.slice(0, 8)}…</code>{r.userId && <span className="block text-xs text-muted">Signed in</span>}</td>
                      <td>{ACTION[r.action] ?? r.action}</td>
                      <td>{on.length ? on.join(", ") : "Strictly necessary only"}</td>
                      <td className="text-muted">v{r.noticeVersion}</td>
                    </tr>
                  );
                })}
              </tbody>
            </AdminTable>
          )}
        </ListPanel>
      </div>
    </>
  );
}
