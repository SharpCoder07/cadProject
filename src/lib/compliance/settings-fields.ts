import type { BlockField } from "@/components/admin/blocks/block-fields";

const LEGAL = "Legal review: confirm with an Indian privacy/technology lawyer before relying on this.";

/** Compliance & Privacy › Compliance settings (stored in the "compliance" setting). */
export const COMPLIANCE_FIELDS: BlockField[] = [
  { name: "legalEntityName", label: "Legal entity name", type: "text", hint: "The company that operates the platform (the data fiduciary). Shown on legal documents and the grievance page." },
  { name: "cin", label: "CIN / registration number", type: "text" },
  { name: "gstin", label: "GSTIN", type: "text", hint: "Only if you invoice through the platform." },
  { name: "registeredAddress", label: "Registered business address", type: "textarea" },
  { name: "privacyEmail", label: "Privacy contact email", type: "text", hint: "Where people can write about their personal data. Shown publicly." },
  { name: "privacyPhone", label: "Privacy contact phone", type: "phone" },
  { name: "grievanceOfficerName", label: "Grievance officer: name", type: "text", hint: `Shown publicly on the grievance page. ${LEGAL}` },
  { name: "grievanceOfficerDesignation", label: "Grievance officer: designation", type: "text" },
  { name: "grievanceOfficerEmail", label: "Grievance officer: email", type: "text" },
  { name: "grievanceOfficerPhone", label: "Grievance officer: phone", type: "phone" },
  { name: "grievanceOfficerAddress", label: "Grievance officer: postal address", type: "textarea" },
  { name: "grievanceHours", label: "Grievance officer: working hours", type: "text", placeholder: "Mon–Fri, 10:00–18:00 IST" },
  { name: "dpoName", label: "Data Protection Officer: name (if designated)", type: "text", hint: `Only some data fiduciaries must appoint one. ${LEGAL}` },
  { name: "dpoEmail", label: "Data Protection Officer: email", type: "text" },
  { name: "grievanceAckDays", label: "Grievance: acknowledge within (days)", type: "number", min: 1, max: 365, hint: `Leave empty until confirmed. No timeline is assumed. ${LEGAL}` },
  { name: "grievanceResolveDays", label: "Grievance: resolve within (days)", type: "number", min: 1, max: 365, hint: `Leave empty until confirmed. ${LEGAL}` },
  { name: "dataRequestDays", label: "Data requests (access, correction, erasure): respond within (days)", type: "number", min: 1, max: 365, hint: `Leave empty until confirmed. ${LEGAL}` },
  { name: "contentComplaintDays", label: "Content complaints: act within (days)", type: "number", min: 1, max: 365, hint: `Notices about copyright, trademark, defamation or other unlawful content. Leave empty until confirmed. ${LEGAL}` },
  { name: "incidentReportHours", label: "Security incidents: internal decision on reporting within (hours)", type: "number", min: 1, max: 8760, hint: `Your internal target for deciding whether an incident must be reported (e.g. to CERT-In or the Data Protection Board). ${LEGAL}` },
  { name: "applicabilityNotes", label: "Applicability notes", type: "textarea", hint: "Record which laws and rules apply to your business model and their commencement dates as notified (e.g. DPDP Act 2023 and Rules 2025 phases, IT Rules 2021, Consumer Protection (E-Commerce) Rules 2020), as advised by your lawyer." },
  { name: "legalReviewDone", label: "Legal review completed", type: "switch", hint: "Turn on once a lawyer has reviewed these settings and the workflows that use them." },
  { name: "legalReviewNote", label: "Legal review note", type: "textarea", hint: "Who reviewed it and when." },
];

/** Compliance & Privacy › Consent and Cookies pages. */
export const CONSENT_FIELDS: BlockField[] = [
  { name: "privacyNoticeVersion", label: "Privacy notice version", type: "text", placeholder: "1.0", hint: "Saved with every consent so you can tell which notice the person saw. Raise it whenever the privacy policy changes." },
];
export const COOKIE_FIELDS: BlockField[] = [
  { name: "cookieBannerEnabled", label: "Show the cookie banner", type: "switch", hint: "While it's on, analytics and marketing scripts only load after the visitor allows them. Turning it off doesn't load them either: they stay off until a visitor opts in from Cookie settings." },
  { name: "cookieNoticeVersion", label: "Cookie notice version", type: "text", placeholder: "1.0", hint: "Raise it when you add cookies or change what a category is used for: every visitor is asked to choose again." },
  { name: "consentCookieDays", label: "Remember a visitor's choice for (days)", type: "number", min: 1, max: 730, hint: `How long before the banner asks again. ${LEGAL}` },
];
