import { describe, expect, it } from "vitest";
import { COMPLIANCE_PERMISSIONS, SYSTEM_ROLES, superAdminPermissions, viewOnlyPermissions } from "@/server/rbac/permissions";
import { settingSchemas } from "@/server/settings/schemas";

describe("Compliance & privacy permissions", () => {
  it("only the Super Admin has them by default", () => {
    const sa = new Set(superAdminPermissions());
    for (const p of COMPLIANCE_PERMISSIONS) expect(sa.has(p)).toBe(true);
    for (const [key, role] of Object.entries(SYSTEM_ROLES)) {
      if (key === "SUPER_ADMIN") continue;
      for (const p of COMPLIANCE_PERMISSIONS) expect(role.permissions, `${key} must not have ${p}`).not.toContain(p);
    }
  });
  it("view-only (demo) accounts can't open privacy data", () => {
    const vo = new Set(viewOnlyPermissions());
    for (const p of COMPLIANCE_PERMISSIONS) expect(vo.has(p)).toBe(false);
  });
});

describe("Compliance settings", () => {
  it("assumes no legal timelines by default", () => {
    const c = settingSchemas.compliance.parse({});
    expect(c.grievanceAckDays).toBeUndefined();
    expect(c.grievanceResolveDays).toBeUndefined();
    expect(c.dataRequestDays).toBeUndefined();
    expect(c.incidentReportHours).toBeUndefined();
    expect(c.legalReviewDone).toBe(false);
  });
  it("rejects invalid contact emails and out-of-range timelines", () => {
    expect(settingSchemas.compliance.safeParse({ privacyEmail: "not-an-email" }).success).toBe(false);
    expect(settingSchemas.compliance.safeParse({ grievanceAckDays: 0 }).success).toBe(false);
    expect(settingSchemas.compliance.safeParse({ grievanceOfficerEmail: "grievance@example.com", grievanceAckDays: 2 }).success).toBe(true);
  });
});
