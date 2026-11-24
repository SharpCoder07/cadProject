import { z } from "zod";
import { email, optionalText, phone, requiredText, urlQuery } from "./common";
import { istDate } from "./cms";
import { answersSchema, FORM_KEYS } from "@/lib/forms";

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "DEMO_SCHEDULED", "PROPOSAL", "WON", "LOST", "SPAM"] as const;
export const LEAD_SOURCES = ["PRODUCT_PAGE", "CATEGORY_PAGE", "COMPARE_PAGE", "CONTACT_PAGE", "CMS_FORM", "GET_ADVICE", "LIST_SOFTWARE", "BECOME_RESELLER"] as const;

/** What the buyer asked for. Set from the button or form they used; staff can change it. */
export const LEAD_TYPES = ["ENQUIRY", "QUOTE", "DEMO", "TRIAL", "PURCHASE", "CALLBACK", "PARTNERSHIP"] as const;
export type LeadTypeKey = (typeof LEAD_TYPES)[number];
export const LEAD_TYPE_LABEL: Record<LeadTypeKey, string> = {
  ENQUIRY: "Enquiry",
  QUOTE: "Price quote",
  DEMO: "Demo",
  TRIAL: "Free trial",
  PURCHASE: "Purchase",
  CALLBACK: "Call back",
  PARTNERSHIP: "Partnership",
};
/** Type for a lead whose form didn't say: partner sign-ups are partnerships, everything else an enquiry. */
export const defaultLeadType = (source: string): LeadTypeKey => (source === "LIST_SOFTWARE" || source === "BECOME_RESELLER" ? "PARTNERSHIP" : "ENQUIRY");

export const LEAD_STATUS_LABEL: Record<(typeof LEAD_STATUSES)[number], string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  DEMO_SCHEDULED: "Demo scheduled",
  PROPOSAL: "Proposal sent",
  WON: "Won",
  LOST: "Lost",
  SPAM: "Spam",
};

export const LEAD_SOURCE_LABEL: Record<(typeof LEAD_SOURCES)[number], string> = {
  PRODUCT_PAGE: "Product page",
  CATEGORY_PAGE: "Category page",
  COMPARE_PAGE: "Comparison",
  CONTACT_PAGE: "Contact page",
  CMS_FORM: "Page form",
  GET_ADVICE: "Get advice",
  LIST_SOFTWARE: "List your software",
  BECOME_RESELLER: "Become a reseller",
};

/** Public enquiry form. `website` is a honeypot that real users never fill. */
export const leadSubmission = z.object({
  name: requiredText(100),
  email,
  phone,
  company: optionalText(120),
  companySize: optionalText(40),
  city: optionalText(80),
  requirement: optionalText(200),
  message: optionalText(2000),
  softwareSlugs: z.array(z.string().max(80)).max(4).default([]),
  source: z.enum(LEAD_SOURCES).default("PRODUCT_PAGE"),
  type: z.enum(LEAD_TYPES).optional().catch(undefined),
  sourceUrl: z.string().max(500).optional(),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  utmCampaign: optionalText(100),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree so we can contact you." }) }),
  website: z.string().max(0, "Leave this field empty").optional().default(""),
  startedAt: z.coerce.number().optional(),
});
export type LeadSubmission = z.infer<typeof leadSubmission>;

/** Enquiry / partner form set up in Admin › Pages › Forms: answers are checked against that set-up on the server. */
export const formSubmission = z.object({
  form: z.enum(FORM_KEYS),
  answers: answersSchema,
  compact: z.boolean().default(false),
  softwareSlugs: z.array(z.string().max(80)).max(4).default([]),
  source: z.enum(LEAD_SOURCES).default("PRODUCT_PAGE"),
  type: z.enum(LEAD_TYPES).optional().catch(undefined),
  sourceUrl: z.string().max(500).optional(),
  utmSource: optionalText(100),
  utmMedium: optionalText(100),
  utmCampaign: optionalText(100),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree so we can contact you." }) }),
  website: z.string().max(0, "Leave this field empty").optional().default(""),
  startedAt: z.coerce.number().optional(),
});
export type LeadFormValues = z.input<typeof leadSubmission>;

export const leadListQuery = urlQuery({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum([...LEAD_STATUSES, "ALL", "OPEN"]).catch("OPEN"),
  source: z.enum([...LEAD_SOURCES, "ALL"]).catch("ALL"),
  type: z.enum([...LEAD_TYPES, "ALL"]).catch("ALL"),
  assignee: z.string().max(40).optional().catch(undefined), // user id, "me" or "none"
  softwareId: z.string().cuid().optional().catch(undefined),
  /** A reseller id, or "any" for leads forwarded to any reseller. */
  reseller: z.string().max(40).optional().catch(undefined),
  from: z.coerce.date().optional().catch(undefined),
  to: z.coerce.date().optional().catch(undefined),
  followUp: z.enum(["due", "upcoming"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
  perPage: z.coerce.number().int().min(10).max(100).catch(25),
});
export type LeadListQuery = z.infer<typeof leadListQuery>;

export const leadUpdate = z.object({
  id: z.string().cuid(),
  status: z.enum(LEAD_STATUSES).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH"]).optional(),
  type: z.enum(LEAD_TYPES).optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
});

/** Admin form version: follow-up comes from a datetime-local input (IST, or "" to clear). */
export const leadUpdateForm = leadUpdate.extend({
  nextFollowUpAt: z.preprocess((v) => (v === "" ? null : istDate(v)), z.coerce.date().nullable().optional()),
});

export const leadNote = z.object({ leadId: z.string().cuid(), body: requiredText(4000) });
