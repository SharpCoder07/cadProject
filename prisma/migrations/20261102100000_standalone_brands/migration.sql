-- Brands become standalone: a brand no longer has to belong to a vendor.

-- DropForeignKey
ALTER TABLE "Brand" DROP CONSTRAINT "Brand_vendorId_fkey";

-- AlterTable
ALTER TABLE "Brand" ALTER COLUMN "vendorId" DROP NOT NULL,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Brand_isActive_sortOrder_idx" ON "Brand"("isActive", "sortOrder");

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
