/** Data requests and grievances: labels, input rules and timing (shared by the website, admin and tests). */
import { z } from "zod";

export type CaseKind = "DATA_REQUEST" | "GRIEVANCE" | "CONTENT_COMPLAINT";
export type CaseStatus = "PENDING_VERIFICATION" | "OPEN" | "IN_PROGRESS" | "AWAITING_REQUESTER" | "RESOLVED" | "REJECTED" | "CLOSED";

export const REQUEST_TYPES = [
  { value: "access", label: "Get a copy of my data", hint: "A summary of the personal data we hold about you and how it's used." },
  { value: "correction", label: "Correct or update my data", hint: "Tell us what's wrong or out of date." },
  { value: "erasure", label: "Delete my account and data", hint: "We'll erase what we don't have to keep by law and tell you what we kept and why." },
  { value: "withdraw_consent", label: "Withdraw my consent", hint: "Stop optional uses such as marketing emails." },
  { value: "nominate", label: "Nominate someone", hint: "Name a person who can act for you if you're unable to." },
  { value: "other", label: "Something else about my data", hint: "" },
] as const;
export const GRIEVANCE_TYPES = [
  { value: "privacy", label: "How my personal data is handled" },
  { value: "account", label: "My account" },
  { value: "content", label: "Content on the website (reviews, listings)" },
  { value: "listing", label: "A software listing or price" },
  { value: "vendor", label: "A vendor or reseller" },
  { value: "other", label: "Something else" },
] as const;
export const CONTENT_TYPES = [
  { value: "copyright", label: "Copyright (text, images or software copied without permission)" },
  { value: "trademark", label: "Trademark or brand misuse" },
  { value: "defamation", label: "False or defamatory statements" },
  { value: "personal_info", label: "My personal information published without consent" },
  { value: "unlawful", label: "Other unlawful content" },
  { value: "other", label: "Something else" },
] as const;
export const CONTENT_ACTIONS = [
  { value: "removed", label: "Removed" },
  { value: "disabled", label: "Access disabled" },
  { value: "edited", label: "Edited" },
  { value: "no_action", label: "No action (not upheld)" },
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number]["value"];
export type RequestType = (typeof REQUEST_TYPES)[number]["value"];
export type GrievanceType = (typeof GRIEVANCE_TYPES)[number]["value"];

export const STATUS_LABEL: Record<CaseStatus, string> = {
  PENDING_VERIFICATION: "Waiting for email confirmation",
  OPEN: "Received",
  IN_PROGRESS: "In progress",
  AWAITING_REQUESTER: "Waiting for your reply",
  RESOLVED: "Resolved",
  REJECTED: "Declined",
  CLOSED: "Closed",
};
export const OPEN_STATUSES: CaseStatus[] = ["OPEN", "IN_PROGRESS", "AWAITING_REQUESTER"];
export const DONE_STATUSES: CaseStatus[] = ["RESOLVED", "REJECTED", "CLOSED"];

export const typesFor = (kind: CaseKind): readonly { value: string; label: string }[] => (kind === "DATA_REQUEST" ? REQUEST_TYPES : kind === "GRIEVANCE" ? GRIEVANCE_TYPES : CONTENT_TYPES);
export const typeLabel = (kind: CaseKind, type: string) => typesFor(kind).find((t) => t.value === type)?.label ?? type;
export const KIND_WORD: Record<CaseKind, string> = { DATA_REQUEST: "data request", GRIEVANCE: "complaint", CONTENT_COMPLAINT: "content report" };

/** Statuses staff can move a case to. Unverified cases can only be closed; finished ones can be reopened. */
export function nextStatuses(from: CaseStatus): CaseStatus[] {
  if (from === "PENDING_VERIFICATION") return ["CLOSED"];
  if (DONE_STATUSES.includes(from)) return ["IN_PROGRESS"];
  return (["OPEN", "IN_PROGRESS", "AWAITING_REQUESTER", "RESOLVED", "REJECTED", "CLOSED"] as CaseStatus[]).filter((s) => s !== from);
}

/** Target dates from the timelines in Compliance settings. No timeline set → no date (none is assumed). */
export function caseTargets(kind: CaseKind, from: Date, t: { dataRequestDays?: number; grievanceAckDays?: number; grievanceResolveDays?: number; contentComplaintDays?: number }) {
  const add = (days?: number) => (days && days > 0 ? new Date(from.getTime() + days * 86_400_000) : null);
  if (kind === "DATA_REQUEST") return { ackDueAt: null, dueAt: add(t.dataRequestDays) };
  if (kind === "CONTENT_COMPLAINT") return { ackDueAt: null, dueAt: add(t.contentComplaintDays) };
  return { ackDueAt: add(t.grievanceAckDays), dueAt: add(t.grievanceResolveDays) };
}

export function isOverdue(c: { status: CaseStatus; dueAt: Date | null; ackDueAt?: Date | null; acknowledgedAt?: Date | null }, now = new Date()) {
  if (!OPEN_STATUSES.includes(c.status)) return false;
  if (c.dueAt && c.dueAt < now) return true;
  return Boolean(c.ackDueAt && !c.acknowledgedAt && c.ackDueAt < now);
}

const text = (min: number, max: number, msg: string) => z.string().trim().min(min, msg).max(max);
export const caseSubmission = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("DATA_REQUEST"),
    type: z.enum(REQUEST_TYPES.map((t) => t.value) as [RequestType, ...RequestType[]]),
    name: text(2, 120, "Enter your name"),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    details: text(10, 5000, "Tell us a little more (at least 10 characters)"),
    website: z.string().max(0).optional().or(z.literal("")),
  }),
  z.object({
    kind: z.literal("GRIEVANCE"),
    type: z.enum(GRIEVANCE_TYPES.map((t) => t.value) as [GrievanceType, ...GrievanceType[]]),
    name: text(2, 120, "Enter your name"),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    subject: text(3, 160, "Add a short subject"),
    details: text(10, 5000, "Describe the problem (at least 10 characters)"),
    website: z.string().max(0).optional().or(z.literal("")),
  }),
  z.object({
    kind: z.literal("CONTENT_COMPLAINT"),
    type: z.enum(CONTENT_TYPES.map((t) => t.value) as [ContentType, ...ContentType[]]),
    name: text(2, 120, "Enter your name"),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
    phone: z.string().trim().max(30).optional().or(z.literal("")),
    contentUrl: z.string().trim().max(500).refine((u) => /^https?:\/\/[^\s]+$/i.test(u), "Paste the full address of the page (https://…)"),
    details: text(20, 5000, "Explain what's wrong and, for copyright or trademarks, what you own (at least 20 characters)"),
    declaration: z.literal(true, { errorMap: () => ({ message: "Please confirm the statement" }) }),
    website: z.string().max(0).optional().or(z.literal("")),
  }),
]);
export type CaseSubmission = z.infer<typeof caseSubmission>;
