-- Product ID on the previous website, used to redirect old comparison links.
ALTER TABLE "Software" ADD COLUMN "legacyId" INTEGER;
CREATE UNIQUE INDEX "Software_legacyId_key" ON "Software"("legacyId");
