import { describe, expect, it } from "vitest";
import { ALL_PERMISSIONS, SYSTEM_ROLES, VENDOR_GRANTABLE, VENDOR_MEDIA_PERMISSIONS, VIEW_ONLY, homeFor, isBuyerRoleKey, isVendorRoleKey, type Permission } from "@/server/rbac/permissions";
import { assertCan, can, type Principal } from "@/server/rbac/policy";

const principal = (roleKey: keyof typeof SYSTEM_ROLES, vendorId: string | null = null): Principal => ({
  id: "u1", email: "x@example.com", name: "X", roleKey, vendorId,
  permissions: new Set<Permission>(SYSTEM_ROLES[roleKey].permissions),
});

describe("role matrix", () => {
  it("gives Super Admin every staff permission", () => {
    const p = principal("SUPER_ADMIN");
    // "View-only" is a restriction for demo accounts, not a capability, so the Super Admin never has it.
    for (const perm of ALL_PERMISSIONS.filter((x) => !x.startsWith("vendor.") && !x.startsWith("buyer.") && x !== VIEW_ONLY)) expect(can(p, perm), perm).toBe(true);
    expect(can(p, VIEW_ONLY)).toBe(false);
  });

  it("keeps role management with Super Admin only", () => {
    expect(can(principal("ADMIN"), "roles.manage")).toBe(false);
    expect(can(principal("ADMIN"), "users.manage")).toBe(true);
  });

  it("limits the analyst to read-only permissions", () => {
    const p = principal("ANALYST");
    expect(can(p, "leads.view")).toBe(true);
    for (const w of ["leads.manage", "leads.export", "software.edit", "software.publish", "settings.manage"] as Permission[]) expect(can(p, w)).toBe(false);
  });

  it("separates content and catalogue responsibilities", () => {
    expect(can(principal("CONTENT_EDITOR"), "cms.pages")).toBe(true);
    expect(can(principal("CONTENT_EDITOR"), "software.edit")).toBe(false);
    expect(can(principal("PRODUCT_MANAGER"), "software.publish")).toBe(true);
    expect(can(principal("PRODUCT_MANAGER"), "cms.pages")).toBe(false);
    expect(can(principal("SALES_MANAGER"), "leads.export")).toBe(true);
    expect(can(principal("SALES_MANAGER"), "software.edit")).toBe(false);
  });

  it("never mixes vendor permissions into staff roles", () => {
    for (const [key, role] of Object.entries(SYSTEM_ROLES)) {
      if (isVendorRoleKey(key)) continue;
      expect(role.permissions.some((p) => p.startsWith("vendor."))).toBe(false);
    }
  });
});

describe("vendor scoping", () => {
  const vendor = principal("VENDOR", "v1");

  it("allows a vendor to act on its own resources", () => {
    expect(can(vendor, "vendor.listings", { vendorId: "v1" })).toBe(true);
    expect(can(vendor, "vendor.leads", { vendorId: "v1" })).toBe(true);
  });

  it("denies another vendor's resources and unowned resources", () => {
    expect(can(vendor, "vendor.listings", { vendorId: "v2" })).toBe(false);
    expect(can(vendor, "vendor.listings", { vendorId: null })).toBe(false);
    expect(can(vendor, "vendor.listings", null)).toBe(false);
  });

  it("denies staff permissions even if a vendor role were misconfigured with them", () => {
    const misconfigured: Principal = { ...vendor, permissions: new Set<Permission>([...vendor.permissions, "software.publish", "leads.view"]) };
    expect(can(misconfigured, "software.publish")).toBe(false);
    expect(can(misconfigured, "leads.view")).toBe(false);
  });
});

describe("assertCan", () => {
  it("throws UNAUTHENTICATED when signed out and FORBIDDEN when not permitted", () => {
    expect(() => assertCan(null, "dashboard.view")).toThrowError(expect.objectContaining({ code: "UNAUTHENTICATED" }));
    expect(() => assertCan(principal("ANALYST"), "settings.manage")).toThrowError(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => assertCan(principal("ADMIN"), "settings.manage")).not.toThrow();
  });
});

