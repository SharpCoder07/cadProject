-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('PROFESSION', 'USE_CASE', 'FEATURE', 'PLATFORM', 'DEPLOYMENT_MODEL', 'LICENSING_MODEL', 'BUDGET_RANGE', 'CUSTOMER_TYPE', 'OPERATING_SYSTEM');

-- CreateEnum
CREATE TYPE "GeoLevel" AS ENUM ('COUNTRY', 'STATE', 'CITY', 'AREA');

-- CreateTable
CREATE TABLE "TaxonomyTerm" (
    "id" TEXT NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "headline" TEXT,
    "content" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "promotedSoftwareId" TEXT,
    "promotedBadge" TEXT,
    "faqs" JSONB,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxonomyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareTerm" (
    "softwareId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,

    CONSTRAINT "SoftwareTerm_pkey" PRIMARY KEY ("softwareId","termId")
);

-- CreateTable
CREATE TABLE "GeoLocation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "level" "GeoLevel" NOT NULL,
    "parentId" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "pinCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "businessZones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeoPage" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "softwareId" TEXT,
    "vendorId" TEXT,
    "template" TEXT NOT NULL DEFAULT 'generic',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "sections" JSONB NOT NULL DEFAULT '{}',
    "inherit" TEXT[] DEFAULT ARRAY['hero', 'introduction', 'guide', 'faqs']::TEXT[],
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeoPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaxonomyTerm_kind_parentId_idx" ON "TaxonomyTerm"("kind", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyTerm_kind_slug_key" ON "TaxonomyTerm"("kind", "slug");

-- CreateIndex
CREATE INDEX "SoftwareTerm_termId_idx" ON "SoftwareTerm"("termId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoLocation_slug_key" ON "GeoLocation"("slug");

-- CreateIndex
CREATE INDEX "GeoLocation_level_parentId_idx" ON "GeoLocation"("level", "parentId");

-- CreateIndex
CREATE INDEX "GeoPage_isPublished_idx" ON "GeoPage"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "GeoPage_locationId_softwareId_key" ON "GeoPage"("locationId", "softwareId");

-- CreateIndex
CREATE UNIQUE INDEX "GeoPage_locationId_vendorId_key" ON "GeoPage"("locationId", "vendorId");

-- AddForeignKey
ALTER TABLE "TaxonomyTerm" ADD CONSTRAINT "TaxonomyTerm_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "TaxonomyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxonomyTerm" ADD CONSTRAINT "TaxonomyTerm_promotedSoftwareId_fkey" FOREIGN KEY ("promotedSoftwareId") REFERENCES "Software"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareTerm" ADD CONSTRAINT "SoftwareTerm_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "Software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoftwareTerm" ADD CONSTRAINT "SoftwareTerm_termId_fkey" FOREIGN KEY ("termId") REFERENCES "TaxonomyTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoLocation" ADD CONSTRAINT "GeoLocation_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GeoLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoPage" ADD CONSTRAINT "GeoPage_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "GeoLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoPage" ADD CONSTRAINT "GeoPage_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "Software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeoPage" ADD CONSTRAINT "GeoPage_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
