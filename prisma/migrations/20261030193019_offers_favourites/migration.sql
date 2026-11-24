-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterEnum
ALTER TYPE "ApprovalEntity" ADD VALUE 'OFFER';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "offerEmails" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProductOffer" (
    "id" TEXT NOT NULL,
    "softwareId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "discount" TEXT NOT NULL,
    "description" TEXT,
    "couponCode" TEXT,
    "terms" TEXT,
    "url" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "launchNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFavourite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "softwareId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductFavourite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductOffer_softwareId_status_startsAt_idx" ON "ProductOffer"("softwareId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "ProductOffer_status_launchNotifiedAt_startsAt_idx" ON "ProductOffer"("status", "launchNotifiedAt", "startsAt");

-- CreateIndex
CREATE INDEX "ProductFavourite_softwareId_idx" ON "ProductFavourite"("softwareId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFavourite_userId_softwareId_key" ON "ProductFavourite"("userId", "softwareId");

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "Software"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductOffer" ADD CONSTRAINT "ProductOffer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFavourite" ADD CONSTRAINT "ProductFavourite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFavourite" ADD CONSTRAINT "ProductFavourite_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "Software"("id") ON DELETE CASCADE ON UPDATE CASCADE;
