import { requirePermission } from "@/server/auth/session";
import { getSettings } from "@/server/settings";
import { PageHeader } from "@/components/admin/page-header";
import { FORM_KEYS, type FormKey } from "@/lib/forms";
import { FormsEditor } from "./forms-editor";

export const metadata = { title: "Forms" };
export const dynamic = "force-dynamic";

export default async function FormsPage({ searchParams }: { searchParams: Promise<{ form?: string }> }) {
  await requirePermission("settings.manage", "/admin/cms/forms");
  const [settings, sp] = await Promise.all([getSettings(), searchParams]);
  const initial = (FORM_KEYS as readonly string[]).includes(sp.form ?? "") ? (sp.form as FormKey) : "enquiry";
  return (
    <>
      <PageHeader
        title="Forms"
        description="Choose the fields on the website's enquiry and partner forms: rename them, change the order, make them required or optional, hide them, or add your own questions. Answers to your own questions appear in the lead's message."
      />
      <FormsEditor
        saved={settings.forms}
        initialForm={initial}
        companySizes={settings.leads.companySizes}
        requireCompany={settings.leads.requireCompany}
        consentText={settings.leads.consentText}
        enquiry={{ submitLabel: settings.labels.enquireCta, successMessage: settings.labels.leadSuccess }}
      />
    </>
  );
}
