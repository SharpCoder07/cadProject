import { describe, expect, it } from "vitest";
import { caseSubmission, caseTargets, isOverdue, nextStatuses } from "@/lib/compliance/cases";

const from = new Date("2026-11-23T10:00:00Z");

describe("target dates", () => {
  it("assume no deadline when no timeline is set", () => {
    expect(caseTargets("DATA_REQUEST", from, {})).toEqual({ ackDueAt: null, dueAt: null });
    expect(caseTargets("GRIEVANCE", from, {})).toEqual({ ackDueAt: null, dueAt: null });
  });
  it("use the timelines from Compliance settings", () => {
    expect(caseTargets("DATA_REQUEST", from, { dataRequestDays: 30 }).dueAt?.toISOString()).toBe("2026-12-23T10:00:00.000Z");
    const g = caseTargets("GRIEVANCE", from, { grievanceAckDays: 1, grievanceResolveDays: 15 });
    expect(g.ackDueAt?.toISOString()).toBe("2026-11-24T10:00:00.000Z");
    expect(g.dueAt?.toISOString()).toBe("2026-12-08T10:00:00.000Z");
  });
});

describe("overdue", () => {
  const now = new Date("2026-12-01T00:00:00Z");
  it("counts open cases past their date or not acknowledged in time", () => {
    expect(isOverdue({ status: "OPEN", dueAt: new Date("2026-11-30T00:00:00Z") }, now)).toBe(true);
    expect(isOverdue({ status: "OPEN", dueAt: null, ackDueAt: new Date("2026-11-24T00:00:00Z"), acknowledgedAt: null }, now)).toBe(true);
    expect(isOverdue({ status: "OPEN", dueAt: null, ackDueAt: new Date("2026-11-24T00:00:00Z"), acknowledgedAt: new Date("2026-11-23T12:00:00Z") }, now)).toBe(false);
    expect(isOverdue({ status: "RESOLVED", dueAt: new Date("2026-11-30T00:00:00Z") }, now)).toBe(false);
    expect(isOverdue({ status: "OPEN", dueAt: null }, now)).toBe(false);
  });
});

describe("status changes", () => {
  it("only lets unconfirmed cases be closed, and finished ones be reopened", () => {
    expect(nextStatuses("PENDING_VERIFICATION")).toEqual(["CLOSED"]);
    expect(nextStatuses("RESOLVED")).toEqual(["IN_PROGRESS"]);
    expect(nextStatuses("OPEN")).not.toContain("OPEN");
    expect(nextStatuses("OPEN")).toContain("RESOLVED");
  });
});

describe("submission", () => {
  it("accepts a data request and requires a subject for complaints", () => {
    expect(caseSubmission.safeParse({ kind: "DATA_REQUEST", type: "access", name: "Riya", email: "RIYA@Example.com", details: "Please send me my data." }).success).toBe(true);
    expect(caseSubmission.safeParse({ kind: "GRIEVANCE", type: "privacy", name: "Riya", email: "riya@example.com", details: "My data was shared." }).success).toBe(false);
    expect(caseSubmission.safeParse({ kind: "DATA_REQUEST", type: "delete-everything", name: "Riya", email: "riya@example.com", details: "Please send me my data." }).success).toBe(false);
  });
});

describe("content complaints", () => {
  const base = { kind: "CONTENT_COMPLAINT", type: "copyright", name: "Asha", email: "asha@example.com", details: "This review copies my article word for word without permission." };
  it("need the page address and the good-faith statement", () => {
    expect(caseSubmission.safeParse({ ...base, contentUrl: "https://example.com/software/x", declaration: true }).success).toBe(true);
    expect(caseSubmission.safeParse({ ...base, contentUrl: "javascript:alert(1)", declaration: true }).success).toBe(false);
    expect(caseSubmission.safeParse({ ...base, contentUrl: "https://example.com/software/x", declaration: false }).success).toBe(false);
  });
  it("use their own timeline", () => {
    expect(caseTargets("CONTENT_COMPLAINT", from, { dataRequestDays: 30 }).dueAt).toBeNull();
    expect(caseTargets("CONTENT_COMPLAINT", from, { contentComplaintDays: 2 }).dueAt?.toISOString()).toBe("2026-11-25T10:00:00.000Z");
  });
});
