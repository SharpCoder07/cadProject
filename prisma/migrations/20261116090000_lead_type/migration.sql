-- What the buyer asked for (enquiry, price quote, demo, trial, purchase, call back, partnership).
CREATE TYPE "LeadType" AS ENUM ('ENQUIRY', 'QUOTE', 'DEMO', 'TRIAL', 'PURCHASE', 'CALLBACK', 'PARTNERSHIP');

ALTER TABLE "Lead" ADD COLUMN "type" "LeadType" NOT NULL DEFAULT 'ENQUIRY';

-- Existing partner sign-ups become partnership leads.
UPDATE "Lead" SET "type" = 'PARTNERSHIP' WHERE "source" IN ('LIST_SOFTWARE', 'BECOME_RESELLER');

CREATE INDEX "Lead_type_createdAt_idx" ON "Lead"("type", "createdAt" DESC);
