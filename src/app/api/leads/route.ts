import { NextResponse, type NextRequest } from "next/server";
import { createLead, spamReason } from "@/server/services/leads";
import { enforce, RULES } from "@/server/rate-limit";
import { getRequestMeta } from "@/server/request";
import { assertSameOrigin, errorResponse, readJson } from "@/server/http";
import { AppError } from "@/server/errors";
import { getSettings } from "@/server/settings";
import { formSubmission, leadSubmission, type LeadSubmission } from "@/lib/validation/leads";
import { answersToLead, checkAnswers, FORM_META, resolveForm } from "@/lib/forms";
import { makeT } from "@/lib/site-texts";
import { z } from "zod";

/**
 * Website forms post here. Forms set up in Admin › Pages › Forms send `{ form, answers }`; the answers
 * are checked against that set-up and turned into the lead (custom fields go into the message).
 * The older fixed shape (name, email, phone…) is still accepted.
 */
const body = z.record(z.unknown());

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const meta = await getRequestMeta();
    const settings = await getSettings();
    await enforce({ ...RULES.lead, limit: settings.rules.leadsPerHour }, meta.ip, "You've sent several enquiries recently. Please wait a while or call us.");
    const data = await readJson(req, body);
    let input: LeadSubmission;
    let formChecked = false;
    if ("form" in data) {
      const raw = formSubmission.parse(data);
      const t = makeT(settings.texts);
      const def = resolveForm(raw.form, settings.forms[raw.form], { companySizes: settings.leads.companySizes, requireCompany: settings.leads.requireCompany });
      const { errors, clean } = checkAnswers(def, raw.answers, t, { compact: raw.form === "enquiry" && raw.compact });
      if (Object.keys(errors).length) {
        throw new AppError(t("forms.errCheck"), "BAD_REQUEST", Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, [v]])));
      }
      const lead = answersToLead(raw.form, def, clean);
      input = leadSubmission.parse({
        ...lead,
        message: lead.message?.slice(0, 2000) ?? null,
        softwareSlugs: raw.form === "enquiry" ? raw.softwareSlugs : [],
        source: raw.form === "enquiry" ? raw.source : FORM_META[raw.form].source,
        type: raw.form === "enquiry" ? raw.type : "PARTNERSHIP",
        sourceUrl: raw.sourceUrl,
        utmSource: raw.utmSource,
        utmMedium: raw.utmMedium,
        utmCampaign: raw.utmCampaign,
        consent: true,
        website: raw.website,
        startedAt: raw.startedAt,
      });
      formChecked = true;
    } else {
      input = leadSubmission.parse(data);
    }
    const spam = spamReason(input, Date.now(), settings.rules);
    // Silently accept likely bots so they don't learn what tripped the filter.
    if (spam) return NextResponse.json({ referenceNo: null }, { status: 201 });
    const lead = await createLead(input, meta, { formChecked });
    return NextResponse.json({ referenceNo: lead.referenceNo }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
