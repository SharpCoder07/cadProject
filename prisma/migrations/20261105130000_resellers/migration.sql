-- Resellers: channel partners that resell vendors' products. They reuse the vendor company,
-- portal, team, approvals and plans, marked with kind = RESELLER.

-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('VENDOR', 'RESELLER');

-- AlterEnum
ALTER TYPE "LeadActivityType" ADD VALUE 'RESELLER_ASSIGNED';
ALTER TYPE "LeadSource" ADD VALUE 'BECOME_RESELLER';
ALTER TYPE "ApprovalEntity" ADD VALUE 'RESELLER_PRODUCT';

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "kind" "PartnerKind" NOT NULL DEFAULT 'VENDOR',
ADD COLUMN     "serviceCities" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "VendorPlan" ADD COLUMN     "audience" "PartnerKind" NOT NULL DEFAULT 'VENDOR';

ALTER TABLE "Lead" ADD COLUMN     "resellerAssignedAt" TIMESTAMP(3),
ADD COLUMN     "resellerId" TEXT;

-- CreateTable
CREATE TABLE "ResellerProduct" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "softwareId" TEXT NOT NULL,
    "partnerLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResellerProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vendor_kind_idx" ON "Vendor"("kind");
CREATE INDEX "VendorPlan_audience_isActive_idx" ON "VendorPlan"("audience", "isActive");
CREATE INDEX "Lead_resellerId_createdAt_idx" ON "Lead"("resellerId", "createdAt" DESC);
CREATE INDEX "ResellerProduct_softwareId_idx" ON "ResellerProduct"("softwareId");
CREATE UNIQUE INDEX "ResellerProduct_resellerId_softwareId_key" ON "ResellerProduct"("resellerId", "softwareId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResellerProduct" ADD CONSTRAINT "ResellerProduct_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResellerProduct" ADD CONSTRAINT "ResellerProduct_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "Software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: the new permission and the "Reseller Admin" system role, so no seed run is needed.
INSERT INTO "Permission" ("id", "key", "group", "description")
VALUES ('perm_vendor_authorised', 'vendor.authorised', 'vendor', 'Propose products to resell as an authorised reseller (needs approval)')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "Role" ("id", "key", "name", "description", "isSystem", "createdAt", "updatedAt")
VALUES ('role_vendor_reseller', 'VENDOR_RESELLER', 'Reseller Admin', 'Reseller company lead. Proposes authorised products, profile and team changes (each needs Super Admin approval), sees assigned leads and buys plans.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r JOIN "Permission" p ON p."key" IN ('vendor.portal', 'vendor.profile', 'vendor.authorised', 'vendor.leads', 'vendor.billing', 'vendor.team', 'vendor.team.manage', 'media.manage')
WHERE r."key" = 'VENDOR_RESELLER'
ON CONFLICT DO NOTHING;
