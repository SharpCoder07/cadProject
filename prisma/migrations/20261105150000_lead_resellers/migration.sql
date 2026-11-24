-- Enquiries are shared automatically with every reseller of the enquired products
-- (instead of being forwarded by hand to one reseller).

-- CreateTable
CREATE TABLE "LeadReseller" (
    "leadId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadReseller_pkey" PRIMARY KEY ("leadId","resellerId")
);

-- CreateIndex
CREATE INDEX "LeadReseller_resellerId_createdAt_idx" ON "LeadReseller"("resellerId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "LeadReseller" ADD CONSTRAINT "LeadReseller_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadReseller" ADD CONSTRAINT "LeadReseller_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep any leads already forwarded by hand.
INSERT INTO "LeadReseller" ("leadId", "resellerId", "createdAt")
SELECT "id", "resellerId", COALESCE("resellerAssignedAt", "createdAt") FROM "Lead" WHERE "resellerId" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Drop the single "forwarded to" reseller.
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_resellerId_fkey";
DROP INDEX "Lead_resellerId_createdAt_idx";
ALTER TABLE "Lead" DROP COLUMN "resellerAssignedAt",
DROP COLUMN "resellerId";

-- Every enquiry is now emailed to the product's vendor and resellers automatically.
UPDATE "Setting" SET "value" = jsonb_set(jsonb_set("value"::jsonb, '{notifyVendor}', 'true'::jsonb, true), '{notifyResellers}', 'true'::jsonb, true), "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'leads' AND jsonb_typeof("value"::jsonb) = 'object';