describe("buyer accounts", () => {
  it("gives buyers only the buyer permission, and nobody else gets it", () => {
    expect(isBuyerRoleKey("BUYER")).toBe(true);
    expect(SYSTEM_ROLES.BUYER.permissions).toEqual(["buyer.account"]);
    for (const [key, role] of Object.entries(SYSTEM_ROLES)) if (key !== "BUYER") expect(role.permissions.includes("buyer.account")).toBe(false);
    expect(can(principal("BUYER"), "dashboard.view")).toBe(false);
    expect(can(principal("BUYER"), "media.manage")).toBe(false);
  });

  it("sends each kind of account to its own area after sign-in", () => {
    expect(homeFor("BUYER", null)).toBe("/account");
    expect(homeFor("VENDOR", "v1")).toBe("/vendor");
    expect(homeFor("ADMIN", null)).toBe("/admin");
  });
});

describe("vendor approval workflow permissions", () => {
  it("gives approvals.manage to Super Admin only among system roles", () => {
    for (const [key, role] of Object.entries(SYSTEM_ROLES)) expect(role.permissions.includes("approvals.manage")).toBe(key === "SUPER_ADMIN");
  });

  it("gives vendor roles only vendor-portal permissions (plus their own media uploads)", () => {
    for (const key of ["VENDOR", "VENDOR_EDITOR", "VENDOR_VIEWER"] as const) {
      expect(isVendorRoleKey(key)).toBe(true);
      for (const p of SYSTEM_ROLES[key].permissions) expect(p.startsWith("vendor.") || VENDOR_MEDIA_PERMISSIONS.includes(p), `${key}: ${p}`).toBe(true);
    }
    expect(isVendorRoleKey("ADMIN")).toBe(false);
  });

  it("never lets a vendor user publish, delete or approve, whatever their role says", () => {
    const loaded: Principal = { ...principal("VENDOR", "v1"), permissions: new Set<Permission>(ALL_PERMISSIONS) };
    for (const p of ["software.publish", "software.delete", "software.edit", "approvals.manage", "vendors.manage"] as Permission[]) expect(can(loaded, p)).toBe(false);
  });

  it("scales vendor capabilities by role", () => {
    const admin = principal("VENDOR", "v1");
    const editor = principal("VENDOR_EDITOR", "v1");
    const viewer = principal("VENDOR_VIEWER", "v1");
    const own = { vendorId: "v1" };
    expect(can(admin, "vendor.listings.delete", own)).toBe(true);
    expect(can(editor, "vendor.listings.submit", own)).toBe(true);
    expect(can(editor, "vendor.listings.delete", own)).toBe(false);
    expect(can(editor, "vendor.profile", own)).toBe(false);
    expect(can(viewer, "vendor.listings", own)).toBe(true);
    expect(can(viewer, "vendor.listings.submit", own)).toBe(false);
  });

  it("never applies vendor.* permissions to staff accounts", () => {
    const staffWithVendorPerm: Principal = { ...principal("ADMIN"), permissions: new Set<Permission>(["vendor.listings.submit"]) };
    expect(can(staffWithVendorPerm, "vendor.listings.submit")).toBe(false);
  });
});

describe("vendor team management", () => {
  it("only lets vendors grant vendor-portal permissions", () => {
    for (const p of VENDOR_GRANTABLE) expect(p.startsWith("vendor.") || VENDOR_MEDIA_PERMISSIONS.includes(p), p).toBe(true);
    expect(VENDOR_GRANTABLE).not.toContain("media.delete");
    expect(VENDOR_GRANTABLE).not.toContain("users.manage");
    expect(VENDOR_GRANTABLE).not.toContain("approvals.manage");
  });

  it("gives team management to Vendor Admin only", () => {
    expect(SYSTEM_ROLES.VENDOR.permissions).toContain("vendor.team.manage");
    expect(SYSTEM_ROLES.VENDOR_EDITOR.permissions).not.toContain("vendor.team.manage");
    expect(SYSTEM_ROLES.VENDOR_VIEWER.permissions).not.toContain("vendor.team.manage");
  });

  it("treats custom vendor roles as vendor roles", () => {
    expect(isVendorRoleKey("VENDOR_CUSTOM_1A2B3C4D")).toBe(true);
    expect(isVendorRoleKey("VENDORX")).toBe(false);
  });
});
